from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Per100g:
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    source: str = "IFCT"


# Approximate cooked/home values aligned with IFCT 2017 & ICMR references.
FOOD_DB: dict[str, Per100g] = {
    # Dals & legumes (cooked)
    "yellow dal": Per100g(104, 7.0, 16.0, 2.5),
    "dal tadka": Per100g(115, 7.5, 15.0, 4.0),
    "dal makhani": Per100g(140, 6.5, 14.0, 7.0),
    "chana dal": Per100g(110, 7.2, 16.5, 2.0),
    "rajma": Per100g(127, 8.7, 17.0, 2.5),
    "chole": Per100g(130, 7.5, 18.0, 3.5),
    "moong dal": Per100g(98, 7.5, 15.0, 1.5),
    # Rice & grains (cooked)
    "basmati rice": Per100g(130, 2.7, 28.0, 0.3),
    "jeera rice": Per100g(145, 2.8, 28.5, 3.0),
    "veg pulao": Per100g(155, 3.5, 26.0, 4.5),
    "khichdi": Per100g(120, 4.0, 20.0, 2.5),
    # Breads
    "roti": Per100g(297, 9.0, 52.0, 6.0),
    "chapati": Per100g(297, 9.0, 52.0, 6.0),
    "phulka": Per100g(280, 9.0, 50.0, 4.5),
    "paratha": Per100g(320, 8.5, 42.0, 14.0),
    "naan": Per100g(310, 9.0, 52.0, 8.0),
    # Paneer & dairy
    "paneer": Per100g(265, 18.0, 4.0, 20.0),
    "paneer butter masala": Per100g(175, 9.0, 8.0, 13.0),
    "palak paneer": Per100g(145, 8.5, 7.0, 10.0),
    "shahi paneer": Per100g(190, 9.5, 9.0, 14.0),
    "kadhai paneer": Per100g(170, 10.0, 8.0, 12.0),
    "curd": Per100g(60, 3.5, 4.5, 3.0),
    "dahi": Per100g(60, 3.5, 4.5, 3.0),
    "raita": Per100g(75, 3.0, 6.0, 4.5),
    "boondi raita": Per100g(120, 4.5, 12.0, 6.5),
    "boondi": Per100g(450, 12.0, 55.0, 22.0),
    # Sabzi (cooked, with oil)
    "aloo gobhi": Per100g(95, 2.5, 12.0, 4.5),
    "bhindi": Per100g(85, 2.2, 9.0, 4.0),
    "baingan bharta": Per100g(90, 2.0, 10.0, 5.0),
    "mix veg": Per100g(88, 2.5, 11.0, 4.0),
    "palak sabzi": Per100g(75, 3.5, 6.0, 4.5),
    "lauki": Per100g(55, 1.5, 6.0, 2.5),
    # Common breakfast / global staples
    "oats porridge": Per100g(71, 2.5, 12.0, 1.5),
    "oatmeal": Per100g(71, 2.5, 12.0, 1.5),
    "banana": Per100g(89, 1.1, 23.0, 0.3),
    "strawberry": Per100g(32, 0.7, 7.7, 0.3),
    "blueberry": Per100g(57, 0.7, 14.0, 0.3),
    "raspberry": Per100g(52, 1.2, 12.0, 0.7),
    "peanut butter": Per100g(588, 25.0, 20.0, 50.0),
    "peanut butter smooth": Per100g(588, 25.0, 20.0, 50.0),
}

# Typical single-unit weights (grams) when vision only gives counts
DEFAULT_GRAMS: dict[str, float] = {
    "roti": 40,
    "chapati": 40,
    "phulka": 35,
    "paratha": 80,
    "naan": 90,
    "papad": 10,
}


def _normalize_key(name: str) -> str:
    return " ".join(name.lower().strip().split())


def lookup_per_100g(item_name: str) -> tuple[Per100g, str] | None:
    key = _normalize_key(item_name)
    if key in FOOD_DB:
        return FOOD_DB[key], key

    # Substring / alias match (longest key first)
    for db_key in sorted(FOOD_DB.keys(), key=len, reverse=True):
        if db_key in key or key in db_key:
            return FOOD_DB[db_key], db_key

    # Token overlap
    tokens = set(key.split())
    best: tuple[Per100g, str, int] | None = None
    for db_key, vals in FOOD_DB.items():
        db_tokens = set(db_key.split())
        overlap = len(tokens & db_tokens)
        if overlap >= 1 and (best is None or overlap > best[2]):
            best = (vals, db_key, overlap)
    if best and best[2] >= 1:
        return best[0], best[1]
    return None
