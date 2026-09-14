use crate::library::db::Track;
use crate::llm::config::LlmConfig;
use crate::llm::provider::{extract_json_object, LlmClient};
use std::collections::HashMap;

pub fn keyword_candidates(tracks: &[Track], prompt: &str, limit: usize) -> Vec<Track> {
    let terms: Vec<String> = prompt
        .to_lowercase()
        .split(|c: char| c.is_whitespace() || c == ',')
        .filter(|t| t.len() > 1)
        .map(|t| t.to_string())
        .collect();

    if terms.is_empty() {
        return Vec::new();
    }

    let mut scored: Vec<(i32, &Track)> = tracks
        .iter()
        .map(|t| {
            let blob = format!(
                "{} {} {} {} {} {}",
                t.title,
                t.artist,
                t.album,
                t.mood,
                t.genre.as_deref().unwrap_or(""),
                t.folder_path.as_deref().unwrap_or("")
            )
            .to_lowercase();
            let score = terms.iter().filter(|term| blob.contains(term.as_str())).count() as i32;
            (score, t)
        })
        .filter(|(score, _)| *score > 0)
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

Rank these tracks by semantic fit. Return JSON only:
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
    Ok(ids.into_iter().filter(|id| valid.contains_key(id.as_str())).collect())
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
