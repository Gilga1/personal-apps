use crate::library::db::Track;
use crate::llm::config::LlmConfig;
use crate::llm::provider::{extract_json_object, LlmClient};
use std::collections::HashMap;

const STOP_WORDS: &[&str] = &[
    "a",
    "an",
    "the",
    "for",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "with",
    "my",
    "me",
    "some",
    "like",
    "queue",
    "playlist",
    "tracks",
    "track",
    "songs",
    "song",
    "music",
    "build",
    "play",
    "something",
];

#[derive(Clone, Copy, PartialEq)]
enum QueryIntent {
    Neutral,
    Workout,
    Focus,
    Chill,
    LateNight,
}

fn detect_intent(prompt: &str) -> QueryIntent {
    let p = prompt.to_lowercase();
    if p.contains("workout")
        || p.contains("gym")
        || p.contains("exercise")
        || p.contains("running")
        || p.contains("cardio")
        || p.contains("energy")
    {
        return QueryIntent::Workout;
    }
    if p.contains("focus")
        || p.contains("study")
        || p.contains("concentrat")
        || p.contains("deep work")
    {
        return QueryIntent::Focus;
    }
    if p.contains("chill")
        || p.contains("relax")
        || p.contains("nostalg")
        || p.contains("calm")
    {
        return QueryIntent::Chill;
    }
    if p.contains("late night") || p.contains("night") || p.contains("sleep") {
        return QueryIntent::LateNight;
    }
    QueryIntent::Neutral
}

fn expand_terms(prompt: &str, intent: QueryIntent) -> Vec<String> {
    let mut terms: Vec<String> = prompt
        .to_lowercase()
        .split(|c: char| c.is_whitespace() || c == ',' || c == '-')
        .map(|t| t.trim())
        .filter(|t| t.len() > 1 && !STOP_WORDS.contains(&t))
        .map(|t| t.to_string())
        .collect();

    let extras: &[&str] = match intent {
        QueryIntent::Workout => &[
            "workout",
            "energy",
            "dance",
            "bhangra",
            "edm",
            "party",
            "remix",
            "pop",
            "punjabi",
            "high",
        ],
        QueryIntent::Focus => &[
            "focus",
            "classical",
            "piano",
            "instrumental",
            "bach",
            "chopin",
            "study",
        ],
        QueryIntent::Chill => &["chill", "acoustic", "ballad", "nostalgic", "slow", "lofi"],
        QueryIntent::LateNight => &["late", "night", "acoustic", "ballad", "slow", "unplugged"],
        QueryIntent::Neutral => &[],
    };

    for e in extras {
        if !terms.iter().any(|t| t == e) {
            terms.push(e.to_string());
        }
    }

    terms
}

fn intent_mood(intent: QueryIntent) -> Option<&'static str> {
    match intent {
        QueryIntent::Workout => Some("High Energy"),
        QueryIntent::Focus => Some("Deep Focus"),
        QueryIntent::Chill => Some("Chill & Nostalgic"),
        QueryIntent::LateNight => Some("Late Night"),
        QueryIntent::Neutral => None,
    }
}

fn score_track(t: &Track, terms: &[String], intent: QueryIntent) -> i32 {
    let blob = format!(
        "{} {} {} {} {} {}",
        t.title,
        t.artist,
        t.album,
        t.mood,
        t.genre.as_deref().unwrap_or(""),
        t.situational_tags.join(" ")
    )
    .to_lowercase();

    let mut score = terms
        .iter()
        .map(|term| {
            if blob.contains(term.as_str()) {
                2
            } else {
                0
            }
        })
        .sum::<i32>();

    if let Some(target_mood) = intent_mood(intent) {
        if t.mood == target_mood {
            score += 5;
        }
    }

    if intent == QueryIntent::Workout {
        let anti = [
            "reiki",
            "healing",
            "meditation",
            "ambient",
            "spa",
            "wellness",
            "spiritual",
            "relaxation",
            "massage",
        ];
        if anti.iter().any(|k| blob.contains(k)) {
            score -= 4;
        }
        if t.energy_score.unwrap_or(0) >= 7 {
            score += 2;
        }
    }

    score
}

pub fn keyword_candidates(tracks: &[Track], prompt: &str, limit: usize) -> Vec<Track> {
    let intent = detect_intent(prompt);
    let terms = expand_terms(prompt, intent);

    if terms.is_empty() {
        if let Some(mood) = intent_mood(intent) {
            return tracks
                .iter()
                .filter(|t| t.mood == mood)
                .take(limit)
                .cloned()
                .collect();
        }
        return Vec::new();
    }

    let min_score = if intent == QueryIntent::Neutral { 2 } else { 3 };

    let mut scored: Vec<(i32, &Track)> = tracks
        .iter()
        .map(|t| (score_track(t, &terms, intent), t))
        .filter(|(score, _)| *score >= min_score)
        .collect();

    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored
        .into_iter()
        .take(limit)
        .map(|(_, t)| t.clone())
        .collect()
}

pub async fn rerank_with_llm(
    config: &LlmConfig,
    prompt: &str,
    candidates: &[Track],
) -> Result<Vec<String>, String> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let summary: Vec<serde_json::Value> = candidates
        .iter()
        .map(|t| {
            serde_json::json!({
                "id": t.id,
                "title": t.title,
                "artist": t.artist,
                "album": t.album,
                "mood": t.mood,
                "genre": t.genre,
                "tags": t.situational_tags
            })
        })
        .collect();

    let user_prompt = format!(
        r#"Given this playlist request: "{prompt}"

Rank these tracks by semantic fit. Prefer tracks that clearly match the intent; exclude poor fits.
Return JSON only:
{{ "track_ids": ["id1", "id2", ...] }}

Candidates:
{}"#,
        serde_json::to_string_pretty(&summary).unwrap_or_default()
    );

    let client = LlmClient::new(config.clone());
    let response = client.complete_json(&user_prompt).await?;
    let json = extract_json_object(&response)?;

    let ids: Vec<String> = json["track_ids"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let valid: HashMap<&str, ()> = candidates.iter().map(|t| (t.id.as_str(), ())).collect();
    Ok(ids
        .into_iter()
        .filter(|id| valid.contains_key(id.as_str()))
        .collect())
}

pub async fn build_playlist(
    config: &LlmConfig,
    tracks: &[Track],
    prompt: &str,
    use_llm: bool,
) -> Vec<String> {
    let candidates = keyword_candidates(tracks, prompt, 50);
    if candidates.is_empty() {
        return Vec::new();
    }

    if use_llm {
        if let Ok(reranked) = rerank_with_llm(config, prompt, &candidates).await {
            if !reranked.is_empty() {
                return reranked;
            }
        }
    }

    candidates.into_iter().map(|t| t.id).collect()
}
