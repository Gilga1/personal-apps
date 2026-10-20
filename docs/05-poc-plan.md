# POC Plan

**Branch:** `feature/wear-apps`  
**Date:** 2026-10-20  
**Rule:** One vertical slice at a time. No giant app.

---

## Milestone 0 — Research (this document set) ✅

- Repo assessed
- Notion Habit Tracker schema verified
- Capability matrix + technical research written
- Architecture recommendation pending approval

---

## Exact first milestone (after approval)

### Milestone 1 / POC #1 — End-to-end voice habit → Notion

**Objective:** Prove the product spine with a habit that already has a Notion field.

**Primary utterance (Notion-proof):**
> “I took my morning medicines.”

**Secondary utterance (event-DB-proof; Notion optional):**
> “I drank 500 ml of water.”

Why not water-only first? Habit Tracker has **no Water property**. Morning Meds proves Notion sync without schema change.

#### Architecture for POC #1

```
Watch (or curl) → POST /api/utterances
  → Gemini structured events
  → store events
  → if mappable → patch today's Habit Tracker row
```

#### Implementation scope (small)

1. `app/wear-apps/api` FastAPI skeleton  
2. Pydantic event + utterance models  
3. Gemini extractor (JSON schema / structured output)  
4. Postgres (or SQLite local) event store + idempotency  
5. Notion client: find today by Date, patch `Morning Meds`  
6. Minimal Wear OS app in `app/wear-apps/watch`: one button → STT → POST  
7. Device token auth  
8. Manual test script / acceptance checklist  

#### Out of scope

- Sensors, sleep, offline queue polish, insights UI, schema migrations, phone companion

#### Acceptance criteria

- [ ] Saying/sending “I took my morning medicines” creates an `accepted` event  
- [ ] Today’s Habit Tracker `Morning Meds` becomes checked  
- [ ] Other Notion properties unchanged  
- [ ] Repeat with same idempotency key does not duplicate events  
- [ ] Ambiguous “I took my tablets” → `pending_confirmation` (or confirm prompt)  
- [ ] Water utterance stored even with no Notion field (documented gap)  
- [ ] No API keys in watch source  

#### Test procedure

1. Ensure Notion integration has access to Habit Tracker DB  
2. `GET /api/health`  
3. `POST /api/utterances` with morning meds text  
4. Verify DB row + Notion checkbox  
5. Sideload watch APK; tap LOG; speak; verify same  

#### Known limitations

- Consumer Gemini not in the loop  
- Water not visible in Notion  
- Offline queue may be stubbed  
- Render cold starts may add latency  

#### Next step

POC #2 — expand voice habit catalog (Thyroid, Spine, Reading, Coding, …)

---

## Full POC sequence

| POC | Objective | Stop when |
|-----|-----------|-----------|
| **#1** | Voice → events → Notion (Morning Meds) + Water in DB | E2E works from watch |
| **#2** | Habit catalog: Thyroid, Spine, Meds, Fat burners, Isabgol, Journal, Skincare, Topicals, Reading, Coding, Upskill, Eat Healthy, Deep Work mins | All mapped fields update correctly |
| **#3** | Multi-event utterances | One phrase → N events + correct Notion patches |
| **#4** | Health Services: steps, workout → Gym, HR during exercise | Auto Gym after workout |
| **#5** | Sleep + daily vitals summaries | Sleep minutes in event DB |
| **#6** | Daily aggregation job + Notion sync reconciliation | Idempotent daily projection |
| **#7** | AI insights from SQL features | No hallucinated numbers |

---

## Decisions (locked 2026-10-20)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Architecture | **Option B** — Watch app → API → Gemini → Notion |
| 2 | POC #1 Notion target | **Morning Meds** (Water stored in event DB only for now) |
| 3 | Water / Meditation Notion fields | **DB-only** until you explicitly approve schema adds |
| 4 | Create today’s Habit Tracker row if missing | **Yes** |
| 5 | Timezone | **Asia/Kolkata** |
| 6 | Storage / hosting | Design for **Postgres**; SQLite OK for local day-1 |
| 7 | Notion integration | Reuse ThaliScan-style `NOTION_API_KEY`; ensure Habit Tracker is connected |
| 8 | Folder | **`app/wear-apps/`** on `main` (developed on `feature/wear-apps`) |
| 9 | Coupling | Separate from ThaliScan; reuse patterns only |

---

## Definition of product success (from brief)

Raise watch → “I drank 500 ml of water” → structured event stored → Notion updated appropriately → no silent loss → inspect/correct path exists.

**Gap to close for literal success:** Water Notion field decision.  
**Path that unblocks engineering tomorrow:** Morning Meds E2E + Water in canonical DB.
