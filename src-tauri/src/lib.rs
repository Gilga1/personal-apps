mod ingest;
mod library;
mod llm;
mod playlist;

#[cfg(feature = "desktop")]
mod commands;

#[cfg(feature = "server")]
pub mod server;

#[cfg(feature = "desktop")]
use commands::AppState;
#[cfg(feature = "desktop")]
use library::db::Database;
#[cfg(feature = "desktop")]
use std::sync::Arc;
#[cfg(feature = "desktop")]
use tauri::Manager;

#[cfg(feature = "desktop")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let db = Database::open(data_dir.clone())?;
            app.manage(AppState {
                db: Arc::new(db),
                data_dir,
                ingest_registry: Arc::new(ingest::IngestJobRegistry::default()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pick_library_folder,
            commands::scan_library,
            commands::get_tracks,
            commands::set_track_mood,
            commands::set_tracks_mood,
            commands::get_distinct_tags,
            commands::delete_tag,
            commands::toggle_track_like,
            commands::cancel_ingest,
            commands::get_llm_config,
            commands::set_llm_config,
            commands::test_llm_connection,
            commands::normalize_track,
            commands::normalize_low_confidence,
            commands::build_playlist_queue,
            commands::list_llm_providers,
            commands::ingest_youtube,
            commands::get_ingest_jobs,
            commands::check_ytdlp_available,
            commands::ensure_ytdlp,
            commands::read_audio_bytes,
            commands::get_use_llm_rerank,
            commands::set_use_llm_rerank,
            commands::save_playlist,
            commands::get_playlists,
            commands::get_playlist_tracks,
            commands::delete_playlist,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
