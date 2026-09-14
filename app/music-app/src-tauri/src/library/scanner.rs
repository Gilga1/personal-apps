use super::db::Database;
use super::mood::classify_mood;
use super::tags::parse_audio_file;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ScanProgress {
    pub scanned: u32,
    pub added: u32,
    pub current_file: Option<String>,
}

pub fn scan_directory(db: &Database, root: &Path) -> Result<u32, String> {
    let mut added = 0u32;

    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());
        if ext.as_deref() != Some("flac") && ext.as_deref() != Some("mp3") {
            continue;
        }

        let folder_name = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str());
        let folder_path = path.parent().map(|p| p.to_string_lossy().to_string());

        let parsed = parse_audio_file(path, folder_name)?;
        let mood = classify_mood(&parsed, folder_name);
        let format = ext.unwrap_or_else(|| "unknown".to_string());

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
        )?;
        added += 1;
    }

    Ok(added)
}

pub fn count_audio_files(root: &Path) -> u32 {
    WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let ext = e
                .path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.to_lowercase());
            ext.as_deref() == Some("flac") || ext.as_deref() == Some("mp3")
        })
        .count() as u32
}
