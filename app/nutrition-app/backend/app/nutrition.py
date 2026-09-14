from __future__ import annotations

from .schemas import ActivityLevel, DailyTargets, Sex, UserProfile

ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

BMI_HEALTHY_MIN = 18.5
BMI_HEALTHY_MAX = 24.9


def _bmr(profile: UserProfile) -> float | None:
    if not all([profile.height_cm, profile.weight_kg, profile.age, profile.sex]):
        return None
    weight = profile.weight_kg or 0
    height = profile.height_cm or 0
    age = profile.age or 0
    if profile.sex == "male":
        return 10 * weight + 6.25 * height - 5 * age + 5
    return 10 * weight + 6.25 * height - 5 * age - 161


def estimate_tdee(profile: UserProfile) -> DailyTargets | None:
    bmr = _bmr(profile)
    if bmr is None:
        return None

    multipliers = list(ACTIVITY_MULTIPLIERS.values())
    calories_min = round(bmr * min(multipliers))
    calories_max = round(bmr * max(multipliers))
    calories = round(bmr * ACTIVITY_MULTIPLIERS.get(profile.activity_level, 1.55))

    protein_g = round((profile.weight_kg or 0) * 1.6)

    bmi = None
    target_weight_min_kg = None
    target_weight_max_kg = None
    if profile.height_cm and profile.weight_kg:
        height_m = profile.height_cm / 100
        bmi = round(profile.weight_kg / (height_m**2), 1)
        target_weight_min_kg = round(BMI_HEALTHY_MIN * height_m**2, 1)
        target_weight_max_kg = round(BMI_HEALTHY_MAX * height_m**2, 1)

    notes: list[str] = []
    conditions = {c for c in profile.conditions if c != "none"}
    if "diabetes" in conditions:
        notes.append("Diabetes: favour lower GI carbs, avoid sugary chutneys.")
    if "thyroid" in conditions:
        notes.append("Thyroid: ensure adequate iodine/selenium from dals and nuts.")
    if "hypertension" in conditions:
        notes.append("BP: watch sodium from pickle, papad, and restaurant gravies.")
    if "pcos" in conditions:
        notes.append("PCOS: prioritise protein and fibre; limit refined carbs.")

    note = " ".join(notes) if notes else None
    return DailyTargets(
        calories=calories,
        calories_min=calories_min,
        calories_max=calories_max,
        protein_g=protein_g,
        bmi=bmi,
        target_weight_min_kg=target_weight_min_kg,
        target_weight_max_kg=target_weight_max_kg,
        note=note,
    )
