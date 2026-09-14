# Stacks

A private, ad-free, local-first desktop music player for mixed FLAC/MP3 collections — Western classical, Bollywood, Punjabi, pop, and everything in between.

**Branch:** `app/music-app` — you are on the correct branch.

Stack: **Tauri 2** shell · **Rust** backend (library scan, tags, SQLite) · **React + Vite + TypeScript** frontend · configurable **LLM** layer (Ollama, OpenAI, OpenRouter, Gemini).

---

## Features

- Recursive library scan with embedded tag parsing (`lofty`) and filename/folder fallback
- Cozy turntable UI with Web Audio reactive glow and 300ms crossfade
- Rule-based mood classification with manual override
- Configurable LLM providers for metadata normalization and playlist re-ranking
- YouTube ingestion via `yt-dlp` (video or playlist URLs, live progress)
- Saved playlists — save, load, and delete named queues
- Virtualized library table for large collections
- SQLite persistence for tags, moods, playlists, and settings

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org/) 18+ | Frontend build |
| [Rust](https://rustup.rs/) | Tauri backend |
| [Tauri prerequisites](https://tauri.app/start/prerequisites/) | Platform libs (WebKit/GTK on Linux, etc.) |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | YouTube import (optional) |
| [Ollama](https://ollama.com/) | Local LLM (optional) |

---

## Setup

```bash
git checkout app/music-app
cd app/music-app
npm install
```

## Run (desktop)

```bash
npm run tauri dev
```

## Build installer

```bash
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

---

## LLM configuration

Stacks uses LLMs for metadata normalization (filename-parsed tracks), mood/energy enrichment, and optional NL playlist re-ranking. All LLM steps degrade gracefully — the app works fully offline without them.

### Settings UI

Open **Settings** in the app to pick provider, model, and API key.

### Environment variables

```bash
export STACKS_LLM_PROVIDER=openrouter   # ollama | openai | openrouter | gemini
export STACKS_LLM_MODEL=google/gemma-2-2b-it
export OPENROUTER_API_KEY=sk-or-...
```

### Config file

`~/.config/stacks/config.toml`:

```toml
[llm]
provider = "ollama"
model = "gemma2:2b"

[llm.ollama]
host = "http://localhost:11434"
```

Small 2B-class models work by setting `model` — no code changes required.

---

## Docs

| File | Contents |
|------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data model, pipelines |
| [SPEC.md](./SPEC.md) | Product spec, IPC commands, build phases |

---

## Project structure

```
app/music-app/
├── ARCHITECTURE.md      # System architecture
├── SPEC.md              # Product & technical spec
├── src/                 # React frontend
│   ├── audio/           # AudioEngine (crossfade + analyser glow)
│   ├── components/      # Turntable, Library, Ingest, Playlists, Settings
│   └── state/           # Zustand stores
└── src-tauri/           # Rust backend
    ├── src/library/     # scanner, tags, db, mood
    ├── src/ingest/      # yt-dlp pipeline
    ├── src/llm/         # configurable LLM providers
    └── src/playlist/    # NL queue builder
```
