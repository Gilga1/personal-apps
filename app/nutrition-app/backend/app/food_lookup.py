from __future__ import annotations

import json
import re
from typing import Any

from openai import OpenAI

from .config import Settings
from .food_db import Per100g, lookup_per_100g
from .schemas import (
    FoodItem,
    FoodLookupRequest,
    FoodLookupResponse,
    MacroTotals,
    MealDecomposeRequest,
    MealDecomposeResponse,
    MealType,
)


def _round(v: float, d: int = 1) -> float:
    p = 10**d
    return round(v * p) / p


def calories_from_macros(protein_g: float, carbs_g: float, fat_g: float) -> float:
    """Matches Notion formula: (Protein × 4) + (Carbs × 4) + (Fat × 9)."""
    return _round(protein_g * 4 + carbs_g * 4 + fat_g * 9)


def _infer_grams(item_name: str, grams: float, calories: float) -> float:
    """Fix vision output that used a count (e.g. 1) instead of grams."""
    if grams >= 15:
        return grams
    matched = lookup_per_100g(item_name)
    if matched and matched[0].calories > 0 and calories > matched[0].calories * 0.2:
        return max(_round(calories / matched[0].calories * 100), grams)
    if grams <= 5 and calories > 40:
        return max(grams, 100.0)
    return grams if grams > 0 else 100.0


def macros_for_grams(per: Per100g, grams: float) -> dict[str, float]:
    factor = grams / 100.0
    protein_g = _round(per.protein_g * factor, 1)
    carbs_g = _round(per.carbs_g * factor, 1)
    fat_g = _round(per.fat_g * factor, 1)
    return {
        "calories": calories_from_macros(protein_g, carbs_g, fat_g),
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
    }


def build_food_item(
    item_name: str,
    grams: float,
    per: Per100g,
    source_label: str,
    notes: str | None = None,
) -> FoodItem:
    macros = macros_for_grams(per, grams)
    return FoodItem(
        item=item_name.strip(),
        grams=grams,
        portion=f"{int(grams) if grams == int(grams) else grams} g",
        calories_per_100g=per.calories,
        protein_per_100g=per.protein_g,
        carbs_per_100g=per.carbs_g,
        fat_per_100g=per.fat_g,
        source=source_label,
        notes=notes,
        **macros,
    )


def normalize_food_item(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure grams + per-100g densities for vision output."""
    item_name = str(raw.get("item", "Unknown"))
    grams = float(raw.get("grams") or 0)
    if grams <= 0:
        portion = str(raw.get("portion", ""))
        m = re.search(r"(\d+(?:\.\d+)?)\s*g", portion.lower())
        grams = float(m.group(1)) if m else 100.0

    cal = float(raw.get("calories", 0))
    protein = float(raw.get("protein_g", 0))
    carbs = float(raw.get("carbs_g", 0))
    fat = float(raw.get("fat_g", 0))

    grams = _infer_grams(item_name, grams, max(cal, calories_from_macros(protein, carbs, fat)))

    if raw.get("calories_per_100g"):
        per_cal = float(raw["calories_per_100g"])
        per_pro = float(raw.get("protein_per_100g", 0))
        per_carb = float(raw.get("carbs_per_100g", 0))
        per_fat = float(raw.get("fat_per_100g", 0))
    elif grams > 0:
        factor = 100.0 / grams
        per_cal = cal * factor
        per_pro = protein * factor
        per_carb = carbs * factor
        per_fat = fat * factor
    else:
        per_cal = per_pro = per_carb = per_fat = 0.0

    portion_factor = grams / 100.0
    protein = _round(per_pro * portion_factor, 1)
    carbs = _round(per_carb * portion_factor, 1)
    fat = _round(per_fat * portion_factor, 1)
    cal = calories_from_macros(protein, carbs, fat)

    return {
        "item": item_name,
        "grams": grams,
        "portion": f"{int(grams) if grams == int(grams) else grams} g",
        "calories": cal,
        "protein_g": protein,
        "carbs_g": carbs,
        "fat_g": fat,
        "calories_per_100g": _round(per_cal),
        "protein_per_100g": _round(per_pro, 1),
        "carbs_per_100g": _round(per_carb, 1),
        "fat_per_100g": _round(per_fat, 1),
        "notes": raw.get("notes"),
        "source": raw.get("source") or "Estimated",
    }


class FoodLookupService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._llm: OpenAI | None = None
        if settings.vision_configured:
            self._llm = OpenAI(
                api_key=settings.vision_api_key,
                base_url=settings.vision_base_url,
            )

    def lookup(self, req: FoodLookupRequest) -> FoodLookupResponse:
        grams = req.grams
        name = req.item.strip()

        matched = lookup_per_100g(name)
        if matched:
            per, db_key = matched
            item = build_food_item(
                name,
                grams,
                per,
                source_label=f"IFCT ({db_key})",
                notes="Indian Food Composition Tables (approx. cooked values)",
            )
            return FoodLookupResponse(item=item, matched_name=db_key)

        if self._llm:
            per = self._llm_per_100g(name)
            item = build_food_item(
                name,
                grams,
                per,
                source_label="AI estimate",
                notes="Estimated per 100g — verify for clinical use",
            )
            return FoodLookupResponse(item=item, matched_name=None)

        raise RuntimeError(
            "Food not in local database and vision API unavailable for lookup."
        )

    def decompose_meal(self, req: MealDecomposeRequest) -> MealDecomposeResponse:
        if not self._llm:
            raise RuntimeError("Vision API not configured for meal decomposition.")

        meal_type = req.meal_type or "Lunch"
        prompt = (
            "Break this North Indian vegetarian meal into components with realistic gram weights.\n"
            "Return JSON only:\n"
            '{"meal_summary": "string", "items": [{"item": "string", "grams": number}]}\n'
            f"Meal: {req.meal_description.strip()}\n"
            f"Meal type: {meal_type}\n"
            "Use typical home portions in grams. Split combined dishes (e.g. boondi raita → boondi + curd)."
        )
        kwargs: dict[str, Any] = {
            "model": self.settings.vision_model,
            "temperature": 0.2,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }
        if self.settings.is_nemotron:
            kwargs["extra_body"] = {
                "chat_template_kwargs": {"enable_thinking": False},
            }
        else:
            kwargs["response_format"] = {"type": "json_object"}

        resp = self._llm.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        raw_items = data.get("items") or []
        items: list[FoodItem] = []
        for raw in raw_items:
            name = str(raw.get("item", "")).strip()
            grams = float(raw.get("grams") or 0)
            if not name or grams <= 0:
                continue
            looked = self.lookup(FoodLookupRequest(item=name, grams=grams))
            items.append(looked.item)

        if not items:
            raise ValueError("Could not decompose meal into food items.")

        protein_g = round(sum(i.protein_g for i in items), 1)
        carbs_g = round(sum(i.carbs_g for i in items), 1)
        fat_g = round(sum(i.fat_g for i in items), 1)
        totals = MacroTotals(
            calories=calories_from_macros(protein_g, carbs_g, fat_g),
            protein_g=protein_g,
            carbs_g=carbs_g,
            fat_g=fat_g,
        )
        summary = str(data.get("meal_summary") or req.meal_description).strip()
        return MealDecomposeResponse(meal_summary=summary, items=items, totals=totals)

    def _llm_per_100g(self, item_name: str) -> Per100g:
        assert self._llm is not None
        prompt = (
            "Return nutrition per 100 grams for this food as JSON only:\n"
            '{"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}\n'
            f"Food: {item_name}\n"
            "Use credible reference values (USDA/IFCT style). Vegetarian only."
        )
        kwargs: dict[str, Any] = {
            "model": self.settings.vision_model,
            "temperature": 0.1,
            "max_tokens": 256,
            "messages": [{"role": "user", "content": prompt}],
        }
        if self.settings.is_nemotron:
            kwargs["extra_body"] = {
                "chat_template_kwargs": {"enable_thinking": False},
            }
        else:
            kwargs["response_format"] = {"type": "json_object"}

        resp = self._llm.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        return Per100g(
            calories=float(data.get("calories", 0)),
            protein_g=float(data.get("protein_g", 0)),
            carbs_g=float(data.get("carbs_g", 0)),
            fat_g=float(data.get("fat_g", 0)),
            source="AI estimate",
        )
