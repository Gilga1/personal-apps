use super::tags::ParsedTags;

const MOOD_RULES: [(&str, &[&str]); 4] = [
    (
        "Deep Focus",
        &[
            "bach",
            "chopin",
            "mozart",
            "brahms",
            "beethoven",
            "vivaldi",
            "schubert",
            "tchaikovsky",
            "piano",
            "classical",
            "symphony",
            "sonata",
            "nocturne",
            "instrumental",
            "concerto",
            "meditation",
            "focus",
            "study",
        ],
    ),
    (
        "Chill & Nostalgic",
        &[
            "kishore kumar",
            "lata mangeshkar",
            "mohammed rafi",
            "mukesh",
            "asha bhosle",
            "old hindi",
            "retro",
            "80s",
            "90s",
            "soothing",
            "soothe",
            "calm",
            "relax",
            "chill",
            "waves",
            "waterfall",
            "rain",
            "ocean",
            "forest",
            "nature",
            "ambient",
            "spa",
            "gentle",
            "peaceful",
            "romantic",
            "romance",
            "love song",
            "tere dil",
            "dil mein",
            "pyaar",
            "mohabbat",
            "ballad",
            "acoustic",
            "nostalg",
        ],
    ),
    (
        "High Energy",
        &[
            "punjabi",
            "bhangra",
            "edm",
            "workout",
            "dance",
            "party",
            "remix",
            "pop",
            "upbeat",
            "energetic",
        ],
    ),
    (
        "Late Night",
        &[
            "late night",
            "melancholy",
            "lo-fi",
            "lofi",
            "unplugged",
            "chillout",
            "slow",
            "midnight",
            "sleep",
        ],
    ),
];

const SITUATIONAL_KEYWORDS: &[(&str, &str)] = &[
    ("romantic", "romantic"),
    ("romance", "romantic"),
    ("love", "romantic"),
    ("tere dil", "romantic"),
    ("dil mein", "romantic"),
    ("pyaar", "romantic"),
    ("soothing", "soothing"),
    ("soothe", "soothing"),
    ("waterfall", "nature"),
    ("waves", "nature"),
    ("rain", "nature"),
    ("forest", "nature"),
    ("ocean", "nature"),
    ("nature", "nature"),
    ("meditation", "meditation"),
    ("workout", "workout"),
    ("focus", "focus"),
    ("study", "study"),
    ("hindi", "hindi"),
    ("bollywood", "bollywood"),
    ("classical", "classical"),
    ("instrumental", "instrumental"),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MoodClassification {
    pub mood: String,
    pub situational_tags: Vec<String>,
    pub energy_score: Option<i32>,
}

pub fn classify_mood(tags: &ParsedTags, folder_path: Option<&str>) -> MoodClassification {
    classify_track_text(
        &tags.title,
        &tags.artist,
        &tags.album,
        tags.genre.as_deref(),
        folder_path,
    )
}

pub fn classify_track_text(
    title: &str,
    artist: &str,
    album: &str,
    genre: Option<&str>,
    folder_path: Option<&str>,
) -> MoodClassification {
    let blob = format!(
        "{} {} {} {} {}",
        title,
        artist,
        album,
        folder_path.unwrap_or(""),
        genre.unwrap_or("")
    )
    .to_lowercase();

    let mood = MOOD_RULES
        .iter()
        .find(|(_, keywords)| keywords.iter().any(|k| blob.contains(k)))
        .map(|(mood, _)| mood.to_string())
        .unwrap_or_else(|| "Unsorted".to_string());

    let situational_tags = infer_situational_tags(&blob);
    let energy_score = match mood.as_str() {
        "High Energy" => Some(8),
        "Deep Focus" => Some(3),
        "Late Night" => Some(2),
        "Chill & Nostalgic" => Some(4),
        _ => None,
    };

    MoodClassification {
        mood,
        situational_tags,
        energy_score,
    }
}

pub fn infer_situational_tags(blob: &str) -> Vec<String> {
    let lower = blob.to_lowercase();
    let mut tags: Vec<String> = SITUATIONAL_KEYWORDS
        .iter()
        .filter(|(needle, _)| lower.contains(needle))
        .map(|(_, tag)| tag.to_string())
        .collect();
    tags.sort();
    tags.dedup();
    tags
}

pub fn map_llm_mood(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("focus") || lower.contains("study") || lower.contains("concentrat") {
        return "Deep Focus".to_string();
    }
    if lower.contains("energy") || lower.contains("workout") || lower.contains("dance") {
        return "High Energy".to_string();
    }
    if lower.contains("night") || lower.contains("sleep") {
        return "Late Night".to_string();
    }
    if lower.contains("chill")
        || lower.contains("relax")
        || lower.contains("romantic")
        || lower.contains("nostalg")
        || lower.contains("calm")
        || lower.contains("sooth")
    {
        return "Chill & Nostalgic".to_string();
    }
    if MOOD_CYCLE.iter().any(|m| *m == raw) {
        return raw.to_string();
    }
    "Unsorted".to_string()
}

pub const MOOD_CYCLE: [&str; 5] = [
    "Unsorted",
    "Deep Focus",
    "Chill & Nostalgic",
    "High Energy",
    "Late Night",
];

pub fn next_mood(current: &str) -> String {
    let idx = MOOD_CYCLE
        .iter()
        .position(|m| *m == current)
        .unwrap_or(0);
    MOOD_CYCLE[(idx + 1) % MOOD_CYCLE.len()].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn soothing_waterfall_is_chill() {
        let c = classify_track_text(
            "Soothing Waterfalls",
            "Sounds of Nature",
            "Nature",
            None,
            None,
        );
        assert_eq!(c.mood, "Chill & Nostalgic");
        assert!(c.situational_tags.iter().any(|t| t == "soothing"));
    }

    #[test]
    fn hindi_romantic_keywords() {
        let c = classify_track_text("Tere Dil Mein", "Artist", "Album", None, None);
        assert_eq!(c.mood, "Chill & Nostalgic");
        assert!(c.situational_tags.iter().any(|t| t == "romantic"));
    }
}
