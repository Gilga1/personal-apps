import type { ActivityLevel, FoodItem, MacroTotals, MicroTotals, UserProfile } from './api'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const BMI_HEALTHY_MIN = 18.5
const BMI_HEALTHY_MAX = 24.9

export interface ProfileInsights {
  bmi: number | null
  bmiLabel: string | null
  targetWeightMinKg: number | null
  targetWeightMaxKg: number | null
  calorieMin: number | null
  calorieMax: number | null
  calorieTarget: number | null
  proteinTargetG: number | null
  conditionNote: string | null
}

function round(n: number, digits = 0): number {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

function parseGramsFromItem(item: FoodItem): number {
  if (item.grams > 0) return item.grams
  const match = (item.portion ?? '').match(/(\d+(?:\.\d+)?)\s*g/i)
  return match ? parseFloat(match[1]) : 100
}

function formatGrams(grams: number): string {
  return `${grams === Math.round(grams) ? Math.round(grams) : grams} g`
}

/** Matches Notion formula: (Protein × 4) + (Carbs × 4) + (Fat × 9) */
export function caloriesFromMacros(protein_g: number, carbs_g: number, fat_g: number): number {
  return round(protein_g * 4 + carbs_g * 4 + fat_g * 9, 1)
}

export function withMacroCalories<T extends FoodItem>(item: T): T {
  return {
    ...item,
    calories: caloriesFromMacros(item.protein_g, item.carbs_g, item.fat_g),
  }
}

export function scaleFoodItemByGrams(item: FoodItem, newGrams: number): FoodItem {
  if (newGrams <= 0) return item

  const currentGrams = parseGramsFromItem(item)
  let cal100 = item.calories_per_100g ?? 0
  let pro100 = item.protein_per_100g ?? 0
  let carb100 = item.carbs_per_100g ?? 0
  let fat100 = item.fat_per_100g ?? 0

  if (cal100 <= 0 && currentGrams > 0) {
    const factor = 100 / currentGrams
    cal100 = round(item.calories * factor, 1)
    pro100 = round(item.protein_g * factor, 1)
    carb100 = round(item.carbs_g * factor, 1)
    fat100 = round(item.fat_g * factor, 1)
  }

  const portionFactor = newGrams / 100
  return {
    ...item,
    grams: newGrams,
    portion: formatGrams(newGrams),
    calories_per_100g: cal100,
    protein_per_100g: pro100,
    carbs_per_100g: carb100,
    fat_per_100g: fat100,
    calories: caloriesFromMacros(
      round(pro100 * portionFactor, 1),
      round(carb100 * portionFactor, 1),
      round(fat100 * portionFactor, 1),
    ),
    protein_g: round(pro100 * portionFactor, 1),
    carbs_g: round(carb100 * portionFactor, 1),
    fat_g: round(fat100 * portionFactor, 1),
  }
}

export function sumMacroTotals(items: FoodItem[]): MacroTotals {
  const protein_g = round(items.reduce((s, i) => s + i.protein_g, 0), 1)
  const carbs_g = round(items.reduce((s, i) => s + i.carbs_g, 0), 1)
  const fat_g = round(items.reduce((s, i) => s + i.fat_g, 0), 1)
  return {
    calories: caloriesFromMacros(protein_g, carbs_g, fat_g),
    protein_g,
    carbs_g,
    fat_g,
  }
}

export function scaleMicros(
  micros: MicroTotals,
  originalCalories: number,
  newCalories: number,
): MicroTotals {
  if (!originalCalories || !newCalories) return micros
  const ratio = newCalories / originalCalories
  const scale = (v: number) => round(v * ratio, 1)
  return {
    fibre_g: scale(micros.fibre_g),
    calcium_mg: scale(micros.calcium_mg),
    iron_mg: scale(micros.iron_mg),
    zinc_mg: scale(micros.zinc_mg),
    magnesium_mg: scale(micros.magnesium_mg),
    sodium_mg: scale(micros.sodium_mg),
    potassium_mg: scale(micros.potassium_mg),
    sugar_g: scale(micros.sugar_g),
    vitamin_c_mg: scale(micros.vitamin_c_mg),
    vitamin_d_iu: scale(micros.vitamin_d_iu),
  }
}

function bmr(profile: UserProfile): number | null {
  const { height_cm, weight_kg, age, sex } = profile
  if (!height_cm || !weight_kg || !age || !sex) return null
  if (sex === 'male') {
    return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
  }
  return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Healthy'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

export function getProfileInsights(profile: UserProfile): ProfileInsights {
  const { height_cm, weight_kg, activity_level, conditions } = profile
  let bmi: number | null = null
  let targetWeightMinKg: number | null = null
  let targetWeightMaxKg: number | null = null

  if (height_cm && weight_kg) {
    const heightM = height_cm / 100
    bmi = round(weight_kg / (heightM * heightM), 1)
    targetWeightMinKg = round(BMI_HEALTHY_MIN * heightM * heightM, 1)
    targetWeightMaxKg = round(BMI_HEALTHY_MAX * heightM * heightM, 1)
  }

  const base = bmr(profile)
  let calorieMin: number | null = null
  let calorieMax: number | null = null
  let calorieTarget: number | null = null

  if (base) {
    const multipliers = Object.values(ACTIVITY_MULTIPLIERS)
    calorieMin = round(base * Math.min(...multipliers))
    calorieMax = round(base * Math.max(...multipliers))
    calorieTarget = round(base * ACTIVITY_MULTIPLIERS[activity_level])
  }

  const notes: string[] = []
  const active = conditions.filter((c) => c !== 'none')
  if (active.includes('diabetes')) notes.push('Favour lower GI carbs.')
  if (active.includes('thyroid')) notes.push('Ensure iodine/selenium from dals.')
  if (active.includes('hypertension')) notes.push('Watch sodium from pickle & papad.')
  if (active.includes('pcos')) notes.push('Prioritise protein & fibre.')

  return {
    bmi,
    bmiLabel: bmi != null ? bmiLabel(bmi) : null,
    targetWeightMinKg,
    targetWeightMaxKg,
    calorieMin,
    calorieMax,
    calorieTarget,
    proteinTargetG: weight_kg ? round(weight_kg * 1.6) : null,
    conditionNote: notes.length ? notes.join(' ') : null,
  }
}

export interface EditableItem extends FoodItem {
  id: string
}

export function toEditableItems(items: FoodItem[]): EditableItem[] {
  return items.map((item, idx) => {
    const grams = parseGramsFromItem(item)
    const normalized = withMacroCalories({
      ...item,
      grams,
      portion: item.portion || formatGrams(grams),
    })
    return {
      ...normalized,
      id: `item-${idx}-${item.item.slice(0, 12)}`,
    }
  })
}
