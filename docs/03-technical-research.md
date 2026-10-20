# Technical Research

**Date checked:** 2026-10-20  
**Scope:** Galaxy Watch 5, Wear OS, Samsung Health Sensor SDK, Gemini, Notion, Render/Postgres

For each architectural assumption: official support, source, limitations, fallback.

---

## 1. Custom Wear OS app → Watch 5 sensors

| Assumption | Officially supported? | Source | Date | Limitations | Fallback |
|------------|----------------------|--------|------|-------------|----------|
| Custom app can access health/activity sensors | ✅ Yes | [Health Services on Wear OS](https://developer.android.com/health-and-fitness/health-services) | 2026-10-20 | Capability check required per device | Degrade features when unsupported |
| Samsung-unique sensors (PPG raw, SpO2, ECG, BIA, IBI) | ✅ via Samsung Health Sensor SDK | [Samsung Health Sensor SDK overview](https://developer.samsung.com/health/sensor/overview.html), [data specs](https://developer.samsung.com/health/sensor/guide/data-specifications.html) | 2026-10-20 | Watch4+ only; no emulator; capability differs by model/OS | Use Health Services for HR/steps/exercise first |
| Skin temp on Watch 5 | ✅ after Android 13+ watch software | Samsung data specs | 2026-10-20 | Skin ≠ core body temp | Skip if capability false |

---

## 2. Samsung Health Sensor SDK vs Wear OS Health Services

| Topic | Samsung Health Sensor SDK | Wear OS Health Services |
|-------|---------------------------|-------------------------|
| Best for | Raw/advanced: PPG, SpO2, ECG, BIA, IBI, sweat loss | Steps, exercise, HR BPM, sleep/activity state, calories/distance |
| Partner approval for public apps | **Required** — package + SHA-256 registered or `SDK_POLICY_ERROR` | Not required |
| Private POC | Developer mode on Health Sensor Service | Sideload APK / debug |
| Continuous battery cost | High for PPG/accel continuous | Passive monitoring designed for long-running |
| Watch 5 unsupported | EDA, MF-BIA (Watch8+) | N/A |

**Sources:**
- [App verification / partner](https://developer.samsung.com/health/sensor/guide/app-verification.html)
- [Developer mode](https://developer.samsung.com/health/sensor/guide/developer-mode.html)
- [Permissions](https://developer.samsung.com/health/sensor/guide/permission-request.html)
- [HS permissions](https://developer.android.com/health-and-fitness/health-services/permissions)
- SDK release note v1.4.1 (2025-08-20)

**Recommendation:** POC sensors via **Health Services**. Defer Samsung SDK to a later vertical when advanced vitals are needed.

---

## 3. Phone-optional networking

| Assumption | Supported? | Source | Limitations | Fallback |
|------------|------------|--------|-------------|----------|
| Watch can HTTPS without phone app | ✅ | [Network communication](https://developer.android.com/training/wearables/data/network-communication) (updated 2026-09-22) | BT often proxies via phone; Wi-Fi/LTE when phone unavailable | Offline queue + retry |
| Standalone app declaration | ✅ | [Standalone apps](https://developer.android.com/training/wearables/apps/standalone-apps) | Must not require phone for core features if marked standalone | Optional phone for setup UI later |
| Do not use Data Layer for internet | ✅ guidance | Same network doc | Data Layer is device-to-phone, not cloud | OkHttp/Ktor HTTPS to backend |

**Verified principle:** OnePlus phone is **not** required as an application-layer component. It may still provide Bluetooth network proxy — that is transport, not architecture.

---

## 4. Gemini on Watch vs Gemini API

| Assumption | Reality (2026-10-20) | Source | Fallback |
|------------|----------------------|--------|----------|
| Consumer Gemini on Watch can call arbitrary custom HTTPS APIs | ❌ **Not verified / not supported for custom backends** | Consumer help docs describe workouts, timers, health Qs; not open tool calling to personal APIs | Custom watch app |
| Gemini API function calling / structured output | ✅ In **your backend** (or app that holds the API key) | [Function calling](https://ai.google.dev/gemini-api/docs/function-calling), [Tools](https://ai.google.dev/gemini-api/docs/tools) | Structured JSON schema output without tools |
| Assistant App Actions on Wear for arbitrary habits | ❌ Limited / largely unsupported outside China for Voice Actions | [Wear voice input](https://developer.android.com/training/wearables/user-input/voice) — Voice Actions not supported (except China); older Assistant BIIs only exercise start/stop | Custom app STT |
| AppFunctions → Gemini discovers app actions | ⚠️ **Wear OS 7 Early Access** | [What's new in Wear OS 7](https://developer.android.com/blog/posts/what-s-new-in-wear-os-7) (2026-05-19) | Watch for GA; do not block POC |
| Watch 5 OS today | Wear OS 6 / One UI 8 Watch (region-dependent) | Firmware trackers / Samsung rollout news | POC targets Wear OS 6 APIs |
| Watch 5 → Wear OS 7 | Planned for compatible watches by end of 2026 (Samsung One UI 9 Watch messaging) | Industry reporting | Optional future Gemini→AppFunctions path |

**Critical conclusion:** Do **not** design POC #1 as “Hey Gemini → my Render URL”. Design POC #1 as:

`Watch app STT → Personal API → Gemini API (structure) → Postgres → Notion`

Later, AppFunctions may let system Gemini invoke the same watch app action.

---

## 5. Voice capture in a custom Wear OS app

| Method | Supported? | Source | Notes |
|--------|------------|--------|-------|
| `RecognizerIntent.ACTION_RECOGNIZE_SPEECH` | ✅ Recommended | [Voice input](https://developer.android.com/training/wearables/user-input/voice) | Free-form text; system UI; Compose sample exists |
| Continuous `SpeechRecognizer` | ⚠️ Device-dependent | Community reports of “no selected voice recognition service” on some Galaxy watches | Prefer RecognizerIntent for POC |
| Record audio → send to Gemini | ✅ Technically | MediaRecorder + Gemini audio APIs | Heavier; privacy; avoid for POC #1 |

---

## 6. Notion API

| Assumption | Supported? | Source | Notes |
|------------|------------|--------|-------|
| Update checkbox / number / date on daily page | ✅ | [Update page](https://developers.notion.com/reference/patch-page), [property values](https://developers.notion.com/reference/page-property-values) | Omitted properties unchanged — good for partial sync |
| Query data source by Date = today | ✅ | Notion query APIs / MCP already works in this workspace | Need integration connected to Habit Tracker DB |
| Existing Meals relation / rollups | ✅ read; ⚠️ write rollups | Schema verified | Never write formulas/rollups |
| Auto-migrate schema | Possible via API | — | **Out of scope for POC** — propose only |

**Live schema (verified 2026-10-20):** Habit Tracker has no Water or Meditation properties. Meals DB already used by ThaliScan (`collection://28dcd7f7-f508-47b2-8026-d7f47757033b`).

---

## 7. Existing repo / backend patterns

| Finding | Detail |
|---------|--------|
| Umbrella repo | `Personal Apps` — apps under `app/<name>` on dedicated branches |
| ThaliScan | FastAPI + React + Notion Meals + Render (`app/nutrition-app` branch) |
| Notion key | Already used for Meals; Habit Tracker needs same integration sharing |
| This branch | `feature/wear-apps` — greenfield under `app/wear-apps/` |

Reuse: FastAPI style, env secrets, Render deploy patterns. Do **not** couple into ThaliScan process — new service.

---

## 8. Permissions & battery

### Permissions (expected)

| Capability | Permissions |
|------------|-------------|
| Network | `INTERNET`, optionally Wi-Fi change for high bandwidth |
| Voice | Microphone / speech recognition as required by platform |
| Steps / activity | `ACTIVITY_RECOGNITION` |
| Heart rate | `READ_HEART_RATE` (API 36+) or legacy `BODY_SENSORS` |
| Background body sensors | `READ_HEALTH_DATA_IN_BACKGROUND` or `BODY_SENSORS_BACKGROUND` |
| Location (GPS workouts) | `ACCESS_FINE_LOCATION` — avoid until needed |
| Samsung advanced | `READ_ADDITIONAL_HEALTH_DATA` (+ type-specific) |

### Continuity guidance

| Collect continuously? | Metric |
|-----------------------|--------|
| Yes (passive, low rate) | Steps, sleep/activity state |
| During workout only | HR, GPS, calories, pace |
| On demand only | SpO2, ECG, BIA, PPG bursts |
| Never continuous to cloud | Raw PPG, raw accelerometer 25Hz |

---

## 9. Auth on watch

| Approach | Verdict |
|----------|---------|
| Hardcode API key in APK | ❌ Never |
| Long-lived bearer in SharedPreferences | ⚠️ OK for private sideload POC only |
| Short-lived tokens (device pairing via QR on phone/web) | ✅ Recommended for “real” security |
| mTLS device cert | Later / overkill for personal |

**POC #1:** device API token issued once during setup, rotatable, stored in EncryptedSharedPreferences; HTTPS only.

---

## 10. Assumption register (challenge summary)

| # | Assumption | Verdict |
|---|------------|---------|
| 1 | No custom watch app if Gemini exists | **False for POC** — custom app needed |
| 2 | Gemini on watch → custom API | **Unsupported today** |
| 3 | Phone required in architecture | **False** — optional transport/setup |
| 4 | Samsung SDK for all health data | **False** — Health Services first |
| 5 | Postgres required day 1 | **Challengeable** — SQLite OK for first vertical; Postgres for Render deploy |
| 6 | Notion has Water/Meditation | **False** — missing |
| 7 | AppFunctions ready on Watch 5 | **Not yet** — EAP / OS upgrade dependent |
