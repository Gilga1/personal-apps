use regex::Regex;
use std::path::{Path, PathBuf};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub fn ingest_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("ingest")
}

pub fn yt_dlp_available() -> bool {
    std::process::Command::new("yt-dlp")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Download audio from a YouTube URL (single video or playlist).
/// Calls `on_progress(percent, message)` as download proceeds.
pub async fn download_audio(
    url: &str,
    output_dir: &Path,
    on_progress: impl Fn(f32, &str) + Send + Sync,
) -> Result<Vec<PathBuf>, String> {
    if !yt_dlp_available() {
        return Err(
            "yt-dlp not found. Install it: https://github.com/yt-dlp/yt-dlp#installation".into(),
        );
    }

    std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    let output_template = output_dir.join("%(title)s.%(ext)s");
    let mut cmd = Command::new("yt-dlp");
    cmd.args([
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--progress",
        "--newline",
        "--no-playlist-reverse",
        "-o",
        &output_template.to_string_lossy(),
        url,
    ]);

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let stderr = child.stderr.take().ok_or("No stderr from yt-dlp")?;
    let progress_re = Regex::new(r"\[download\]\s+(\d+(?:\.\d+)?)%").unwrap();
    let mut reader = BufReader::new(stderr).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        if let Some(m) = progress_re.captures(&line) {
            let pct = m[1].parse::<f32>().unwrap_or(0.0);
            on_progress(pct, &line);
        } else if line.contains("[ExtractAudio]") || line.contains("Deleting original") {
            on_progress(95.0, &line);
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("yt-dlp exited with status {}", status));
    }

    on_progress(100.0, "Download complete");

    let files: Vec<PathBuf> = std::fs::read_dir(output_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.is_file()
                && matches!(
                    p.extension().and_then(|x| x.to_str()).map(|x| x.to_lowercase()),
                    Some(ext) if ext == "mp3" || ext == "flac" || ext == "m4a" || ext == "opus"
                )
        })
        .collect();

    if files.is_empty() {
        return Err("No audio files produced by yt-dlp".into());
    }

    Ok(files)
}
