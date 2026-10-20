# Canonical Event Model

**Principle:** Domain model is independent of Notion. Notion is a projection / human-facing sync target.

**Date:** 2026-10-20

---

## 1. Design goals

- Typed events with provenance
- Idempotent ingest
- Multi-event utterances
- Corrections / retractions without deleting audit history
- Sensor vs voice vs inferred distinction
- Daily aggregation as a separate layer
- Extensible `event_type` + payload without Notion coupling

---

## 2. Core types

### 2.1 Event envelope

```json
{
  "event_id": "01JABC...uuid_or_ulid",
  "idempotency_key": "watch:galaxy5:client-uuid-or-hash",
  "schema_version": 1,
  "timestamp": "2026-10-20T08:14:22+05:30",
  "timezone": "Asia/Kolkata",
  "local_date": "2026-10-20",
  "event_type": "hydration",
  "activity": "water",
  "source": "gemini_voice",
  "source_detail": {
    "device": "galaxy_watch_5",
    "app_version": "0.1.0",
    "capture_method": "recognizer_intent",
    "model": "gemini-2.5-flash"
  },
  "confidence": 0.98,
  "status": "accepted",
  "raw_input": "I just drank 500 ml of water",
  "value": 500,
  "unit": "ml",
  "duration_minutes": null,
  "boolean_value": null,
  "metrics": {},
  "metadata": {},
  "provenance": {
    "kind": "explicit",
    "parent_utterance_id": "utt_01...",
    "derived_from_event_ids": []
  },
  "correction_of": null,
  "retracted_at": null,
  "created_at": "2026-10-20T08:14:23+05:30",
  "updated_at": "2026-10-20T08:14:23+05:30"
}
```

### 2.2 Status lifecycle

| Status | Meaning |
|--------|---------|
| `pending_confirmation` | Parsed but below confidence threshold or category requires confirm |
| `accepted` | Auto-accepted or user-confirmed |
| `rejected` | User rejected confirmation |
| `corrected` | Superseded by a newer event (`correction_of` points here) |
| `retracted` | Soft-deleted / undone |

### 2.3 Source enum

| Source | Meaning |
|--------|---------|
| `gemini_voice` | Natural language via watch STT → Gemini structure |
| `watch_sensor` | Direct sensor / Health Services sample |
| `watch_health_data` | Aggregated health summary (sleep, steps) |
| `manual` | Explicit UI / API correction |
| `inferred` | Heuristic / model inference (always lower confidence) |
| `system` | Aggregation / migration |

### 2.4 Provenance kind

| Kind | Meaning |
|------|---------|
| `explicit` | User stated it |
| `sensor` | Measured |
| `inferred` | System guessed |
| `defaulted` | Used personal default (e.g. glass = 250 ml) |

---

## 3. Event types (v1 catalog)

| event_type | Typical activity | Primary fields | Notion map (if any) |
|------------|------------------|----------------|---------------------|
| `hydration` | `water` | `value` + `unit` (ml) | **Missing field** — DB only |
| `medication` | `morning_meds`, `thyroid_med`, `meds`, `fat_burner_am`, `fat_burner_pm`, `isabgol` | `boolean_value` | Matching checkbox |
| `habit` | `spine_mobility`, `skincare`, `topicals`, `journal`, `eat_healthy` | `boolean_value` | Matching checkbox |
| `focus` | `deep_work`, `coding`, `reading`, `upskill`, `meditation` | `duration_minutes` | Deep Work → number; others checkbox + DB minutes; meditation **missing** |
| `exercise` | `gym`, `run`, `walk`, … | `duration_minutes`, `metrics` | Gym checkbox |
| `sleep` | `sleep` | `duration_minutes`, `metrics` | DB only initially |
| `vitals` | `heart_rate`, `spo2`, `steps`, … | `value`/`metrics` | DB only |
| `meal` | (future) | relation to Meals | Prefer ThaliScan |
| `utterance` | N/A | `raw_input` only | Audit; may spawn child events |
| `correction` | N/A | `correction_of` | Sync corrected projection |

---

## 4. Multi-event utterances

Utterance stored once; children share `parent_utterance_id`.

```json
{
  "utterance_id": "utt_01",
  "raw_input": "I had two glasses of water and meditated for 20 minutes",
  "events": [
    {
      "event_type": "hydration",
      "value": 500,
      "unit": "ml",
      "provenance": { "kind": "defaulted" },
      "metadata": { "glasses": 2, "ml_per_glass_default": 250 }
    },
    {
      "event_type": "focus",
      "activity": "meditation",
      "duration_minutes": 20
    }
  ]
}
```

Ambiguity policy:
- Exact quantity → accept
- Personal default configured → accept with `kind: defaulted` and slightly lower confidence
- No default → `pending_confirmation`

---

## 5. Confidence policy

| Score | Default action |
|-------|----------------|
| ≥ 0.95 | Auto-accept |
| 0.75–0.94 | Auto-accept for low-risk habits; confirm for meds if ambiguous |
| < 0.75 | Always confirm |
| Any meds with ambiguous name | Confirm mandatory |

High-impact categories requiring confirmation when ambiguous:
- medications (`meds`, “tablets”, unspecified)
- numeric inventing (duration/quantity not stated)

This is **not** a medical system — logging only, no dosing advice.

---

## 6. Idempotency & duplicates

1. Client sends `Idempotency-Key` header (or body field).
2. Server stores unique `(idempotency_key)` → return same `event_id`.
3. Soft duplicate detection: same `local_date` + `event_type` + `activity` + same value within time window → merge or reject based on rules.
4. Checkbox habits: second “I took morning meds” same day is idempotent (already true).
5. Additive metrics (water, deep work minutes): append events; aggregation sums.

---

## 7. Daily aggregation (separate from raw events)

```json
{
  "date": "2026-10-20",
  "timezone": "Asia/Kolkata",
  "habits": {
    "gym": true,
    "morning_meds": true,
    "thyroid_med": true,
    "spine_mobility": true,
    "coding": true
  },
  "totals": {
    "water_ml": 1800,
    "meditation_minutes": 20,
    "deep_work_minutes": 110,
    "coding_minutes": 45,
    "steps": 8432,
    "sleep_minutes": 425,
    "gym_minutes": 52
  },
  "vitals_summary": {
    "resting_hr": null,
    "avg_workout_hr": 121
  },
  "notion_sync": {
    "page_id": "...",
    "last_synced_at": "...",
    "status": "synced"
  }
}
```

Aggregation rules feed Notion mappers; raw events remain authoritative.

---

## 8. Corrections

- Never overwrite original row destructively.
- Create new event with `correction_of = old_event_id`.
- Mark old as `corrected`.
- Re-run aggregation + Notion sync for that `local_date`.

---

## 9. Pydantic sketch (backend)

```python
class EventCreate(BaseModel):
    idempotency_key: str
    timestamp: datetime
    timezone: str
    event_type: EventType
    activity: str | None = None
    source: EventSource
    confidence: float = Field(ge=0, le=1)
    raw_input: str | None = None
    value: float | None = None
    unit: str | None = None
    duration_minutes: float | None = None
    boolean_value: bool | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    parent_utterance_id: str | None = None
```

---

## 10. What does NOT belong in this model

- Raw PPG/accelerometer streams
- Notion property IDs as primary keys
- Medical diagnoses
- Unstructured Gemini chat history as source of truth (store utterance text only as `raw_input`)
