# Personal Apps

A collection of small, private tools. **Each app is a self-contained project on its own branch** — its own dependencies, versions, and build tooling. Nothing is shared at runtime.

This `main` branch is only an index. It has no app code and no `package.json` / `requirements.txt`.

## Apps

| App | Branch | Description |
|-----|--------|-------------|
| **ThaliScan** | [`app/nutrition-app`](https://github.com/Gilga1/personal-apps/tree/app/nutrition-app) | Photo-based calorie estimator for North Indian vegetarian meals |
| **Breathe** | [`app/stress-buster`](https://github.com/Gilga1/personal-apps/tree/app/stress-buster) | Guided breathing exercises with animated cues and haptics |
| **Stacks** | [`app/music-app`](https://github.com/Gilga1/personal-apps/tree/app/music-app) | Local-first desktop music player with mood tags and configurable LLM enrichment |

## Working on an app

Check out the app branch. All code and dependencies for that app live on that branch only:

```bash
git checkout app/nutrition-app   # ThaliScan
git checkout app/stress-buster     # Breathe
git checkout app/music-app         # Stacks
```

Then follow the README on that branch for setup and run instructions.

### Why branches, not folders on main?

Each app can pin different library versions (Node, Python, Rust crates, etc.) without conflicting with the others. `main` stays a lightweight guide — not a monorepo with shared `node_modules` or a root lockfile.

## License

MIT — see [LICENSE](LICENSE).
