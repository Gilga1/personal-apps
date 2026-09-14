# Stacks — Architecture

A private, ad-free, local-first desktop music player for a mixed collection (Western classical, epic instrumentals, Bollywood, Punjabi, pop) spanning FLAC and MP3, organized inconsistently across composer folders, compilation packs, and loose downloads.

---

## 1. Guiding principles

- **Local-first.** No account, no cloud sync, no ads, no telemetry by default. The library, tags, moods, and playlists all live on disk.
- **Tolerant ingestion.** The library is already a mess of folder conventions — the system gets useful metadata out of whatever shape it's in, not require reorganizing files first.
- **Native feel, lean footprint.** 60fps ambient animation and fast library scans on a few thousand tracks, without an Electron-sized install.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2** | ~10–15MB installer vs. Electron's ~85–120MB; uses the OS native webview |
| Backend | **Rust** | Fast recursive directory walks and binary tag parsing; safe process spawning for `yt-dlp` |
| Frontend | **React + Vite + TypeScript** | Fast HMR, small bundle, ecosystem fit for animation/state work |
| Styling | **Hand-written CSS token layer** | Cozy fireside visuals (vinyl, glow) are bespoke CSS, not utility classes |
| Motion | **CSS animations** (vinyl spin, tonearm, glow) | Runs smoothly off the React render loop via CSS custom properties |
| State | **Zustand** | Independent slices (library, player, settings) without Redux ceremony |
| Local DB | **SQLite via `rusqlite`** | Tags, moods, energy scores, situational tags, playlists |
| Audio | **HTML5 `<audio>` + Web Audio API** | Native FLAC/MP3 decode; dual elements for crossfade; `AnalyserNode` drives glow |
| Tag parsing | **`lofty`** | ID3v1/v2, Vorbis comments, cover art across FLAC/MP3 |
| Directory walking | **`walkdir`** | Recursive, symlink-aware, fast |
| YouTube ingestion | **`yt-dlp`** as external process | De facto standard; progress streamed to UI via Tauri events |
| Metadata/mood LLM | **Pluggable providers** | Ollama (local), OpenAI, OpenRouter, Gemini — configurable per model |

---

## 3. Project structure

```
stacks/
├── src-tauri/                        # Rust backend
│   ├── src/
│   │   ├── library/
│   │   │   ├── scanner.rs            # recursive dir walk (walkdir)
│   │   │   ├── tags.rs               # ID3/Vorbis extraction (lofty)
│   │   │   ├── ingest_file.rs        # single-file ingest helper
│   │   │   ├── mood.rs               # rule-based mood classification
│   │   │   └── db.rs                 # SQLite access (rusqlite)
│   │   ├── ingest/
│   │   │   ├── ytdlp.rs              # spawn yt-dlp, parse progress
│   │   │   └── mod.rs                # ingest orchestration + events
│   │   ├── llm/
│   │   │   ├── config.rs             # provider/model configuration
│   │   │   ├── provider.rs           # Ollama, OpenAI, OpenRouter, Gemini
│   │   │   └── normalize.rs          # metadata + mood enrichment
│   │   ├── playlist/
│   │   │   └── query.rs              # NL assistant: keyword retrieval + LLM re-rank
│   │   ├── server.rs                 # HTTP API (Docker / web mode)
│   │   └── commands.rs               # #[tauri::command] IPC (desktop)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                               # React frontend
│   ├── components/
│   │   ├── Turntable/
│   │   ├── NowPlaying/
│   │   ├── Library/
│   │   ├── Ingest/
│   │   ├── Playlists/
│   │   ├── MoodChips/
│   │   ├── CommandBar/
│   │   └── Settings/
│   ├── audio/
│   │   └── AudioEngine.ts
│   ├── state/
│   └── App.tsx
├── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md
├── SPEC.md
└── package.json
```

### State management

- The **audio graph** (`AudioContext`, `AnalyserNode`, dual `MediaElementAudioSourceNode`) lives in a singleton module, not React state. Animation frames push bass/treble energy onto CSS custom properties (`--glow-opacity`, `--glow-scale`, `--glow-hue`), keeping the glow at 60fps.
- **Zustand slices** hold the track list, filters, playback queue, shuffle/crossfade settings, and ingest job status.
- **SQLite** is the source of truth for anything that survives a restart. The Zustand library slice is a cache hydrated from SQLite on launch.

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

app_settings (key, value)   -- includes llm_config JSON blob
```

---

## 5. Feature pipelines

### 5.1 Local ingestion & metadata

1. `scanner.rs` walks the chosen root recursively for `.flac`/`.mp3`.
2. `tags.rs` reads embedded tags via `lofty`; falls back to filename/folder parsing.
3. Rule-based mood classification runs on ingest.
4. Results upserted into `tracks` with `tag_source` recording the confidence path.

### 5.2 Mood classification (rule-based, default)

Keyword table matches against `artist + album + folder + genre`. First match wins; no match → `Unsorted`. Manual overrides (`source = 'manual_override'`) are preserved on re-scan.

### 5.3 LLM metadata normalization & mood enrichment

For `tag_source = 'filename_fallback'` tracks (or on explicit request), the configured LLM provider returns structured JSON with title, artist, album, moods, energy score, and situational tags. Failures fall back silently to rule-based data.

**Configurable providers:** Ollama, OpenAI, OpenRouter, Gemini. Model is a free-form string — small 2B models (e.g. `gemma2:2b`, `google/gemma-2-2b-it`) work without code changes.

### 5.4 YouTube ingestion

1. User pastes a URL into the Ingest panel.
2. `ytdlp.rs` spawns `yt-dlp -x --audio-format mp3` into `app_data/ingest/{job_id}/`.
3. Progress lines are parsed and emitted as `ingest-progress` Tauri events.
4. On completion, files run through the same ingest pipeline as local files.

### 5.5 Natural-language playlist assistant

1. Keyword/mood overlap retrieval against SQLite (offline).
2. Optional LLM re-rank of top ~50 candidates.
3. Result becomes the active play queue; saveable as a named playlist.

---

## 6. Audio engine & reactive UI

- Dual `<audio>` elements with 300ms crossfade (volume ramp, toggleable).
- `AnalyserNode` (`fftSize: 256`) taps the active element for frequency data.
- Each animation frame: bass/treble averages pushed to CSS custom properties.
- When paused, a slow sinusoidal flicker keeps the glow alive without touching the audio graph.

---

## 7. Branch & repo layout

This app lives on the **`app/music-app`** branch of [personal-apps](https://github.com/Gilga1/personal-apps).

**Code is at the branch root** — there is no nested `app/music-app/` folder on this branch.

| Branch | Contents |
|--------|----------|
| `main` | Shell only — umbrella README and LICENSE. No app code. |
| `app/music-app` | Full Stacks source at **branch root** (this branch) |
| `app/nutrition-app` | ThaliScan at branch root |
| `app/stress-buster` | Breathe at branch root |

Each app branch is self-contained: its own lockfiles and runtime deps. Versions do not need to align across apps.

### Deployment modes

| Mode | How |
|------|-----|
| Desktop | `npm run tauri dev` / `tauri build` |
| Docker | `docker compose up --build` — HTTP API + static UI, mount music at `/music` |

---

## 8. Non-functional targets

- Cold scan of ~5,000 mixed FLAC/MP3 files: under a few seconds.
- Steady 60fps on turntable/glow animation (CSS-variable-driven, no per-frame React state).
- Fully functional with no network; LLM and YouTube degrade gracefully.
- No accounts, ads, or telemetry.
