use crate::ingest::{self, ytdlp};
use crate::library::db::{Database, IngestJob, PlaylistSummary, Track};
use crate::library::mood::next_mood;
use crate::library::scanner::scan_directory;
use crate::llm::config::{load_config_from_db, save_config_to_db, LlmConfig};
use crate::llm::normalize::normalize_filename;
use crate::playlist::query::build_playlist;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};

pub struct AppState {
    pub db: Arc<Database>,
    pub data_dir: PathBuf,
}

#[tauri::command]
pub async fn pick_library_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app
        .dialog()
        .file()
        .set_title("Choose music library folder")
        .blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn scan_library(path: String, state: State<'_, AppState>) -> Result<u32, String> {
    scan_directory(&state.db, PathBuf::from(&path).as_path())
}

#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    state.db.get_all_tracks()
}

#[tauri::command]
pub async fn set_track_mood(
    track_id: String,
    mood: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let new_mood = if let Some(m) = mood {
        m
    } else {
        let tracks = state.db.get_all_tracks()?;
        let current = tracks
            .iter()
            .find(|t| t.id == track_id)
            .map(|t| t.mood.clone())
            .unwrap_or_else(|| "Unsorted".to_string());
        next_mood(&current)
    };
    state.db.set_track_mood(&track_id, &new_mood)?;
    Ok(new_mood)
}

#[tauri::command]
pub async fn get_llm_config(state: State<'_, AppState>) -> Result<LlmConfig, String> {
    Ok(load_config_from_db(&state.db))
}

#[tauri::command]
pub async fn set_llm_config(
    config: LlmConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    save_config_to_db(&state.db, &config)
}

#[tauri::command]
pub async fn test_llm_connection(state: State<'_, AppState>) -> Result<String, String> {
    let config = load_config_from_db(&state.db);
    let client = crate::llm::provider::LlmClient::new(config);
    client.test_connection().await
}

#[tauri::command]
pub async fn normalize_track(
    track_id: String,
    state: State<'_, AppState>,
) -> Result<Track, String> {
    let track = state
        .db
        .get_track_by_id(&track_id)?
        .ok_or_else(|| "Track not found".to_string())?;

    let raw_name = std::path::Path::new(&track.file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&track.title);

    let config = load_config_from_db(&state.db);
    let normalized = normalize_filename(&config, raw_name).await?;

    state.db.apply_llm_enrichment(
        &track_id,
        &normalized.title,
        &normalized.artist,
        &normalized.album,
        normalized.release_year,
        normalized.genre.as_deref(),
        &normalized.moods,
        normalized.energy_score,
        &normalized.situational_tags,
    )?;

    state
        .db
        .get_track_by_id(&track_id)?
        .ok_or_else(|| "Track not found after update".to_string())
}

#[tauri::command]
pub async fn normalize_low_confidence(state: State<'_, AppState>) -> Result<u32, String> {
    let ids = state.db.get_low_confidence_track_ids()?;
    let config = load_config_from_db(&state.db);
    let mut count = 0u32;

    for id in ids {
        if let Ok(track) = state.db.get_track_by_id(&id) {
            if let Some(track) = track {
                let raw_name = std::path::Path::new(&track.file_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&track.title);
                if let Ok(normalized) = normalize_filename(&config, raw_name).await {
                    let _ = state.db.apply_llm_enrichment(
                        &id,
                        &normalized.title,
                        &normalized.artist,
                        &normalized.album,
                        normalized.release_year,
                        normalized.genre.as_deref(),
                        &normalized.moods,
                        normalized.energy_score,
                        &normalized.situational_tags,
                    );
                    count += 1;
                }
            }
        }
    }
    Ok(count)
}

#[tauri::command]
pub async fn build_playlist_queue(
    prompt: String,
    use_llm: bool,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let tracks = state.db.get_all_tracks()?;
    let config = load_config_from_db(&state.db);
    Ok(build_playlist(&config, &tracks, &prompt, use_llm).await)
}

#[tauri::command]
pub async fn ingest_youtube(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !ytdlp::yt_dlp_available() {
        return Err(
            "yt-dlp not found. Install from https://github.com/yt-dlp/yt-dlp#installation".into(),
        );
    }
    let job_id = ingest::create_job(&state.db, &url)?;
    let db = state.db.clone();
    let data_dir = state.data_dir.clone();
    let job_id_spawn = job_id.clone();
    tauri::async_runtime::spawn(async move {
        ingest::run_youtube_ingest(app, db, data_dir, job_id_spawn, url).await;
    });
    Ok(job_id)
}

#[tauri::command]
pub async fn get_ingest_jobs(state: State<'_, AppState>) -> Result<Vec<IngestJob>, String> {
    state.db.get_ingest_jobs()
}

#[tauri::command]
pub fn check_ytdlp_available() -> bool {
    ytdlp::yt_dlp_available()
}

#[tauri::command]
pub async fn save_playlist(
    name: String,
    track_ids: Vec<String>,
    created_from: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .db
        .save_playlist(&name, &track_ids, created_from.as_deref())
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<PlaylistSummary>, String> {
    state.db.get_playlists()
}

#[tauri::command]
pub async fn get_playlist_tracks(
    playlist_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    state.db.get_playlist_track_ids(&playlist_id)
}

#[tauri::command]
pub async fn delete_playlist(
    playlist_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.delete_playlist(&playlist_id)
}

#[tauri::command]
pub fn list_llm_providers() -> Vec<serde_json::Value> {
    vec![
        serde_json::json!({
            "id": "ollama",
            "label": "Ollama (local)",
            "models": ["llama3.2:3b", "phi3:mini", "gemma2:2b", "mistral:7b"]
        }),
        serde_json::json!({
            "id": "openai",
            "label": "OpenAI",
            "models": ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"]
        }),
        serde_json::json!({
            "id": "openrouter",
            "label": "OpenRouter",
            "models": ["anthropic/claude-3-haiku", "google/gemma-2-2b-it", "meta-llama/llama-3.2-3b-instruct"]
        }),
        serde_json::json!({
            "id": "gemini",
            "label": "Google Gemini",
            "models": ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"]
        }),
    ]
}
