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
        ],
    ),
    (
        "Late Night",
        &[
            "acoustic",
            "ballad",
            "slow",
            "melancholy",
            "lo-fi",
            "lofi",
            "unplugged",
            "chillout",
        ],
    ),
];

pub fn classify_mood(tags: &ParsedTags, folder_path: Option<&str>) -> String {
    let blob = format!(
        "{} {} {} {}",
        tags.artist,
        tags.album,
        folder_path.unwrap_or(""),
        tags.genre.as_deref().unwrap_or("")
    )
    .to_lowercase();

    for (mood, keywords) in MOOD_RULES {
        if keywords.iter().any(|k| blob.contains(k)) {
            return mood.to_string();
        }
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
