use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub duration_sec: Option<f64>,
    pub format: String,
    pub tag_source: String,
    pub folder_path: Option<String>,
    pub mood: String,
    pub mood_source: String,
    pub energy_score: Option<i32>,
    pub situational_tags: Vec<String>,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("stacks.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS tracks (
              id            TEXT PRIMARY KEY,
              file_path     TEXT NOT NULL UNIQUE,
              title         TEXT,
              artist        TEXT,
              album         TEXT,
              year          INTEGER,
              genre         TEXT,
              duration_sec  REAL,
              format        TEXT,
              tag_source    TEXT,
              folder_path   TEXT,
              added_at      TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS track_moods (
              track_id      TEXT REFERENCES tracks(id),
              mood          TEXT,
              source        TEXT,
              energy_score  INTEGER,
              PRIMARY KEY (track_id, mood)
            );

            CREATE TABLE IF NOT EXISTS situational_tags (
              track_id      TEXT REFERENCES tracks(id),
              tag           TEXT
            );

            CREATE TABLE IF NOT EXISTS playlists (
              id            TEXT PRIMARY KEY,
              name          TEXT,
              created_from  TEXT,
              created_at    TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS playlist_tracks (
              playlist_id   TEXT REFERENCES playlists(id),
              track_id      TEXT REFERENCES tracks(id),
              position      INTEGER
            );

            CREATE TABLE IF NOT EXISTS ingest_jobs (
              id            TEXT PRIMARY KEY,
              source_url    TEXT,
              status        TEXT,
              output_path   TEXT,
              error         TEXT
            );

            CREATE TABLE IF NOT EXISTS app_settings (
              key   TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn upsert_track(
        &self,
        file_path: &str,
        title: &str,
        artist: &str,
        album: &str,
        year: Option<i32>,
        genre: Option<&str>,
        duration_sec: Option<f64>,
        format: &str,
        tag_source: &str,
        folder_path: Option<&str>,
        mood: &str,
        mood_source: &str,
    ) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM tracks WHERE file_path = ?1",
                params![file_path],
                |row| row.get(0),
            )
            .ok();

        let id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO tracks (id, file_path, title, artist, album, year, genre, duration_sec, format, tag_source, folder_path, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(file_path) DO UPDATE SET
               title = excluded.title,
               artist = excluded.artist,
               album = excluded.album,
               year = excluded.year,
               genre = excluded.genre,
               duration_sec = COALESCE(excluded.duration_sec, tracks.duration_sec),
               format = excluded.format,
               tag_source = excluded.tag_source,
               folder_path = excluded.folder_path",
            params![
                id,
                file_path,
                title,
                artist,
                album,
                year,
                genre,
                duration_sec,
                format,
                tag_source,
                folder_path,
                now
            ],
        )
        .map_err(|e| e.to_string())?;

        let mood_source_existing: Option<String> = conn
            .query_row(
                "SELECT source FROM track_moods WHERE track_id = ?1 LIMIT 1",
                params![id],
                |row| row.get(0),
            )
            .ok();

        if mood_source_existing.as_deref() != Some("manual_override") {
            conn.execute(
                "DELETE FROM track_moods WHERE track_id = ?1",
                params![id],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO track_moods (track_id, mood, source, energy_score) VALUES (?1, ?2, ?3, NULL)",
                params![id, mood, mood_source],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(id)
    }

    pub fn get_all_tracks(&self) -> Result<Vec<Track>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.file_path, t.title, t.artist, t.album, t.year, t.genre,
                        t.duration_sec, t.format, t.tag_source, t.folder_path,
                        COALESCE(m.mood, 'Unsorted'), COALESCE(m.source, 'rule_engine'), m.energy_score
                 FROM tracks t
                 LEFT JOIN track_moods m ON m.track_id = t.id
                 ORDER BY t.artist COLLATE NOCASE, t.album COLLATE NOCASE, t.title COLLATE NOCASE",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<i32>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<f64>>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, Option<String>>(10)?,
                    row.get::<_, String>(11)?,
                    row.get::<_, String>(12)?,
                    row.get::<_, Option<i32>>(13)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut tags_by_track: HashMap<String, Vec<String>> = HashMap::new();
        let mut tags_stmt = conn
            .prepare("SELECT track_id, tag FROM situational_tags")
            .map_err(|e| e.to_string())?;
        let tag_rows = tags_stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for row in tag_rows {
            let (track_id, tag) = row.map_err(|e| e.to_string())?;
            tags_by_track.entry(track_id).or_default().push(tag);
        }

        let mut tracks = Vec::new();
        for row in rows {
            let (
                id,
                file_path,
                title,
                artist,
                album,
                year,
                genre,
                duration_sec,
                format,
                tag_source,
                folder_path,
                mood,
                mood_source,
                energy_score,
            ) = row.map_err(|e| e.to_string())?;

            let situational_tags = tags_by_track.remove(&id).unwrap_or_default();

            tracks.push(Track {
                id,
                file_path,
                title,
                artist,
                album,
                year,
                genre,
                duration_sec,
                format,
                tag_source,
                folder_path,
                mood,
                mood_source,
                energy_score,
                situational_tags,
            });
        }
        Ok(tracks)
    }

    pub fn set_track_mood(&self, track_id: &str, mood: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM track_moods WHERE track_id = ?1",
            params![track_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO track_moods (track_id, mood, source, energy_score) VALUES (?1, ?2, 'manual_override', NULL)",
            params![track_id, mood],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn apply_llm_enrichment(
        &self,
        track_id: &str,
        title: &str,
        artist: &str,
        album: &str,
        year: Option<i32>,
        genre: Option<&str>,
        moods: &[String],
        energy_score: Option<i32>,
        situational_tags: &[String],
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE tracks SET title = ?2, artist = ?3, album = ?4, year = ?5, genre = ?6, tag_source = 'llm_normalized' WHERE id = ?1",
            params![track_id, title, artist, album, year, genre],
        )
        .map_err(|e| e.to_string())?;

        let mood_source: Option<String> = conn
            .query_row(
                "SELECT source FROM track_moods WHERE track_id = ?1 LIMIT 1",
                params![track_id],
                |row| row.get(0),
            )
            .ok();

        if mood_source.as_deref() != Some("manual_override") {
            conn.execute(
                "DELETE FROM track_moods WHERE track_id = ?1",
                params![track_id],
            )
            .map_err(|e| e.to_string())?;
            if let Some(primary) = moods.first() {
                conn.execute(
                    "INSERT INTO track_moods (track_id, mood, source, energy_score) VALUES (?1, ?2, 'llm', ?3)",
                    params![track_id, primary, energy_score],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        conn.execute(
            "DELETE FROM situational_tags WHERE track_id = ?1",
            params![track_id],
        )
        .map_err(|e| e.to_string())?;
        for tag in situational_tags {
            conn.execute(
                "INSERT INTO situational_tags (track_id, tag) VALUES (?1, ?2)",
                params![track_id, tag],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_low_confidence_track_ids(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM tracks WHERE tag_source = 'filename_fallback'")
            .map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(ids)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        ) {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_track_by_id(&self, id: &str) -> Result<Option<Track>, String> {
        let tracks = self.get_all_tracks()?;
        Ok(tracks.into_iter().find(|t| t.id == id))
    }

    // --- Ingest jobs ---

    pub fn create_ingest_job(&self, id: &str, source_url: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ingest_jobs (id, source_url, status, output_path, error) VALUES (?1, ?2, 'queued', NULL, NULL)",
            params![id, source_url],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_ingest_job(
        &self,
        id: &str,
        status: &str,
        output_path: Option<&str>,
        error: Option<&str>,
        progress: Option<f32>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        // progress stored in error field prefix when not an error — use app_settings per job instead
        // Keep it simple: add progress column via migration
        let _ = progress;
        conn.execute(
            "UPDATE ingest_jobs SET status = ?2, output_path = COALESCE(?3, output_path), error = ?4 WHERE id = ?1",
            params![id, status, output_path, error],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_ingest_jobs(&self) -> Result<Vec<IngestJob>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, source_url, status, output_path, error FROM ingest_jobs ORDER BY rowid DESC LIMIT 20",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(IngestJob {
                    id: row.get(0)?,
                    source_url: row.get(1)?,
                    status: row.get(2)?,
                    output_path: row.get(3)?,
                    error: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    // --- Playlists ---

    pub fn save_playlist(
        &self,
        name: &str,
        track_ids: &[String],
        created_from: Option<&str>,
    ) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO playlists (id, name, created_from, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, created_from, now],
        )
        .map_err(|e| e.to_string())?;
        for (pos, track_id) in track_ids.iter().enumerate() {
            conn.execute(
                "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
                params![id, track_id, pos as i32],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(id)
    }

    pub fn get_playlists(&self) -> Result<Vec<PlaylistSummary>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT p.id, p.name, p.created_from, p.created_at,
                        (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id)
                 FROM playlists p ORDER BY p.created_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(PlaylistSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_from: row.get(2)?,
                    created_at: row.get(3)?,
                    track_count: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn get_playlist_track_ids(&self, playlist_id: &str) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT track_id FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position ASC",
            )
            .map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map(params![playlist_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(ids)
    }

    pub fn delete_playlist(&self, playlist_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
            params![playlist_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestJob {
    pub id: String,
    pub source_url: String,
    pub status: String,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistSummary {
    pub id: String,
    pub name: String,
    pub created_from: Option<String>,
    pub created_at: String,
    pub track_count: i32,
}
