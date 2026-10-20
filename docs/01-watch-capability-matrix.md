# Watch Capability Matrix

**Project:** Life Logging / Personal Health Intelligence  
**Device:** Samsung Galaxy Watch 5 (Wear OS / One UI Watch)  
**Notion target:** Habit Tracker `collection://bd13c6c6-ca63-4ac6-8d55-75ac013b278b`  
**Date checked:** 2026-10-20  
**Status:** Research only — no schema changes applied

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Officially supported / recommended for POC |
| ⚠️ | Possible with caveats (noisy, on-demand, partner, battery) |
| ❌ | Not detectable / not appropriate |
| 🔒 | Requires Samsung partner registration for public distribution |
| 🧪 | Safe for private POC (sideload / developer mode) |

**Confidence:** High / Medium / Low for automatic logging without confirmation.

---

## A. Existing Habit Tracker fields

Verified live schema via Notion MCP (2026-10-20). Writable properties only unless noted.

| Field | Type | Watch sensor? | Sensor / API | Samsung Health Sensor SDK | Wear OS Health Services | Continuity | Inferable? | Gemini / voice | Confirm? | Confidence | Recommended source | Update strategy |
|-------|------|---------------|--------------|---------------------------|-------------------------|------------|------------|----------------|----------|------------|---------------------|-----------------|
| **Date** | date | N/A | Device clock + TZ | N/A | N/A | Always | N/A | N/A | No | High | Device local date | Resolve local calendar day; find/create daily row |
| **Name** | title | N/A | N/A | N/A | N/A | N/A | N/A | N/A | No | High | Backend default | Keep template title; do not overwrite casually |
| **Gym** | checkbox | ✅ / ⚠️ | ExerciseClient workout / Samsung Health | ❌ not needed | ✅ Exercise / Passive | On workout | Yes (strength / gym exercise type) | Optional | Optional if auto-detected | Medium→High if workout type known | Health Services exercise session | Auto-check when strength/gym workout ends; voice override OK |
| **Deep Work (mins)** | number | ❌ | None reliable | ❌ | ❌ | N/A | ⚠️ weak (phone usage ≠ deep work) | ✅ start/stop or duration | Yes if ambiguous | High after explicit | Voice / explicit timer | Increment or set; never invent duration |
| **Eat Healthy** | checkbox | ❌ | None | ❌ | ❌ | N/A | ⚠️ meal quality subjective | ✅ | Yes (subjective) | Medium | Voice | Checkbox; meal details stay in Meals DB via ThaliScan |
| **Fat Burner AM** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional if exact phrase | High if named | Voice | Checkbox |
| **Fat Burner PM** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional if named | High if named | Voice | Checkbox |
| **Isabgol** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional | High if named | Voice | Checkbox |
| **Journal** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional | High | Voice | Checkbox (content stays in Notion page body if any) |
| **Meds** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Prefer confirm if generic “meds” | Medium–High | Voice | Checkbox; distinguish from Morning/Thyroid |
| **Morning Meds** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional if exact | High | Voice | Checkbox (BP + Vit E + Ashwagandha per schema description) |
| **Reading** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional | High | Voice | Checkbox; duration can live in event DB only |
| **Skincare** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional | High | Voice | Checkbox |
| **Spine Mobility** | checkbox | ❌ | None reliable | ❌ | ⚠️ activity noise | N/A | ⚠️ poor | ✅ | Optional | High | Voice | Checkbox (schema: 15 min cervical/thoracic) |
| **Thyroid Med** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional if exact | High | Voice | Checkbox (empty-stomach timing is user habit, not enforced) |
| **Topicals** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional | High | Voice | Checkbox |
| **Upskill** | checkbox | ❌ | None | ❌ | ❌ | N/A | ❌ | ✅ | Optional | High | Voice | Checkbox |
| **Coding** | checkbox | ❌ | None | ❌ | ❌ | N/A | ⚠️ weak | ✅ | Optional | High | Voice | Checkbox; duration in event DB |
| **Meals** | relation | ❌ direct | ThaliScan / Meals DB | ❌ | ❌ | N/A | N/A | Optional | N/A | High via ThaliScan | Existing nutrition app | Do not duplicate meal logging in POC #1 |
| **Calories** | rollup | ❌ write | Derived from Meals | ❌ | ❌ | N/A | N/A | ❌ | N/A | N/A | Read-only | Never write |
| **Protein Rollup (g)** | rollup | ❌ write | Derived | ❌ | ❌ | N/A | N/A | ❌ | N/A | N/A | Read-only | Never write |
| **Calories Rollup (g)** | formula | ❌ write | Derived | ❌ | ❌ | N/A | N/A | ❌ | N/A | N/A | Read-only | Never write |
| **Calorie Delta** | formula | ❌ write | Derived | ❌ | ❌ | N/A | N/A | ❌ | N/A | N/A | Read-only | Never write |
| **Habits Done** | formula | ❌ write | Derived | ❌ | ❌ | N/A | N/A | ❌ | N/A | N/A | Read-only | Never write |
| **Progress Bar** | formula | ❌ write | Derived | ❌ | ❌ | N/A | N/A | ❌ | N/A | N/A | Read-only | Never write |

### Fields mentioned in vision but **missing** from Habit Tracker schema

| Desired habit | In Notion today? | Recommendation |
|---------------|------------------|----------------|
| **Water / hydration** | ❌ No property | Keep in canonical event DB for POC #1; propose `Water (ml)` number later — **do not auto-add** |
| **Meditation** | ❌ No property | Same; propose `Meditation (mins)` number later |
| Duration for Reading / Coding / Upskill | ❌ Only checkboxes | Store minutes in event DB; checkbox = “did today” |

---

## B. New Watch-derived metrics worth adding

| Metric | Watch 5 capable? | Primary API | Samsung SDK needed? | Partner for prod? | Continuous? | Battery impact | Safe for POC? | Worth tracking? | Notes |
|--------|------------------|-------------|---------------------|-------------------|-------------|----------------|---------------|-----------------|-------|
| Heart rate (BPM) | ✅ | Health Services Measure/Passive; or Samsung HR continuous | Optional | 🔒 if Samsung SDK | Spot or passive | Medium if continuous | 🧪 yes (HS preferred) | Yes (daily aggregates) | Prefer Health Services first |
| Resting HR | ⚠️ | Derived / Samsung Health history | Often via Health data, not raw SDK | Depends | Daily summary | Low if nightly | Later | Yes | Prefer daily summary over raw stream |
| IBI / HRV-derived | ✅ via Samsung | Samsung `HEART_RATE_CONTINUOUS` includes IBI | ✅ | 🔒 prod / 🧪 dev mode | Continuous while tracking | High | 🧪 | Later (insights) | Not for Notion daily row |
| PPG (raw green/IR/red) | ✅ | Samsung PPG continuous/on-demand | ✅ | 🔒 | Continuous = heavy | Very high | 🧪 only | No for v1 | Research/raw only |
| SpO2 | ✅ on-demand | Samsung `SPO2_ON_DEMAND` | ✅ | 🔒 | On-demand ≤30s | Medium burst | 🧪 | Optional | Foreground only per Samsung guide |
| ECG | ✅ on-demand | Samsung `ECG_ON_DEMAND` | ✅ | 🔒 | On-demand | Medium burst | 🧪 | Optional | User-initiated; not medical |
| Skin temperature | ✅ (Watch5 + Android 13+) | Samsung skin temp continuous/on-demand | ✅ | 🔒 | Continuous possible | Medium–High | 🧪 | Later | Skin ≠ body temp |
| Body composition / BIA | ✅ on-demand | Samsung `BIA_ON_DEMAND` | ✅ | 🔒 | On-demand | Medium | 🧪 | Optional weekly | Not daily habit field |
| Steps | ✅ | Health Services Passive | ❌ | No | Daily / passive | Low | ✅ | Yes | Aggregate daily |
| Movement / activity state | ✅ | Health Services UserActivityInfo | ❌ | No | Passive | Low | ✅ | Yes | Asleep / exercise / idle |
| Exercise duration | ✅ | ExerciseClient | ❌ | No | During workout | Medium | ✅ | Yes → Gym | Auto Gym checkbox |
| Exercise intensity / calories | ✅ | ExerciseClient metrics | ❌ | No | During workout | Medium | ✅ | Event DB | Not Notion calories (meals) |
| Sleep | ⚠️ | Passive UserActivity ASLEEP / Samsung Health | Prefer HS first | No for HS | Overnight | Low–Medium | ✅ | Yes | Duration in event DB |
| GPS / location | ⚠️ | ExerciseClient + fine location | ❌ | No | During outdoor exercise | High | Later | Optional | Privacy-sensitive |
| Altitude / barometer | ⚠️ | Health Services elevation | ❌ | No | During exercise | Medium | Later | Optional | |
| Accelerometer raw | ✅ | Samsung ACC continuous or Android Sensor | Samsung for 25Hz SDK path | 🔒 Samsung path | Continuous 25Hz | Very high | 🧪 | No for v1 | Do not stream to cloud |
| Gyroscope / orientation | ✅ | Android SensorManager | ❌ | No | On demand | High if continuous | Later | No for habits | |
| Sweat loss | ⚠️ post-run | Samsung `SWEAT_LOSS` | ✅ | 🔒 | After running | Low | Later | Optional | Running-specific |
| EDA / MF-BIA | ❌ on Watch 5 | Watch8+ only | N/A | N/A | N/A | N/A | N/A | No | Unsupported on Watch 5 |

---

## C. Source decision rules (summary)

1. **Voice-first for habits the watch cannot know** (meds, skincare, reading, coding, journal, topicals, fat burners, isabgol, eat healthy, spine mobility).
2. **Health Services first for activity/sleep/HR aggregates** — no Samsung partner required.
3. **Samsung Health Sensor SDK only when Health Services cannot provide the signal** (raw PPG, SpO2, ECG, BIA, IBI streams) — private POC via developer mode; partner before any store distribution.
4. **Never auto-log ambiguous quantities** (“some water”, “a glass”) without personal defaults or confirmation.
5. **Notion gets daily summaries / checkboxes only** — never raw sensor streams.

---

## D. Quick mapping: vision examples → reality

| Example | Sensor? | Voice? | Notes |
|---------|---------|--------|-------|
| Gym | Yes (workout) | Optional | Prefer exercise session end → Gym=true |
| Morning Meds | No | Yes | High confidence if named |
| Water | No | Yes | **No Notion field yet** — event DB only until you approve a property |
| Deep Work | No | Yes | Explicit duration or start/stop |
