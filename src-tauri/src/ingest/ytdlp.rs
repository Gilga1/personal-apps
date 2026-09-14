use regex::Regex;
use std::path::{Path, PathBuf};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub fn ingest_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("ingest")
}

pub fn local_yt_dlp_path(data_dir: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        data_dir.join("yt-dlp.exe")
    }
    #[cfg(not(windows))]
    {
        data_dir.join("yt-dlp")
    }
}

#[cfg(windows)]
fn hide_window(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(windows)]
fn hide_window_async(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_window(_cmd: &mut std::process::Command) {}

#[cfg(not(windows))]
fn hide_window_async(_cmd: &mut Command) {}

pub fn yt_dlp_available(data_dir: &Path) -> bool {
    let path = local_yt_dlp_path(data_dir);
    if !path.exists() {
        return false;
    }
    let mut cmd = std::process::Command::new(&path);
    cmd.arg("--version");
    hide_window(&mut cmd);
    cmd.output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub async fn ensure_yt_dlp(data_dir: &Path) -> Result<PathBuf, String> {
    if yt_dlp_available(data_dir) {
        return Ok(local_yt_dlp_path(data_dir));
    }

    if YTDLP_SETUP.get().is_some() {
        return Ok(local_yt_dlp_path(data_dir));
    }

    std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    let dest = local_yt_dlp_path(data_dir);

    #[cfg(windows)]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    #[cfg(not(windows))]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

    let bytes = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to download yt-dlp: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    tokio::fs::write(&dest, bytes)
        .await
        .map_err(|e| format!("Failed to save yt-dlp: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&dest)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&dest, perms).map_err(|e| e.to_string())?;
    }

    let _ = YTDLP_SETUP.set(());
    Ok(dest)
}

/// Download audio from a YouTube URL (single video or playlist).
/// Calls `on_progress(percent, message)` as download proceeds.
pub async fn download_audio(
    data_dir: &Path,
    url: &str,
    output_dir: &Path,
    on_progress: impl Fn(f32, &str) + Send + Sync,
) -> Result<Vec<PathBuf>, String> {
    let ytdlp = ensure_yt_dlp(data_dir).await?;

    std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    let output_template = output_dir.join("%(title)s.%(ext)s");
    let mut cmd = Command::new(&ytdlp);
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
    hide_window_async(&mut cmd);

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
