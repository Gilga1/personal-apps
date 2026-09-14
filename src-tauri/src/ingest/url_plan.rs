use regex::Regex;

pub const MAX_PLAYLIST_TRACKS: u32 = 50;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DownloadPlan {
    pub url: String,
    pub playlist_end: Option<u32>,
    pub single_video_only: bool,
    pub notice: Option<String>,
}

pub fn plan_download(raw_url: &str) -> DownloadPlan {
    let url = raw_url.trim();
    if url.is_empty() {
        return DownloadPlan {
            url: String::new(),
            playlist_end: None,
            single_video_only: false,
            notice: None,
        };
    }

    if is_mix_or_radio(url) {
        let video_url = single_video_url(url).unwrap_or_else(|| url.to_string());
        return DownloadPlan {
            url: video_url,
            playlist_end: None,
            single_video_only: true,
            notice: Some(
                "YouTube Mix/Radio links cannot be imported in full — importing the current video only."
                    .to_string(),
            ),
        };
    }

    if playlist_id(url).is_some() {
        return DownloadPlan {
            url: url.to_string(),
            playlist_end: Some(MAX_PLAYLIST_TRACKS),
            single_video_only: false,
            notice: Some(format!(
                "Importing up to {MAX_PLAYLIST_TRACKS} tracks from this playlist."
            )),
        };
    }

    DownloadPlan {
        url: url.to_string(),
        playlist_end: None,
        single_video_only: false,
        notice: None,
    }
}

pub fn is_mix_or_radio(url: &str) -> bool {
    if url.contains("start_radio=1") {
        return true;
    }

    match playlist_id(url) {
        Some(id) => {
            let upper = id.to_uppercase();
            upper.starts_with("RDMM")
                || upper.starts_with("RD")
                || upper.starts_with("RDMA")
                || upper.starts_with("WL")
                || upper.starts_with("LM")
        }
        None => false,
    }
}

pub fn playlist_id(url: &str) -> Option<String> {
    static LIST_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = LIST_RE.get_or_init(|| Regex::new(r"[?&]list=([^&#]+)").unwrap());
    re.captures(url).map(|caps| caps[1].to_string())
}

pub fn single_video_url(url: &str) -> Option<String> {
    video_id(url).map(|id| format!("https://www.youtube.com/watch?v={id}"))
}

pub fn video_id(url: &str) -> Option<String> {
    static VIDEO_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = VIDEO_RE.get_or_init(|| Regex::new(r"[?&]v=([^&#]+)").unwrap());
    re.captures(url).map(|caps| caps[1].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mix_url_imports_single_video() {
        let plan = plan_download(
            "https://www.youtube.com/watch?v=pKh1wPd07dM&list=RDMMpKh1wPd07dM&start_radio=1",
        );
        assert!(plan.single_video_only);
        assert_eq!(
            plan.url,
            "https://www.youtube.com/watch?v=pKh1wPd07dM"
        );
        assert!(plan.notice.is_some());
    }

    #[test]
    fn regular_playlist_is_capped() {
        let plan = plan_download("https://www.youtube.com/playlist?list=PLabc123");
        assert_eq!(plan.playlist_end, Some(MAX_PLAYLIST_TRACKS));
        assert!(!plan.single_video_only);
    }
}
