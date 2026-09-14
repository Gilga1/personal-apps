mod commands;
mod library;
mod llm;
mod playlist;

use commands::AppState;
use library::db::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?;
            let db = Database::open(data_dir)?;
            app.manage(AppState {
                db: Arc::new(db),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pick_library_folder,
            commands::scan_library,
            commands::get_tracks,
            commands::set_track_mood,
            commands::get_llm_config,
            commands::set_llm_config,
            commands::test_llm_connection,
            commands::normalize_track,
            commands::normalize_low_confidence,
            commands::build_playlist_queue,
            commands::list_llm_providers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
