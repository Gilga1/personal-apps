# Wear Apps — Personal Life Log

Voice-first life logging from a Samsung Galaxy Watch 5 into a FastAPI backend, with Notion Habit Tracker sync.

**Branch:** `feature/wear-apps`

## Architecture (POC #1)

```
Watch app (STT) → HTTPS → FastAPI → (Gemini or rules) → SQLite/Postgres → Notion
```

Phone is optional. Notion is a human-facing projection, not the source of truth.

## Quick start — API

```powershell
cd app/wear-apps
copy .env.example .env
# Edit .env: DEVICE_API_TOKEN, optional GEMINI_API_KEY, NOTION_API_KEY

cd api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Health: http://127.0.0.1:8001/api/health

### Smoke test (Morning Meds)

```powershell
$token = "your-device-token"
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:8001/api/utterances `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"text":"I took my morning medicines.","idempotency_key":"test-morning-1","timezone":"Asia/Kolkata"}'
```

Expected:
- event `activity=morning_meds`, `status=accepted`
- Notion today’s **Morning Meds** checked (if `NOTION_API_KEY` is set and Habit Tracker is shared with the integration)
- Water utterances store in the event DB; Notion note says missing Water field

### Other endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | No auth |
| POST | `/api/utterances` | Bearer token |
| GET | `/api/events/today` | Bearer |
| GET | `/api/daily/{date}` | Bearer |
| POST | `/api/events/{id}/confirm` | Bearer |
| POST | `/api/events/{id}/correct` | Bearer |

## Quick start — Watch app

1. Open `app/wear-apps/watch` in Android Studio (Ladybug+ / recent AGP).
2. Copy `gradle.properties.example` values into `gradle.properties` (`API_BASE_URL`, `DEVICE_API_TOKEN`).
3. For a physical Galaxy Watch 5 on the same Tailscale/LAN as your PC:
   - `API_BASE_URL=http://<pc-tailscale-ip>:8001`
4. Enable Developer options + ADB debugging on the watch; `adb connect <watch-ip>:5555`.
5. Run the `app` configuration → install Wear Log.
6. Tap **LOG** → say “I took my morning medicines.”

POC uses cleartext HTTP for local/dev only. Production must be HTTPS.

## Notion setup

1. Use the same Notion integration as ThaliScan (or a new one).
2. **Required:** Open the **Habit Tracker** database (not just Meals) → **⋯ → Connections** → add the integration.  
   Probe showed the current token can read Meals but returns 404 for Habit Tracker until it is shared.
3. Set in `.env`:
   - `NOTION_HABIT_TRACKER_DATABASE_ID=d5ed17f21d704755b028066c8e8d93e2`
   - `NOTION_HABIT_TRACKER_DATA_SOURCE_ID=bd13c6c6-ca63-4ac6-8d55-75ac013b278b`
4. Restart the API and re-send a Morning Meds utterance.

## Acceptance criteria (POC #1)

- [x] API accepts utterance and stores canonical event
- [x] Rule fallback works without Gemini
- [x] Morning Meds maps to Notion checkbox
- [x] Water stored without Notion field change
- [x] Idempotency on utterance key
- [x] Confirm / correct endpoints
- [x] Minimal Wear OS LOG UI
- [ ] End-to-end verified on your Watch 5 + live Notion (your machine)

## Out of scope (later POCs)

Sensors, sleep, multi-event polish, offline queue, AppFunctions, insights.
