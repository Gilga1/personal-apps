"""Canonical activity → Habit Tracker property mapping.

Water and meditation intentionally have no Notion destination yet.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class NotionFieldUpdate:
    property_name: str
    kind: str  # checkbox | number_add | number_set
    value: Any
    note: str | None = None


# activity -> Notion property for boolean habits
CHECKBOX_MAP: dict[str, str] = {
    "morning_meds": "Morning Meds",
    "thyroid_med": "Thyroid Med",
    "meds": "Meds",
    "fat_burner_am": "Fat Burner AM",
    "fat_burner_pm": "Fat Burner PM",
    "isabgol": "Isabgol",
    "gym": "Gym",
    "journal": "Journal",
    "reading": "Reading",
    "skincare": "Skincare",
    "spine_mobility": "Spine Mobility",
    "topicals": "Topicals",
    "upskill": "Upskill",
    "coding": "Coding",
    "eat_healthy": "Eat Healthy",
}

MISSING_NOTION_FIELDS = {
    "water": "Missing destination field: Water",
    "meditation": "Missing destination field: Meditation",
}


def map_event_to_notion(
    *,
    event_type: str,
    activity: str | None,
    boolean_value: bool | None,
    duration_minutes: float | None,
    value: float | None,
) -> NotionFieldUpdate | None:
    act = (activity or "").lower().strip()

    if act in MISSING_NOTION_FIELDS:
        return NotionFieldUpdate(
            property_name="",
            kind="missing",
            value=None,
            note=MISSING_NOTION_FIELDS[act],
        )

    if act == "deep_work" and duration_minutes is not None:
        return NotionFieldUpdate(
            property_name="Deep Work (mins)",
            kind="number_add",
            value=float(duration_minutes),
        )

    if act in CHECKBOX_MAP:
        checked = True if boolean_value is None else bool(boolean_value)
        return NotionFieldUpdate(
            property_name=CHECKBOX_MAP[act],
            kind="checkbox",
            value=checked,
        )

    if event_type == "hydration":
        return NotionFieldUpdate(
            property_name="",
            kind="missing",
            value=value,
            note=MISSING_NOTION_FIELDS["water"],
        )

    return None
