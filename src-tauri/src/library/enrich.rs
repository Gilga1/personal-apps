use super::db::{Database, Track};
use super::mood::{classify_track_text, map_llm_mood};
use super::tags::guess_from_filename;
use crate::llm::config::LlmConfig;
use crate::llm::normalize::normalize_filename;
use std::path::Path;

pub struct RuleTagSummary {
    pub tagged: u32,
}

pub struct FilenameEnrichSummary {
    pub total: u32,
    pub rule_enriched: u32,
    pub llm_enriched: u32,
    pub failed: u32,
    pub last_error: Option<String>,
}

pub fn rule_tag_unsorted_tracks(db: &Database) -> Result<RuleTagSummary, String> {
    let ids = db.get_unsorted_track_ids()?;
    let mut tagged = 0u32;

    for id in ids {
        if let Some(track) = db.get_track_by_id(&id)? {
            if apply_rules_to_track(db, &track)? {
                tagged += 1;
            }
        }
    }

    Ok(RuleTagSummary { tagged })
}

pub fn apply_rules_to_track(db: &Database, track: &Track) -> Result<bool, String> {
    let classification = classify_track_text(
        &track.title,
        &track.artist,
        &track.album,
        track.genre.as_deref(),
        track.folder_path.as_deref(),
    );

    if classification.mood == "Unsorted" && classification.situational_tags.is_empty() {
        return Ok(false);
    }

    db.apply_rule_tagging(
        &track.id,
        &classification.mood,
        &classification.situational_tags,
        classification.energy_score,
    )?;
    Ok(true)
}

pub async fn enrich_filename_tracks<F>(
    db: &Database,
    config: &LlmConfig,
    mut on_progress: F,
) -> Result<FilenameEnrichSummary, String>
where
    F: FnMut(u32, u32, String),
{
    let ids = db.get_low_confidence_track_ids()?;
    let total = ids.len() as u32;
    let mut rule_enriched = 0u32;
    let mut llm_enriched = 0u32;
    let mut failed = 0u32;
    let mut last_error: Option<String> = None;

    for (i, id) in ids.iter().enumerate() {
        let track = db
            .get_track_by_id(id)?
            .ok_or_else(|| format!("Track not found: {id}"))?;
        on_progress(
            i as u32 + 1,
            total,
            format!("Enriching {} — {}", track.artist, track.title),
        );

        let raw_name = Path::new(&track.file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&track.title);
        let folder_name = Path::new(&track.file_path)
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str());
        let guess = guess_from_filename(raw_name, folder_name);
        let classification = classify_track_text(
            &guess.title,
            &guess.artist,
            &guess.album,
            None,
            folder_name,
        );

        let rule_ok = db
            .apply_rule_metadata_enrichment(
                id,
                &guess.title,
                &guess.artist,
                &guess.album,
                &classification.mood,
                &classification.situational_tags,
                classification.energy_score,
            )
            .is_ok();

        if rule_ok {
            rule_enriched += 1;
        }

        match normalize_filename(config, raw_name).await {
            Ok(normalized) => {
                let mood = normalized
                    .moods
                    .first()
                    .map(|m| map_llm_mood(m))
                    .filter(|m| m != "Unsorted")
                    .unwrap_or_else(|| classification.mood.clone());

                if db
                    .apply_llm_enrichment(
                        id,
                        &normalized.title,
                        &normalized.artist,
                        &normalized.album,
                        normalized.release_year,
                        normalized.genre.as_deref(),
                        &[mood],
                        normalized.energy_score,
                        &merge_tags(&classification.situational_tags, &normalized.situational_tags),
                    )
                    .is_ok()
                {
                    llm_enriched += 1;
                } else if !rule_ok {
                    failed += 1;
                    last_error = Some("Failed to save LLM enrichment".to_string());
                }
            }
            Err(err) => {
                if !rule_ok {
                    failed += 1;
                    last_error = Some(err);
                }
            }
        }
    }

    Ok(FilenameEnrichSummary {
        total,
        rule_enriched,
        llm_enriched,
        failed,
        last_error,
    })
}

fn merge_tags(rule_tags: &[String], llm_tags: &[String]) -> Vec<String> {
    let mut tags = rule_tags.to_vec();
    for tag in llm_tags {
        if !tags.iter().any(|t| t == tag) {
            tags.push(tag.clone());
        }
    }
    tags
}
