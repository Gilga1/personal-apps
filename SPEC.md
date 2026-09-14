# Stacks — Product & Technical Spec

A private, ad-free, local-first desktop music player for a mixed FLAC/MP3 collection. This document captures the implementation spec for Stacks (`app/music-app` on the `app/music-app` branch), derived from the architecture write-up and the `stacks-cozy` browser prototype.

See also [ARCHITECTURE.md](./ARCHITECTURE.md) for system design and [README.md](./README.md) for setup.

**Repo model:** `main` is a shell-only index (no app code). This branch (`app/music-app`) *is* the Stacks app — code lives at the branch root.

---

## 1. Goals

| Principle | Requirement |
|-----------|-------------|
| Local-first | No account, cloud sync, ads, or telemetry by default. Library, moods, and playlists live on disk. |
| Tolerant ingestion | Accept messy folder trees; extract useful metadata from embedded tags or filename/folder heuristics. |
| Native feel | 60fps turntable/glow animation; fast scans on thousands of tracks via Rust backend. |
| Graceful degradation | App works fully offline; LLM features fall back to rule-based logic when unavailable. |

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri 2 |
| Backend | Rust (`walkdir`, `lofty`, `rusqlite`, `reqwest`) |
| Frontend | React 19 + Vite + TypeScript |
| Styling | Hand-written CSS tokens (cozy fireside theme from prototype) |
| Motion | CSS animations (vinyl, tonearm, glow) + Framer Motion for panel transitions |
| State | Zustand (library, player, settings slices) |
| Audio | HTML5 `<audio>` + Web Audio API `AnalyserNode` |
| Database | SQLite via `rusqlite` |

---

## 3. Configurable LLM layer

LLM calls are used for:

1. **Metadata normalization** — clean up filename-parsed tags for low-confidence tracks.
2. **Mood / energy enrichment** — assign moods, energy score (1–10), situational tags.
3. **Playlist re-ranking** (optional) — semantic ordering of keyword-matched candidates.

### 3.1 Supported providers

| Provider | Default model examples | API key env var |
|----------|------------------------|-----------------|
| `ollama` | `llama3.2:3b`, `phi3:mini`, `gemma2:2b` | none (local) |
| `openai` | `gpt-4o-mini`, `gpt-4.1-mini` | `OPENAI_API_KEY` |
| `openrouter` | `anthropic/claude-3-haiku`, `google/gemma-2-2b-it` | `OPENROUTER_API_KEY` |
| `gemini` | `gemini-2.0-flash`, `gemini-2.0-flash-lite` | `GEMINI_API_KEY` |

Small 2B-class models are supported by setting `model` in config — no code changes required.

### 3.2 Configuration sources (priority order)

1. Runtime settings saved in SQLite `app_settings` table (via Settings UI).
2. Config file: `~/.config/stacks/config.toml`
3. Environment variables:
   - `STACKS_LLM_PROVIDER` — `ollama` \| `openai` \| `openrouter` \| `gemini`
   - `STACKS_LLM_MODEL` — model id string
   - `STACKS_LLM_API_KEY` — shared override
   - `STACKS_LLM_BASE_URL` — optional endpoint override
   - Provider-specific: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_HOST`

### 3.3 Config schema (`config.toml`)

```toml
[llm]
provider = "ollama"
model = "llama3.2:3b"
api_key = ""
base_url = ""

[llm.ollama]
host = "http://localhost:11434"
```

### 3.4 Prompt contracts

**Normalize metadata** (filename_fallback tracks):

```json
{
  "title": "",
  "artist": "",
  "album": "",
  "release_year": null,
  "genre": "",
  "moods": ["", ""],
  "energy_score": 1,
  "situational_tags": ["", ""]
}
```

**Re-rank playlist** (top ~50 candidates):

```json
{ "track_ids": ["id1", "id2", ...] }
```

Responses must be valid JSON. Invalid responses fall back silently to rule-based data.

### 3.5 Failure behavior

- LLM timeout or parse error → keep existing tags/moods; never block playback.
- Missing API key for cloud provider → skip LLM step; surface status in Settings.
- Ollama unreachable → same graceful fallback.

---

## 4. Data model (SQLite)

```sql
tracks (id, file_path, title, artist, album, year, genre, duration_sec,
        format, tag_source, folder_path, added_at)

track_moods (track_id, mood, source, energy_score)

situational_tags (track_id, tag)

playlists (id, name, created_from, created_at)

playlist_tracks (playlist_id, track_id, position)

ingest_jobs (id, source_url, status, output_path, error)

app_settings (key, value)  -- includes llm_config JSON blob
```

### Mood values

`Deep Focus` | `Chill & Nostalgic` | `High Energy` | `Late Night` | `Unsorted` | custom

### Tag sources

`embedded` | `filename_fallback` | `llm_normalized`

---

## 5. Feature pipelines

### 5.1 Library scan

1. User picks a root folder (Tauri dialog).
2. `scanner.rs` walks recursively for `.flac` / `.mp3`.
3. `tags.rs` reads embedded tags via `lofty`; falls back to filename/folder parsing.
4. Rule-based mood classification runs on ingest.
5. Tracks upserted into SQLite; frontend hydrates Zustand cache.
6. Scan progress emitted as Tauri events (`scan-progress`).

### 5.2 Playback & reactive UI

- Singleton `AudioEngine` owns `<audio>` + Web Audio graph.
- `AnalyserNode` drives CSS custom properties (`--glow-opacity`, `--glow-scale`, `--glow-hue`) at 60fps outside React render loop.
- Turntable: vinyl spin + tonearm position tied to play state.

### 5.3 Mood engine

- Keyword table matches `artist + album + folder + genre`.
- First match wins; no match → `Unsorted`.
- Clicking mood pill cycles moods and writes `manual_override` (immune to re-scan).

### 5.4 LLM enrichment

- Target: `tag_source = 'filename_fallback'` or explicit per-track / batch action.
- Response validated; written to DB and optionally back to file tags via `lofty`.

### 5.5 NL playlist assistant

1. Keyword/mood overlap retrieval against SQLite (offline).
2. Optional LLM re-rank of top 50 candidates.
3. Result becomes active play queue.

### 5.6 YouTube ingestion (phase 2)

- `yt-dlp` + `ffmpeg` via `tauri-plugin-shell`.
- Progress events to UI; same metadata pipeline as local files.

---

## 6. UI layout (from prototype)

```
┌─────────────────────────────────────────────────────────┐
│ Stacks                              N tracks loaded     │
├─────────────────────────────────────────────────────────┤
│  [Turntable]     │  Now Playing title / artist / album  │
│  vinyl + glow    │  scrub bar, transport, volume          │
│                  │  mood filter chips                   │
├─────────────────────────────────────────────────────────┤
│  Library: search | Choose folder | Settings             │
│  NL command bar: "Build queue"                          │
│  Track table: title, artist, album, mood, duration      │
└─────────────────────────────────────────────────────────┘
```

Color tokens: `--bg`, `--panel`, `--accent-amber`, `--accent-rust`, `--accent-moss`, `--accent-wine`.

---

## 7. Tauri commands (IPC surface)

| Command | Description |
|---------|-------------|
| `pick_library_folder` | Open native folder dialog |
| `scan_library` | Scan path, populate DB, emit progress |
| `get_tracks` | Return all tracks with moods |
| `set_track_mood` | Manual mood override |
| `get_llm_config` / `set_llm_config` | Read/write LLM settings |
| `test_llm_connection` | Ping configured provider |
| `normalize_track` | LLM-enrich single track |
| `normalize_low_confidence` | Batch LLM for filename_fallback rows |
| `build_playlist` | NL queue builder (keyword + optional LLM) |
| `ingest_youtube` | Start background YouTube download + library ingest |
| `get_ingest_jobs` | List recent ingest jobs |
| `check_ytdlp_available` | Whether yt-dlp is on PATH |
| `save_playlist` / `get_playlists` / `get_playlist_tracks` / `delete_playlist` | Playlist CRUD |

---

## 8. Build phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Tauri scaffold, scanner, tags, SQLite, library UI | **This commit** |
| 2 | Playback engine, turntable, analyser glow | **This commit** |
| 3 | Rule mood engine + manual override in DB | **This commit** |
| 4 | Configurable LLM providers + normalize + NL rerank | **This commit** |
| 5 | YouTube ingestion (`yt-dlp` / `ffmpeg`) | **Done** |
| 6 | Playlists persistence, crossfade, virtualized table | **Done** |

---

## 9. Non-functional targets

- Cold scan ~5,000 files: under a few seconds; stream results to UI.
- 60fps glow on integrated GPU (CSS-variable path, no per-frame React state).
- Fully functional with no network; LLM and YouTube degrade gracefully.
