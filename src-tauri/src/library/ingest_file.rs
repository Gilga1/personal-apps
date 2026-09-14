use super::db::Database;
use super::mood::classify_mood;
use super::tags::parse_audio_file;
use std::path::Path;

/// Ingest a single audio file into the library DB.
pub fn ingest_file(db: &Database, path: &Path) -> Result<String, String> {
    let folder_name = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str());
    let folder_path = path.parent().map(|p| p.to_string_lossy().to_string());

    let parsed = parse_audio_file(path, folder_name)?;
    let mood = classify_mood(&parsed, folder_name);
    let format = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_lowercase();

    db.upsert_track(
        &path.to_string_lossy(),
        &parsed.title,
        &parsed.artist,
        &parsed.album,
        parsed.year,
        parsed.genre.as_deref(),
        parsed.duration_sec,
        &format,
        &parsed.tag_source,
        folder_path.as_deref(),
        &mood,
        "rule_engine",
    )
}
