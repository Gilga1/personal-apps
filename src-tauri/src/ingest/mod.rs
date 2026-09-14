pub mod ytdlp;

use crate::library::db::Database;
use crate::library::ingest_file::ingest_file;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct IngestProgressEvent {
    pub job_id: String,
    pub status: String,
    pub progress: f32,
    pub message: String,
    pub track_id: Option<String>,
}

pub type ProgressCallback = Arc<dyn Fn(IngestProgressEvent) + Send + Sync>;

pub async fn run_youtube_ingest(
    db: Arc<Database>,
    data_dir: PathBuf,
    job_id: String,
    url: String,
    on_progress: Option<ProgressCallback>,
) {
    let emit = |status: &str, progress: f32, message: &str, track_id: Option<String>| {
        let _ = db.update_ingest_job(&job_id, status, None, None, Some(progress));
        if let Some(cb) = &on_progress {
            cb(IngestProgressEvent {
                job_id: job_id.clone(),
                status: status.to_string(),
                progress,
                message: message.to_string(),
                track_id,
            });
        }
    };

    emit("downloading", 0.0, "Starting download…", None);

    let output_dir = ytdlp::ingest_dir(&data_dir).join(&job_id);

    let download_result = ytdlp::download_audio(&url, &output_dir, |pct, msg| {
        emit("downloading", pct, msg, None);
    });

    match download_result.await {
        Err(e) => {
            let _ = db.update_ingest_job(&job_id, "failed", None, Some(&e), Some(0.0));
            emit("failed", 0.0, &e, None);
        }
        Ok(files) => {
            emit("normalizing", 100.0, "Adding to library…", None);
            let mut last_track_id = None;
            for (i, file) in files.iter().enumerate() {
                let msg = format!(
                    "Ingesting {}…",
                    file.file_name()
                        .map(|n| n.to_string_lossy())
                        .unwrap_or_default()
                );
                let pct = 100.0 * (i as f32) / files.len() as f32;
                emit("normalizing", pct, &msg, None);
                if let Ok(track_id) = ingest_file(&db, file) {
                    last_track_id = Some(track_id);
                }
            }
            let output = files.first().map(|p| p.to_string_lossy().to_string());
            let _ = db.update_ingest_job(&job_id, "done", output.as_deref(), None, Some(100.0));
            emit("done", 100.0, "Ingest complete", last_track_id);
        }
    }
}

pub fn create_job(db: &Database, url: &str) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    db.create_ingest_job(&id, url)?;
    Ok(id)
}
