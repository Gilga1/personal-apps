use super::config::LlmConfig;
use super::provider::{extract_json_object, LlmClient};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub release_year: Option<i32>,
    pub genre: Option<String>,
    pub moods: Vec<String>,
    pub energy_score: Option<i32>,
    pub situational_tags: Vec<String>,
}

pub async fn normalize_filename(
    config: &LlmConfig,
    raw_name: &str,
) -> Result<NormalizedMetadata, String> {
    let prompt = format!(
        r#"Return JSON only, no prose. Infer artist/album from the filename when possible; use "Unknown artist" only if there is no artist hint.
{{ "title": "", "artist": "", "album": "", "release_year": null, "genre": "",
  "moods": ["Chill & Nostalgic"], "energy_score": 4, "situational_tags": ["nature"] }}

Raw filename: "{raw_name}""#
    );

    let client = LlmClient::new(config.clone());
    let response = client.complete_json(&prompt).await?;
    let json = extract_json_object(&response)?;

    let energy = json["energy_score"].as_i64().map(|v| v as i32);
    if let Some(e) = energy {
        if e < 1 || e > 10 {
            return Err("energy_score out of range".to_string());
        }
    }

    let moods: Vec<String> = json["moods"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let situational_tags: Vec<String> = json["situational_tags"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let title = json["title"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("Missing title in LLM response")?
        .to_string();
    let artist = json["artist"]
        .as_str()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Unknown artist".to_string());

    Ok(NormalizedMetadata {
        title,
        artist,
        album: json["album"]
            .as_str()
            .filter(|s| !s.is_empty())
            .unwrap_or("Unknown album")
            .to_string(),
        release_year: json["release_year"].as_i64().map(|v| v as i32),
        genre: json["genre"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
        moods,
        energy_score: energy,
        situational_tags,
    })
}
