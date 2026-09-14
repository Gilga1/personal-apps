use super::registry::IngestJobRegistry;
use super::url_plan::plan_download;
use regex::Regex;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
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
    let dest = local_yt_dlp_path(data_dir);
    if yt_dlp_available(data_dir) {
        return Ok(dest);
    }

    std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;

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

    Ok(dest)
}

struct ProgressState {
    current_item: u32,
    total_items: u32,
    file_pct: f32,
}

impl ProgressState {
    fn overall_pct(&self) -> f32 {
        if self.total_items == 0 {
            return self.file_pct.clamp(0.0, 100.0);
        }
        let completed = (self.current_item.saturating_sub(1)) as f32;
        let slice = 100.0 / self.total_items as f32;
        (completed * slice + self.file_pct / 100.0 * slice).clamp(0.0, 99.5)
    }

    fn message(&self, detail: &str) -> String {
        if self.total_items > 1 {
            format!(
                "Track {} of {} — {}",
                self.current_item.min(self.total_items),
                self.total_items,
                detail
            )
        } else {
            detail.to_string()
        }
    }
}

fn update_progress(state: &Arc<Mutex<ProgressState>>, line: &str) -> Option<(f32, String)> {
    static ITEM_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    static PCT_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();

    let item_re = ITEM_RE.get_or_init(|| {
        Regex::new(r"\[download\]\s+Downloading item (\d+) of (\d+)").unwrap()
    });
    let pct_re = PCT_RE.get_or_init(|| Regex::new(r"\[download\]\s+(\d+(?:\.\d+)?)%").unwrap());

    let mut st = state.lock().unwrap();

    if let Some(m) = item_re.captures(line) {
        st.current_item = m[1].parse().unwrap_or(st.current_item);
        st.total_items = m[2].parse().unwrap_or(st.total_items);
        st.file_pct = 0.0;
    }

    if let Some(m) = pct_re.captures(line) {
        st.file_pct = m[1].parse().unwrap_or(st.file_pct);
        let msg = st.message(&format!("Downloading {:.0}%", st.file_pct));
        return Some((st.overall_pct(), msg));
    }

    if line.contains("[ExtractAudio]") || line.contains("Deleting original") {
        st.file_pct = 95.0;
        let msg = st.message("Converting audio…");
        return Some((st.overall_pct(), msg));
    }

    if line.contains("ERROR:") || line.contains("error") {
        let msg = st.message(line.trim());
        return Some((st.overall_pct(), msg));
    }

    None
}

/// Download audio from a YouTube URL (single video or playlist).
/// Calls `on_progress(percent, message)` as download proceeds.
pub async fn download_audio(
    data_dir: &Path,
    url: &str,
    output_dir: &Path,
    job_id: &str,
    registry: &IngestJobRegistry,
    on_progress: impl Fn(f32, &str) + Send + Sync,
) -> Result<Vec<PathBuf>, String> {
    let plan = plan_download(url);
    if plan.url.is_empty() {
        return Err("Empty YouTube URL".into());
    }

    if let Some(notice) = &plan.notice {
        on_progress(0.0, notice);
    }

    let ytdlp = ensure_yt_dlp(data_dir).await?;
    std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    let output_template = output_dir.join("%(playlist_index|)s%(title)s.%(ext)s");
    let mut args = vec![
        "-x".to_string(),
        "--audio-format".to_string(),
        "mp3".to_string(),
        "--audio-quality".to_string(),
        "0".to_string(),
        "--progress".to_string(),
        "--newline".to_string(),
        "--no-playlist-reverse".to_string(),
        "--ignore-errors".to_string(),
        "--no-abort-on-error".to_string(),
        "-o".to_string(),
        output_template.to_string_lossy().to_string(),
    ];

    if plan.single_video_only {
        args.push("--no-playlist".to_string());
    } else if let Some(end) = plan.playlist_end {
        args.push("--playlist-end".to_string());
        args.push(end.to_string());
    }

    args.push(plan.url.clone());

    let mut cmd = Command::new(&ytdlp);
    cmd.args(&args);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    hide_window_async(&mut cmd);

    registry.begin(job_id);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let progress_state = Arc::new(Mutex::new(ProgressState {
        current_item: 1,
        total_items: plan.playlist_end.unwrap_or(1),
        file_pct: 0.0,
    }));

    let stderr = child.stderr.take().ok_or("No stderr from yt-dlp")?;
    let stdout = child.stdout.take();
    registry.store_child(job_id, child);

    let read_stderr = async {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if registry.is_cancelled(job_id) {
                break;
            }
            if let Some((pct, msg)) = update_progress(&progress_state, &line) {
                on_progress(pct, &msg);
            }
        }
    };

    let read_stdout = async {
        if let Some(stdout) = stdout {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if registry.is_cancelled(job_id) {
                    break;
                }
                if let Some((pct, msg)) = update_progress(&progress_state, &line) {
                    on_progress(pct, &msg);
                }
            }
        }
    };

    tokio::join!(read_stderr, read_stdout);

    if registry.is_cancelled(job_id) {
        registry.finish(job_id);
        return Err("Import cancelled".into());
    }

    let status = registry.wait_child(job_id).await?;
    registry.finish(job_id);

    if !status.success() {
        let files = collect_audio_files(output_dir);
        if files.is_empty() {
            return Err(
                "yt-dlp failed — YouTube may require sign-in, or the link is unavailable.".into(),
            );
        }
    }

    on_progress(100.0, "Download complete");

    let files = collect_audio_files(output_dir);
    if files.is_empty() {
        return Err("No audio files produced by yt-dlp".into());
    }

    Ok(files)
}

fn collect_audio_files(output_dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(output_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.is_file()
                && matches!(
                    p.extension().and_then(|x| x.to_str()).map(|x| x.to_lowercase()),
                    Some(ext) if ext == "mp3" || ext == "flac" || ext == "m4a" || ext == "opus"
                )
        })
        .collect()
}

pub use super::url_plan::plan_download as build_download_plan;
