# Stacks

A private, ad-free, local-first desktop music player for mixed FLAC/MP3 collections.

**Branch:** `cursor/stacks-music-app-025e` (or `app/music-app` when merged)

## Features (v0.1)

- Recursive library scan with embedded tag parsing (`lofty`) and filename fallback
- Cozy turntable UI with Web Audio reactive glow
- Rule-based mood classification with manual override
- Configurable LLM providers: **Ollama**, **OpenAI**, **OpenRouter**, **Google Gemini**
- Metadata normalization and optional NL playlist re-ranking
- SQLite persistence for tags, moods, and settings

See [SPEC.md](./SPEC.md) for the full product and technical specification.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- Platform deps for Tauri: https://tauri.app/start/prerequisites/

For local LLM: [Ollama](https://ollama.com/) with a model such as `llama3.2:3b` or `gemma2:2b`.

## Setup

```bash
cd app/music-app
npm install
```

## Run (desktop)

```bash
npm run tauri dev
```

## LLM configuration

### Via Settings UI

Open **Settings** in the app to pick provider, model, and API key.

### Via environment variables

```bash
export STACKS_LLM_PROVIDER=openrouter
export STACKS_LLM_MODEL=google/gemma-2-2b-it
export OPENROUTER_API_KEY=sk-or-...
```

### Via config file

`~/.config/stacks/config.toml`:

```toml
[llm]
provider = "ollama"
model = "gemma2:2b"

[llm.ollama]
host = "http://localhost:11434"
```

## Project structure

```
app/music-app/
├── SPEC.md              # Product & technical spec
├── src/                 # React frontend
│   ├── audio/           # AudioEngine singleton
│   ├── components/      # Turntable, Library, Settings, etc.
│   └── state/           # Zustand stores
└── src-tauri/           # Rust backend
    ├── src/library/     # scanner, tags, db, mood
    ├── src/llm/         # configurable LLM providers
    └── src/playlist/    # NL queue builder
```
