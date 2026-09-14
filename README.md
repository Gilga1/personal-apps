# Stacks

A private, ad-free, local-first desktop music player for mixed FLAC/MP3 collections — Western classical, Bollywood, Punjabi, pop, and everything in between.

**Branch:** `app/music-app` — this branch *is* the Stacks app. Code lives at the branch root (not under an `app/` folder). `main` is a shell-only index.

Stack: **Tauri 2** (desktop) · **Rust** backend · **React + Vite + TypeScript** · optional **Docker** web mode · configurable **LLM** (Ollama, OpenAI, OpenRouter, Gemini).

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

## Run with Docker Desktop (recommended for quick start)

Mount your music folder and open the app in a browser:

```bash
git checkout app/music-app

# Point MUSIC_DIR at a folder of FLAC/MP3 files on your machine
export MUSIC_DIR=/path/to/your/music

docker compose up --build
```

Then open **http://localhost:8080**

| Volume / env | Purpose |
|--------------|---------|
| `MUSIC_DIR` → `/music` | Your library (read-only mount) |
| `STACKS_DATA` → `/data` | SQLite DB + ingest downloads (persisted) |
| `STACKS_LLM_*` / API keys | Optional LLM enrichment |

Example with OpenRouter:

```bash
export MUSIC_DIR=~/Music
export STACKS_LLM_PROVIDER=openrouter
export STACKS_LLM_MODEL=google/gemma-2-2b-it
export OPENROUTER_API_KEY=sk-or-...
docker compose up --build
```

---

## Run as a native desktop app (Tauri)

### Prerequisites

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org/) 18+ | Frontend build |
| [Rust](https://rustup.rs/) | Tauri backend |
| [Tauri prerequisites](https://tauri.app/start/prerequisites/) | Platform libs |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | YouTube import (optional) |
| [Ollama](https://ollama.com/) | Local LLM (optional) |

### Setup

```bash
git checkout app/music-app
npm install
npm run tauri dev
```

### Build installer

```bash
npm run tauri build
```

---

## LLM configuration

Stacks uses LLMs for metadata normalization, mood/energy enrichment, and optional NL playlist re-ranking. All LLM steps degrade gracefully — the app works fully offline without them.

**Settings UI** · **env vars** (`STACKS_LLM_PROVIDER`, `STACKS_LLM_MODEL`, `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY`) · or `~/.config/stacks/config.toml`.

Small 2B-class models work by setting `model` — no code changes required.

---

## Docs

| File | Contents |
|------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data model, pipelines |
| [SPEC.md](./SPEC.md) | Product spec, IPC commands, build phases |

---

## Project structure (branch root)

```
.
├── ARCHITECTURE.md
├── SPEC.md
├── Dockerfile / docker-compose.yml
├── src/                 # React frontend
│   ├── audio/
│   ├── components/
│   └── state/
└── src-tauri/           # Rust backend (Tauri desktop + HTTP server for Docker)
    ├── src/library/
    ├── src/ingest/
    ├── src/llm/
    └── src/playlist/
```
