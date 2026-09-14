# Breathe (Stress Buster)

Guided breathing exercises with an animated ring, sound cues, and haptic feedback. Pick a pattern (4-4-8, box breathing, 4-7-8), tap to start, and follow the on-screen cues.

Stack: **React (Vite)** frontend only — no backend required.

---

## Run locally

```powershell
cd app/stress-buster/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5174
```

Or use the helper script from the repo root:

```powershell
app\stress-buster\scripts\start-frontend.bat
```

Open [http://127.0.0.1:5174](http://127.0.0.1:5174) on your PC, or your machine's LAN IP on a phone.

---

## Features

- **Breathing patterns** — Relax 4-4-8, Box 4-4-4-4, Calm 4-7-8
- **Animated ring** — visual guide for inhale, hold, and exhale phases
- **Sound cues** — optional audio at phase transitions
- **Haptics** — optional vibration on supported devices
- **Mobile-first** — works well on phone browsers

---

## Build for production

```powershell
cd app/stress-buster/frontend
npm run build
npm run preview
```

Static output is in `frontend/dist/` — deploy to any static host (Render, Netlify, GitHub Pages, etc.).
