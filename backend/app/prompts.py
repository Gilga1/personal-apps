from __future__ import annotations

import json

from .nutrition import estimate_tdee
from .schemas import MealType, UserProfile

NORTH_INDIAN_VEG_BASE = """
You are a nutrition analyst specializing in **North Indian vegetarian home and restaurant meals**.

Analyze the meal photo and estimate calories, macros, and key micronutrients. Be practical and grounded in typical portions.

## Recognition focus
- Dals, sabzi, roti/chapati/paratha, rice, paneer dishes, curd, raita, pickle, papad

## Portion units — GRAMS ONLY
- Every item MUST include **grams** (integer or one decimal). No katori, count, bowl, or cups.
- Examples: roti ≈ 35–45 g each, 1 katori dal ≈ 150 g, 1 katori rice ≈ 130 g, 1 katori sabzi ≈ 120 g
- Estimate total gram weight visible on the plate

## Estimation rules
1. Account for cooking fat (ghee tadka, oil, cream gravies).
2. Vegetarian only.
3. Include per-100g reference values for each item (calories_per_100g, protein_per_100g, etc.)
4. Estimate micros for the whole meal.
5. Tailor Smart Reduction Tip to user medical conditions if provided.

## Output — JSON only (no markdown):
{
  "meal_summary": "string",
  "items": [
    {
      "item": "string",
      "grams": number,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "calories_per_100g": number,
      "protein_per_100g": number,
      "carbs_per_100g": number,
      "fat_per_100g": number,
      "notes": "string or null"
    }
  ],
  "totals": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number },
  "micros": {
    "fibre_g": number, "calcium_mg": number, "iron_mg": number, "zinc_mg": number,
    "magnesium_mg": number, "sodium_mg": number, "potassium_mg": number,
    "sugar_g": number, "vitamin_c_mg": number, "vitamin_d_iu": number
  },
  "smart_reduction_tip": {
    "tip": "string",
    "estimated_calorie_savings": number or null,
    "estimated_protein_change_g": number or null
  },
  "confidence": "low" | "medium" | "high",
  "assumptions": ["string"]
}

Item macros must match grams × per_100g / 100. Totals must sum items.
""".strip()


def build_system_prompt(
    profile: UserProfile | None = None,
    meal_type: MealType | None = None,
) -> str:
    parts = [NORTH_INDIAN_VEG_BASE]

    if meal_type:
        parts.append(f"\n## Meal context\nThis is logged as: **{meal_type}**.")

    if profile and any(
        [
            profile.height_cm,
            profile.weight_kg,
            profile.age,
            profile.sex,
            profile.conditions,
        ]
    ):
        profile_block = {
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "age": profile.age,
            "sex": profile.sex,
            "activity_level": profile.activity_level,
            "conditions": [c for c in profile.conditions if c != "none"],
        }
        targets = estimate_tdee(profile)
        if targets:
            profile_block["estimated_daily_calories"] = targets.calories
            profile_block["estimated_daily_protein_g"] = targets.protein_g
        parts.append(
            "\n## User profile (personalise tips, not medical advice)\n"
            f"{json.dumps(profile_block, indent=2)}"
        )
        if targets and targets.note:
            parts.append(f"\nCondition notes: {targets.note}")

    return "\n".join(parts)
