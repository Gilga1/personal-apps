# Personal Apps

A collection of small, private tools. **Each app is a self-contained project on its own branch** — its own dependencies, versions, and build tooling. Nothing is shared at runtime.

This `main` branch is only an index. It has no `app/` folder, no app code, and no shared lockfiles.

## Apps

| App | Branch | Description |
|-----|--------|-------------|
| **ThaliScan** | [`app/nutrition-app`](https://github.com/Gilga1/personal-apps/tree/app/nutrition-app) | Photo-based calorie estimator for North Indian vegetarian meals |
| **Breathe** | [`app/stress-buster`](https://github.com/Gilga1/personal-apps/tree/app/stress-buster) | Guided breathing exercises with animated cues and haptics |
| **Stacks** | [`app/music-app`](https://github.com/Gilga1/personal-apps/tree/app/music-app) | Local-first desktop music player with mood tags and configurable LLM enrichment |

## Working on an app

Check out the app branch. **The app code is at the branch root** (not nested under `app/<name>/`):

```bash
git checkout app/nutrition-app   # ThaliScan → backend/, frontend/ at root
git checkout app/stress-buster     # Breathe → frontend/ at root
git checkout app/music-app         # Stacks → src/, src-tauri/, Dockerfile at root
```

Then follow that branch's README for setup and run instructions.

### Branch layout

```
main/                  ← this index only (README, LICENSE)
app/music-app/         ← Stacks lives at THIS branch's root
app/nutrition-app/     ← ThaliScan at that branch's root
app/stress-buster/     ← Breathe at that branch's root
```

### Why separate branches?

Each app can pin different library versions without conflicting. Checking out one branch never pulls another app's code or dependencies.

## License

MIT — see [LICENSE](LICENSE).
