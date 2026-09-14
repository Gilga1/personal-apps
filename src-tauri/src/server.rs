#[cfg(feature = "server")]
use crate::ingest::{self, ytdlp};
#[cfg(feature = "server")]
use crate::library::db::Database;
#[cfg(feature = "server")]
use crate::library::mood::next_mood;
#[cfg(feature = "server")]
use crate::library::scanner::scan_directory;
#[cfg(feature = "server")]
use crate::llm::config::{load_config_from_db, save_config_to_db, LlmConfig};
#[cfg(feature = "server")]
use crate::llm::normalize::normalize_filename;
#[cfg(feature = "server")]
use crate::playlist::query::build_playlist;
#[cfg(feature = "server")]
use axum::body::Body;
#[cfg(feature = "server")]
use axum::extract::{Path, Query, State};
#[cfg(feature = "server")]
use axum::http::{header, StatusCode};
#[cfg(feature = "server")]
use axum::response::{IntoResponse, Response};
#[cfg(feature = "server")]
use axum::routing::{get, post};
#[cfg(feature = "server")]
use axum::{Json, Router};
#[cfg(feature = "server")]
use serde::Deserialize;
#[cfg(feature = "server")]
use std::path::PathBuf;
#[cfg(feature = "server")]
use std::sync::Arc;
#[cfg(feature = "server")]
use tower_http::cors::CorsLayer;
#[cfg(feature = "server")]
use tower_http::services::ServeDir;

#[cfg(feature = "server")]
pub async fn run_server() {
    let data_dir = std::env::var("STACKS_DATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/data"));
    let music_dir = std::env::var("STACKS_MUSIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/music"));
    let port: u16 = std::env::var("STACKS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let static_dir = std::env::var("STACKS_STATIC")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/app/static"));

    std::fs::create_dir_all(&data_dir).expect("create data dir");
    let db = Database::open(data_dir.clone()).expect("open db");
    let state = AppState {
        db: Arc::new(db),
        data_dir,
        music_dir: music_dir.clone(),
    };

    if let Ok(tracks) = state.db.get_all_tracks() {
        if tracks.is_empty() && music_dir.exists() {
            eprintln!(
                "Scanning mounted music library at {}…",
                music_dir.display()
            );
            match scan_directory(&state.db, &music_dir) {
                Ok(n) => eprintln!("Indexed {n} tracks"),
                Err(e) => eprintln!("Initial scan failed: {e}"),
            }
        }
    }

    let api = Router::new()
        .route("/api/tracks", get(get_tracks))
        .route("/api/scan", post(scan_library))
        .route("/api/mood/{track_id}", post(set_mood))
        .route("/api/llm/config", get(get_llm).post(set_llm))
        .route("/api/llm/test", post(test_llm))
        .route("/api/llm/providers", get(list_providers))
        .route("/api/normalize/{track_id}", post(normalize_one))
        .route("/api/normalize/low-confidence", post(normalize_batch))
        .route("/api/playlist/build", post(build_queue))
        .route("/api/playlists", get(list_playlists).post(save_playlist))
        .route(
            "/api/playlists/{id}",
            get(playlist_tracks).delete(delete_playlist),
        )
        .route("/api/ingest", post(ingest_youtube).get(list_ingest_jobs))
        .route("/api/ingest/ytdlp", get(ytdlp_status))
        .route("/api/media", get(serve_media))
        .with_state(state);

    let app = Router::new()
        .merge(api)
        .fallback_service(ServeDir::new(static_dir).append_index_html_on_directories(true))
        .layer(CorsLayer::permissive());

    let addr = format!("0.0.0.0:{port}");
    eprintln!("Stacks server listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

#[cfg(feature = "server")]
#[derive(Clone)]
struct AppState {
    db: Arc<Database>,
    data_dir: PathBuf,
    music_dir: PathBuf,
}

#[cfg(feature = "server")]
async fn get_tracks(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let tracks = state.db.get_all_tracks()?;
    Ok(Json(serde_json::to_value(tracks).unwrap()))
}

#[cfg(feature = "server")]
#[derive(Deserialize)]
struct ScanBody {
    path: Option<String>,
}

#[cfg(feature = "server")]
async fn scan_library(
    State(state): State<AppState>,
    Json(body): Json<ScanBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let path = body
        .path
        .map(PathBuf::from)
        .unwrap_or_else(|| state.music_dir.clone());
    let n = scan_directory(&state.db, &path)?;
    Ok(Json(serde_json::json!({ "added": n })))
}

#[cfg(feature = "server")]
#[derive(Deserialize)]
struct MoodBody {
    mood: Option<String>,
}

#[cfg(feature = "server")]
async fn set_mood(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
    Json(body): Json<MoodBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let new_mood = if let Some(m) = body.mood {
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
    Ok(Json(serde_json::json!({ "mood": new_mood })))
}

#[cfg(feature = "server")]
async fn get_llm(State(state): State<AppState>) -> Json<LlmConfig> {
    Json(load_config_from_db(&state.db))
}

#[cfg(feature = "server")]
async fn set_llm(
    State(state): State<AppState>,
    Json(config): Json<LlmConfig>,
) -> Result<StatusCode, ApiError> {
    save_config_to_db(&state.db, &config)?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(feature = "server")]
async fn test_llm(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let config = load_config_from_db(&state.db);
    let client = crate::llm::provider::LlmClient::new(config);
    let msg = client.test_connection().await?;
    Ok(Json(serde_json::json!({ "message": msg })))
}

#[cfg(feature = "server")]
async fn list_providers() -> Json<serde_json::Value> {
    Json(serde_json::json!([
        {"id":"ollama","label":"Ollama (local)","models":["llama3.2:3b","phi3:mini","gemma2:2b","mistral:7b"]},
        {"id":"openai","label":"OpenAI","models":["gpt-4o-mini","gpt-4.1-mini","gpt-4.1-nano"]},
        {"id":"openrouter","label":"OpenRouter","models":["anthropic/claude-3-haiku","google/gemma-2-2b-it","meta-llama/llama-3.2-3b-instruct"]},
        {"id":"gemini","label":"Google Gemini","models":["gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-flash"]}
    ]))
}

#[cfg(feature = "server")]
async fn normalize_one(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let track = state
        .db
        .get_track_by_id(&track_id)?
        .ok_or_else(|| ApiError::not_found("Track not found"))?;
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
    let updated = state.db.get_track_by_id(&track_id)?.unwrap();
    Ok(Json(serde_json::to_value(updated).unwrap()))
}

#[cfg(feature = "server")]
async fn normalize_batch(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let config = load_config_from_db(&state.db);
    let rule_summary = crate::library::enrich::rule_tag_unsorted_tracks(&state.db)?;
    let total = state.db.get_low_confidence_track_ids()?.len() as u32;
    let filename_summary =
        crate::library::enrich::enrich_filename_tracks(&state.db, &config, |_, _, _| {}).await?;
    Ok(Json(serde_json::json!({
        "rule_tagged": rule_summary.tagged,
        "total": total,
        "rule_enriched": filename_summary.rule_enriched,
        "llm_enriched": filename_summary.llm_enriched,
        "failed": filename_summary.failed,
        "last_error": filename_summary.last_error,
    })))
}

#[cfg(feature = "server")]
#[derive(Deserialize)]
struct BuildBody {
    prompt: String,
    use_llm: bool,
}

#[cfg(feature = "server")]
async fn build_queue(
    State(state): State<AppState>,
    Json(body): Json<BuildBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let tracks = state.db.get_all_tracks()?;
    let config = load_config_from_db(&state.db);
    let ids = build_playlist(&config, &tracks, &body.prompt, body.use_llm).await;
    Ok(Json(serde_json::json!({ "track_ids": ids })))
}

#[cfg(feature = "server")]
#[derive(Deserialize)]
struct SavePlaylistBody {
    name: String,
    track_ids: Vec<String>,
    created_from: Option<String>,
}

#[cfg(feature = "server")]
async fn save_playlist(
    State(state): State<AppState>,
    Json(body): Json<SavePlaylistBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let id = state
        .db
        .save_playlist(&body.name, &body.track_ids, body.created_from.as_deref())?;
    Ok(Json(serde_json::json!({ "id": id })))
}

#[cfg(feature = "server")]
async fn list_playlists(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(
        serde_json::to_value(state.db.get_playlists()?).unwrap(),
    ))
}

#[cfg(feature = "server")]
async fn playlist_tracks(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(serde_json::json!({
        "track_ids": state.db.get_playlist_track_ids(&id)?
    })))
}

#[cfg(feature = "server")]
async fn delete_playlist(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.db.delete_playlist(&id)?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(feature = "server")]
#[derive(Deserialize)]
struct IngestBody {
    url: String,
}

#[cfg(feature = "server")]
async fn ingest_youtube(
    State(state): State<AppState>,
    Json(body): Json<IngestBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if !ytdlp::yt_dlp_available(&state.data_dir) {
        return Err(ApiError::bad(
            "yt-dlp not found. Install it in the container or on the host.",
        ));
    }
    let job_id = ingest::create_job(&state.db, &body.url)?;
    let db = state.db.clone();
    let data_dir = state.data_dir.clone();
    let job_id_spawn = job_id.clone();
    let url = body.url;
    tokio::spawn(async move {
        ingest::run_youtube_ingest(db, data_dir, job_id_spawn, url, None, None).await;
    });
    Ok(Json(serde_json::json!({ "job_id": job_id })))
}

#[cfg(feature = "server")]
async fn list_ingest_jobs(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(
        serde_json::to_value(state.db.get_ingest_jobs()?).unwrap(),
    ))
}

#[cfg(feature = "server")]
async fn ytdlp_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "available": ytdlp::yt_dlp_available(&state.data_dir) }))
}

#[cfg(feature = "server")]
#[derive(Deserialize)]
struct MediaQuery {
    path: String,
}

#[cfg(feature = "server")]
async fn serve_media(Query(q): Query<MediaQuery>) -> Result<Response, ApiError> {
    let path = PathBuf::from(&q.path);
    if !path.exists() || !path.is_file() {
        return Err(ApiError::not_found("File not found"));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(
        ext.as_str(),
        "mp3" | "flac" | "m4a" | "opus" | "ogg" | "wav"
    ) {
        return Err(ApiError::bad("Not an audio file"));
    }
    let data = tokio::fs::read(&path)
        .await
        .map_err(|e| ApiError::bad(&e.to_string()))?;
    let content_type = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "opus" | "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        _ => "application/octet-stream",
    };
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .body(Body::from(data))
        .unwrap())
}

#[cfg(feature = "server")]
struct ApiError {
    status: StatusCode,
    message: String,
}

#[cfg(feature = "server")]
impl ApiError {
    fn bad(msg: &str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: msg.to_string(),
        }
    }
    fn not_found(msg: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: msg.to_string(),
        }
    }
}

#[cfg(feature = "server")]
impl From<String> for ApiError {
    fn from(message: String) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message,
        }
    }
}

#[cfg(feature = "server")]
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(serde_json::json!({ "error": self.message })),
        )
            .into_response()
    }
}
