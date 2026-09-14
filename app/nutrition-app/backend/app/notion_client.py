from __future__ import annotations

import re
from datetime import date
from typing import Any

import httpx

from .config import Settings
from .schemas import MealEstimate, MealType
from .food_lookup import calories_from_macros

NOTION_VERSION = "2022-06-28"
MEALS_DATA_SOURCE_ID = "28dcd7f7-f508-47b2-8026-d7f47757033b"
MEAL_TYPE_NAMES = ("Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout")


def _confidence_label(raw: str) -> str:
    mapping = {"high": "High", "medium": "Medium", "low": "Low"}
    return mapping.get(raw.lower(), "Medium")


def _build_notion_title(meal_type: MealType, meal_summary: str) -> str:
    """Format as 'Lunch - Yellow dal' without duplicating the meal type."""
    dish = meal_summary.strip()
    changed = True
    while changed:
        changed = False
        for name in MEAL_TYPE_NAMES:
            pattern = rf"^{re.escape(name)}\s*[-–—:]+\s*"
            cleaned = re.sub(pattern, "", dish, flags=re.IGNORECASE).strip()
            if cleaned != dish:
                dish = cleaned
                changed = True
                break
    if not dish:
        dish = meal_summary.strip()
    return f"{meal_type} - {dish}"[:200]


def _build_notes(estimate: MealEstimate) -> str:
    lines = [estimate.meal_summary, ""]
    for item in estimate.items:
        lines.append(
            f"• {item.item} ({int(item.grams) if item.grams == int(item.grams) else item.grams} g): "
            f"{round(calories_from_macros(item.protein_g, item.carbs_g, item.fat_g))} kcal, "
            f"{item.protein_g:.1f}g protein"
        )
        if item.notes:
            lines.append(f"  {item.notes}")
    lines.append("")
    lines.append(f"Smart tip: {estimate.smart_reduction_tip.tip}")
    if estimate.micros.zinc_mg or estimate.micros.magnesium_mg:
        lines.append(
            f"\nZinc: {estimate.micros.zinc_mg:.1f} mg | "
            f"Magnesium: {estimate.micros.magnesium_mg:.1f} mg"
        )
    if estimate.assumptions:
        lines.append("\nAssumptions: " + "; ".join(estimate.assumptions))
    return "\n".join(lines)


class NotionMealLogger:
    def __init__(self, settings: Settings):
        if not settings.notion_configured:
            raise RuntimeError("Notion is not configured.")
        self.token = settings.notion_api_key
        self.database_id = settings.notion_meals_database_id

    def log_meal(
        self,
        estimate: MealEstimate,
        meal_type: MealType,
    ) -> str:
        title = _build_notion_title(meal_type, estimate.meal_summary)
        m = estimate.micros
        properties: dict[str, Any] = {
            "Name": {"title": [{"text": {"content": title}}]},
            "Date": {"date": {"start": date.today().isoformat()}},
            "Meal Type": {"select": {"name": meal_type}},
            "Protein (g)": {"number": round(estimate.totals.protein_g, 1)},
            "Carbs (g)": {"number": round(estimate.totals.carbs_g, 1)},
            "Fat (g)": {"number": round(estimate.totals.fat_g, 1)},
            "Fiber (g)": {"number": round(m.fibre_g, 1)},
            "Iron (mg)": {"number": round(m.iron_mg, 1)},
            "Calcium (mg)": {"number": round(m.calcium_mg, 0)},
            "Sodium (mg)": {"number": round(m.sodium_mg, 0)},
            "Potassium (mg)": {"number": round(m.potassium_mg, 0)},
            "Sugar (g)": {"number": round(m.sugar_g, 1)},
            "Vitamin C (mg)": {"number": round(m.vitamin_c_mg, 1)},
            "Vitamin D (IU)": {"number": round(m.vitamin_d_iu, 0)},
            "Confidence": {"select": {"name": _confidence_label(estimate.confidence)}},
            "Notes": {
                "rich_text": [{"text": {"content": _build_notes(estimate)[:2000]}}]
            },
        }

        payload = {
            "parent": {"database_id": self.database_id},
            "properties": properties,
        }

        with httpx.Client(timeout=30) as client:
            resp = client.post(
                "https://api.notion.com/v1/pages",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Notion-Version": NOTION_VERSION,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("url", "")
