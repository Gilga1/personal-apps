use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;
use lofty::probe::Probe;
use lofty::tag::Accessor;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedTags {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub duration_sec: Option<f64>,
    pub tag_source: String,
}

pub fn parse_audio_file(path: &Path, folder_name: Option<&str>) -> Result<ParsedTags, String> {
    let embedded = read_embedded_tags(path);
    if let Some(tags) = embedded {
        return Ok(tags);
    }

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    let fallback = parse_filename_fallback(filename, folder_name);
    Ok(ParsedTags {
        title: fallback.title,
        artist: fallback.artist,
        album: fallback.album,
        year: fallback.year,
        genre: fallback.genre,
        duration_sec: read_duration(path),
        tag_source: "filename_fallback".to_string(),
    })
}

fn read_embedded_tags(path: &Path) -> Option<ParsedTags> {
    let tagged_file = Probe::open(path)
        .and_then(|p| p.read())
        .ok()?;
    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag())?;
    let title = tag.title().map(|s| s.to_string());
    let artist = tag.artist().map(|s| s.to_string());
    let album = tag.album().map(|s| s.to_string());
    let genre = tag.genre().map(|s| s.to_string());
    let year = tag.year();

    if title.is_none() && artist.is_none() {
        return None;
    }

    Some(ParsedTags {
        title: title.unwrap_or_else(|| "Unknown title".to_string()),
        artist: artist.unwrap_or_else(|| "Unknown artist".to_string()),
        album: album.unwrap_or_else(|| "Unknown album".to_string()),
        year: year.map(|y| y as i32),
        genre,
        duration_sec: tagged_file.properties().duration().as_secs_f64().into(),
        tag_source: "embedded".to_string(),
    })
}

fn read_duration(path: &Path) -> Option<f64> {
    Probe::open(path)
        .and_then(|p| p.read())
        .ok()
        .map(|f| f.properties().duration().as_secs_f64())
}

#[derive(Debug, Clone)]
pub struct FilenameGuess {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub year: Option<i32>,
    pub genre: Option<String>,
}

pub fn guess_from_filename(filename: &str, folder_name: Option<&str>) -> FilenameGuess {
    let fallback = parse_filename_fallback(filename, folder_name);
    FilenameGuess {
        title: fallback.title,
        artist: fallback.artist,
        album: fallback.album,
        year: fallback.year,
        genre: fallback.genre,
    }
}

struct FilenameFallback {
    title: String,
    artist: String,
    album: String,
    year: Option<i32>,
    genre: Option<String>,
}

fn parse_filename_fallback(filename: &str, folder_name: Option<&str>) -> FilenameFallback {
    let re_bracket = Regex::new(r"^\s*\[[^\]]*\]\s*").unwrap();
    let re_track_num = Regex::new(r"^\s*\d{1,3}[\s._-]+").unwrap();
    let re_www = Regex::new(r"\(www\.[^)]*\)").unwrap();
    let re_leading_dash = Regex::new(r"^-+\s*").unwrap();

    let mut name = filename
        .rsplit_once('.')
        .map(|(n, _)| n)
        .unwrap_or(filename)
        .to_string();
    name = re_bracket.replace(&name, "").to_string();
    name = re_track_num.replace(&name, "").to_string();
    name = re_www.replace_all(&name, "").to_string();
    name = re_leading_dash.replace(&name, "").trim().to_string();

    let folder = folder_name.unwrap_or("Unknown album");
    let mut artist = "Unknown artist".to_string();
    let mut title = name.clone();

    if let Some((a, t)) = name.split_once(" - ") {
        artist = a.trim().to_string();
        title = t.trim().to_string();
    }

    if artist == "Unknown artist" && folder != "Unknown album" {
        artist = folder.to_string();
    }

    FilenameFallback {
        title: if title.is_empty() {
            filename.to_string()
        } else {
            title
        },
        artist,
        album: folder.to_string(),
        year: None,
        genre: None,
    }
}
