# Architecture Options & Recommendation

**Date:** 2026-10-20  
**Decision status:** Pending your approval

---

## Vision (unchanged)

```
Galaxy Watch 5
    → events (voice + sensors)
        → Personal API
            → Gemini (structure / insights later)
            → PostgreSQL (canonical)
            → Notion Habit Tracker (human-facing)
```

Phone is optional. Notion is not the source of truth.

---

## Options

### Option A — Consumer Gemini → Backend → Notion

```
Hey Gemini on watch → ??? → Personal API → Notion
```

| Pros | Cons |
|------|------|
| Lowest friction UX if it worked | **No official path** for arbitrary personal APIs from consumer Gemini on Watch today |
| No custom app | AppFunctions is Wear OS 7 EAP; Watch 5 currently Wear OS 6 |
| | Assistant App Actions do not cover habit logging |

**Verdict:** Reject for POC #1. Revisit after AppFunctions GA + Wear OS 7 on Watch 5.

---

### Option B — Watch App → Backend → Gemini → Notion ✅ Recommended

```
Tiny Wear OS app
  Tap → RecognizerIntent STT
  HTTPS POST /api/utterances
        ↓
FastAPI
  Gemini structured extraction
  Canonical events (Postgres)
  Notion sync (partial property update)
```

| Pros | Cons |
|------|------|
| Fully under our control | Requires sideload / Play internal track |
| Phone-optional networking (official) | Slightly more UX friction than system Gemini |
| Reuses ThaliScan FastAPI+Notion patterns | Must build tiny watch UI |
| Gemini API tool/schema calling works on backend | |
| Offline queue possible on watch | |

**Verdict:** Best path to a working product now.

---

### Option C — Watch → Phone app → Backend

```
Watch → Bluetooth Data Layer → OnePlus companion → Backend
```

| Pros | Cons |
|------|------|
| Easier debugging on phone | Violates preferred architecture |
| | OnePlus becomes required dependency |
| | Extra app to maintain |

**Verdict:** Reject as core path. Optional later for pairing/setup UI only.

---

### Option D — Backend-only MVP (no watch yet)

```
curl / Postman / phone browser → API → Gemini → Notion
```

| Pros | Cons |
|------|------|
| Proves Notion+event pipeline in hours | Does not prove watch UX |
| | Skips the product’s primary interface |

**Verdict:** Useful as **Milestone 0** (same day as POC #1 backend), then immediately wire watch.

---

### Option E — Future: AppFunctions bridge

```
System Gemini → AppFunctions → Watch app action → Backend
```

Keep domain API stable so this becomes a thin adapter later.

---

## Recommended architecture (phased)

### Phase 0–1 (now)

```
┌─────────────────────┐
│  Wear OS Log App    │  Kotlin + Compose
│  STT → HTTPS queue  │
└──────────┬──────────┘
           │ HTTPS (BT proxy / Wi-Fi)
           ▼
┌─────────────────────┐
│  FastAPI (Render)   │
│  /api/utterances    │
│  /api/events        │
│  /api/notion/sync   │
└──────────┬──────────┘
     ┌─────┴──────┐
     ▼            ▼
 PostgreSQL     Gemini API
 (events)     (structure only)
     │
     ▼
 Notion Habit Tracker
 (checkboxes / Deep Work mins)
```

### Phase 2+ sensors

Add Health Services Passive + ExerciseClient → `/api/events` with `source=watch_sensor`.

### Phase 3+ advanced Samsung SDK

Optional private build with developer mode; partner only if distributing.

### Phase 4 insights

SQL aggregations → Gemini narrative (numbers from DB only).

---

## Notion mapping policy

| Canonical | Notion property | Action |
|-----------|-----------------|--------|
| medication/morning_meds | Morning Meds | set true |
| medication/thyroid_med | Thyroid Med | set true |
| medication/meds | Meds | set true |
| medication/fat_burner_am | Fat Burner AM | set true |
| medication/fat_burner_pm | Fat Burner PM | set true |
| medication/isabgol | Isabgol | set true |
| habit/spine_mobility | Spine Mobility | set true |
| habit/* | matching checkbox | set true |
| focus/deep_work | Deep Work (mins) | add minutes |
| focus/coding, reading, upskill | Coding/Reading/Upskill | set true; minutes in DB |
| focus/meditation | — | **DB only** until you approve field |
| hydration | — | **DB only** until you approve field |
| exercise/gym | Gym | set true |
| formulas/rollups | — | never write |

Daily row resolution:
1. Compute `local_date` in `Asia/Kolkata` (configurable).
2. Query Habit Tracker where Date = that day.
3. If missing: create from template **only if** you approve create-on-miss (recommend yes).
4. Patch only mapped properties; leave others untouched.

---

## Storage challenge: Postgres vs simpler

| Choice | When |
|--------|------|
| SQLite / JSON file | Local laptop POC for a few hours |
| **Postgres on Render** | Preferred as soon as API is deployed — matches your preference + ThaliScan hosting |

**Recommendation:** Design for Postgres; allow SQLite for local-only first day if Render Postgres setup slows POC #1.

---

## Security baseline

- Secrets only in env / Render
- Watch holds rotatable device token, not Gemini/Notion keys
- HTTPS only
- Audit log of Notion writes
- Retention + delete endpoints
- Send Gemini **utterance text + schema**, not full health history dumps

---

## Repo structure (approved)

Separate product under the umbrella, developed on `feature/wear-apps`, destined to live on `main` as:

```
/
├── app/
│   ├── nutrition-app/          # ThaliScan (branch app/nutrition-app)
│   ├── stress-buster/          # Breathe (branch app/stress-buster)
│   └── wear-apps/              # Galaxy Watch life-log (this project)
│       ├── watch/              # Kotlin Wear OS
│       ├── api/                # FastAPI (reuse ThaliScan patterns)
│       └── README.md
├── docs/                       # shared research for wear-apps (this branch)
│   ├── 01-watch-capability-matrix.md
│   ├── 02-event-model.md
│   ├── 03-technical-research.md
│   ├── 04-architecture.md
│   └── 05-poc-plan.md
└── README.md
```

Reuse from ThaliScan: FastAPI layout, env/config style, Notion client patterns, Render deploy habits.  
Keep codebases separate: do not couple processes or share runtime with ThaliScan.

---

## Answers to challenge questions

1. **Need custom Wear OS app?** Yes, for a working personal API path today.  
2. **Can Gemini call our API directly?** Not consumer Gemini on watch. Backend Gemini API yes.  
3. **Cleanest fallback?** Option B (watch STT → API → Gemini).  
4. **Sensors vs voice?** Sensors: gym/steps/sleep/HR. Voice: meds/habits/hydration/focus.  
5. **Reliable auto-log?** Explicit workouts, steps totals, sleep duration (with review).  
6. **Too noisy?** Inferring “deep work”, “eat healthy”, “spine mobility” from motion.  
7. **Postgres?** Yes for durable deploy; SQLite acceptable for hour-0 local.  
8. **Notion human layer?** Yes — keep Habit Tracker; don’t redesign.  
9. **Separate Health DB in Notion?** Optional later; start with event DB only for vitals.  
10. **Smallest proof?** Single utterance water → events table → (optional Notion if field exists) OR morning_meds → checkbox. Prefer **morning_meds** for Notion proof since Water field is missing.  
11. **Hard at scale?** Continuous sensors, battery, sync conflicts, Gemini cost, privacy.  
12. **Battery pain?** Continuous PPG/accel/GPS.  
13. **Samsung approvals?** Sensor SDK public distribution.  
14. **Private prototype?** Sideload + Health Sensor developer mode + Render private service.  
15. **Reusable agent later?** Yes if events API stays clean; AppFunctions becomes an adapter.
