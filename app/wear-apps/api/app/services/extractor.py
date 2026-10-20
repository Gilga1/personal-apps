from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from ..config import Settings
from ..schemas import EventType, ParsedEventDraft, ProvenanceKind

logger = logging.getLogger(__name__)

EXTRACTOR_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "event_type": {
                        "type": "string",
                        "enum": [
                            "hydration",
                            "medication",
                            "habit",
                            "focus",
                            "exercise",
                            "sleep",
                            "vitals",
                        ],
                    },
                    "activity": {
                        "type": "string",
                        "description": (
                            "One of: water, morning_meds, thyroid_med, meds, fat_burner_am, "
                            "fat_burner_pm, isabgol, gym, journal, reading, skincare, "
                            "spine_mobility, topicals, upskill, coding, eat_healthy, "
                            "deep_work, meditation"
                        ),
                    },
                    "value": {"type": "number", "nullable": True},
                    "unit": {"type": "string", "nullable": True},
                    "duration_minutes": {"type": "number", "nullable": True},
                    "boolean_value": {"type": "boolean", "nullable": True},
                    "confidence": {"type": "number"},
                    "provenance_kind": {
                        "type": "string",
                        "enum": ["explicit", "inferred", "defaulted"],
                    },
                    "needs_confirmation": {"type": "boolean"},
                    "confirmation_prompt": {"type": "string", "nullable": True},
                    "metadata": {"type": "object"},
                },
                "required": [
                    "event_type",
                    "activity",
                    "confidence",
                    "provenance_kind",
                    "needs_confirmation",
                ],
            },
        }
    },
    "required": ["events"],
}

SYSTEM_PROMPT = """You convert personal wellness log utterances into structured events.
This is personal logging only — never give medical advice.

Rules:
- One utterance may produce multiple events.
- Prefer activity values from the allowed list.
- morning medicines / morning meds / BP meds with breakfast → morning_meds
- thyroid medicine → thyroid_med
- Do NOT invent quantities. If user says "a glass of water" without ml, set needs_confirmation=true
  unless using default_glass_ml from config is explicitly appropriate; then provenance_kind=defaulted
  and value = glasses * default_glass_ml.
- Ambiguous "I took my tablets/medicine" without which med → needs_confirmation=true.
- Explicit clear habits (spine mobility, skincare, coding, etc.) → boolean_value=true, high confidence.
- deep_work / coding / reading / meditation / gym durations go in duration_minutes when stated.
- Return confidence 0-1.
"""


class UtteranceExtractor:
    def __init__(self, settings: Settings):
        self.settings = settings

    def extract(self, text: str) -> tuple[list[ParsedEventDraft], str]:
        if self.settings.gemini_configured:
            try:
                drafts = self._extract_gemini(text)
                return drafts, f"gemini:{self.settings.gemini_model}"
            except Exception:  # noqa: BLE001
                logger.exception("Gemini extraction failed; using rule fallback")
        drafts = self._extract_rules(text)
        return drafts, "rule_fallback"

    def _extract_gemini(self, text: str) -> list[ParsedEventDraft]:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent"
        )
        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"default_glass_ml={self.settings.default_glass_ml}\n"
                                f"Utterance: {text}"
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
                "responseSchema": EXTRACTOR_SCHEMA,
            },
        }
        with httpx.Client(timeout=45) as client:
            resp = client.post(
                url,
                params={"key": self.settings.gemini_api_key},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        return [self._to_draft(item) for item in parsed.get("events", [])]

    def _to_draft(self, item: dict[str, Any]) -> ParsedEventDraft:
        return ParsedEventDraft(
            event_type=EventType(item["event_type"]),
            activity=item.get("activity"),
            value=item.get("value"),
            unit=item.get("unit"),
            duration_minutes=item.get("duration_minutes"),
            boolean_value=item.get("boolean_value"),
            confidence=float(item.get("confidence", 0.8)),
            provenance_kind=ProvenanceKind(item.get("provenance_kind", "explicit")),
            metadata=item.get("metadata") or {},
            needs_confirmation=bool(item.get("needs_confirmation", False)),
            confirmation_prompt=item.get("confirmation_prompt"),
        )

    def _extract_rules(self, text: str) -> list[ParsedEventDraft]:
        """Deterministic fallback for POC testing without Gemini."""
        t = text.lower().strip()
        drafts: list[ParsedEventDraft] = []

        # Hydration
        ml_match = re.search(r"(\d+(?:\.\d+)?)\s*(ml|millilitres?|milliliters?)", t)
        litre_match = re.search(r"(\d+(?:\.\d+)?)\s*(l|litre|liter|litres|liters)\b", t)
        half_litre = "half a litre" in t or "half a liter" in t or "half litre" in t
        glasses = re.search(r"(\d+)\s+glasses?\s+of\s+water", t)
        if ml_match or litre_match or half_litre or glasses or ("water" in t and "drank" in t):
            value = None
            unit = "ml"
            kind = ProvenanceKind.explicit
            needs = False
            meta: dict[str, Any] = {}
            conf = 0.98
            if ml_match:
                value = float(ml_match.group(1))
            elif litre_match:
                value = float(litre_match.group(1)) * 1000
            elif half_litre:
                value = 500.0
            elif glasses:
                n = int(glasses.group(1))
                value = float(n * self.settings.default_glass_ml)
                kind = ProvenanceKind.defaulted
                meta = {"glasses": n, "ml_per_glass_default": self.settings.default_glass_ml}
                conf = 0.9
            else:
                needs = True
                conf = 0.4
            drafts.append(
                ParsedEventDraft(
                    event_type=EventType.hydration,
                    activity="water",
                    value=value,
                    unit=unit,
                    confidence=conf,
                    provenance_kind=kind,
                    metadata=meta,
                    needs_confirmation=needs or value is None,
                    confirmation_prompt="How much water (ml)?" if needs else None,
                )
            )

        # Medications / habits phrase map
        phrase_map: list[tuple[list[str], EventType, str]] = [
            (["morning medicine", "morning medicines", "morning meds", "morning med"], EventType.medication, "morning_meds"),
            (["thyroid medicine", "thyroid med", "thyroid meds"], EventType.medication, "thyroid_med"),
            (["fat burner am", "morning fat burner"], EventType.medication, "fat_burner_am"),
            (["fat burner pm", "night fat burner"], EventType.medication, "fat_burner_pm"),
            (["isabgol"], EventType.medication, "isabgol"),
            (["spine mobility", "spine stretches"], EventType.habit, "spine_mobility"),
            (["skincare", "skin care"], EventType.habit, "skincare"),
            (["topicals"], EventType.habit, "topicals"),
            (["journal"], EventType.habit, "journal"),
            (["eat healthy", "ate healthy"], EventType.habit, "eat_healthy"),
            (["gym", "worked out", "workout"], EventType.exercise, "gym"),
            (["meditat"], EventType.focus, "meditation"),
            (["coding", "coded"], EventType.focus, "coding"),
            (["reading", "read for"], EventType.focus, "reading"),
            (["upskill"], EventType.focus, "upskill"),
            (["deep work"], EventType.focus, "deep_work"),
        ]

        for phrases, etype, activity in phrase_map:
            if any(p in t for p in phrases):
                duration = None
                dur = re.search(r"(\d+(?:\.\d+)?)\s*(minutes|mins|min|hours|hour|hrs|hr)", t)
                if dur and etype in {EventType.focus, EventType.exercise}:
                    n = float(dur.group(1))
                    unit = dur.group(2)
                    duration = n * 60 if unit.startswith("h") else n
                drafts.append(
                    ParsedEventDraft(
                        event_type=etype,
                        activity=activity,
                        boolean_value=True,
                        duration_minutes=duration,
                        confidence=0.96,
                        provenance_kind=ProvenanceKind.explicit,
                    )
                )

        # Ambiguous meds
        if re.search(r"\b(tablets?|pills?|medicine|medicines|meds)\b", t) and not any(
            d.activity in {"morning_meds", "thyroid_med", "meds", "fat_burner_am", "fat_burner_pm", "isabgol"}
            for d in drafts
        ):
            drafts.append(
                ParsedEventDraft(
                    event_type=EventType.medication,
                    activity="meds",
                    boolean_value=None,
                    confidence=0.55,
                    provenance_kind=ProvenanceKind.inferred,
                    needs_confirmation=True,
                    confirmation_prompt="Which medication? morning_meds, thyroid_med, or meds?",
                )
            )

        if not drafts:
            drafts.append(
                ParsedEventDraft(
                    event_type=EventType.habit,
                    activity=None,
                    confidence=0.2,
                    needs_confirmation=True,
                    confirmation_prompt="Could not parse habit. Please rephrase.",
                    provenance_kind=ProvenanceKind.inferred,
                )
            )
        return drafts
