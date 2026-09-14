export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Pre-workout'
export type MedicalCondition = 'thyroid' | 'diabetes' | 'hypertension' | 'pcos' | 'none'

export interface UserProfile {
  height_cm?: number | null
  weight_kg?: number | null
  age?: number | null
  sex?: 'male' | 'female' | null
  activity_level: ActivityLevel
  conditions: MedicalCondition[]
}

export interface FoodItem {
  item: string
  grams: number
  portion?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  calories_per_100g?: number
  protein_per_100g?: number
  carbs_per_100g?: number
  fat_per_100g?: number
  source?: string | null
  notes?: string | null
}

export interface MacroTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MicroTotals {
  fibre_g: number
  calcium_mg: number
  iron_mg: number
  zinc_mg: number
  magnesium_mg: number
  sodium_mg: number
  potassium_mg: number
  sugar_g: number
  vitamin_c_mg: number
  vitamin_d_iu: number
}

export interface DailyTargets {
  calories?: number | null
  calories_min?: number | null
  calories_max?: number | null
  protein_g?: number | null
  bmi?: number | null
  target_weight_min_kg?: number | null
  target_weight_max_kg?: number | null
  note?: string | null
}

export interface SmartReductionTip {
  tip: string
  estimated_calorie_savings?: number | null
  estimated_protein_change_g?: number | null
}

export interface MealEstimate {
  meal_summary: string
  items: FoodItem[]
  totals: MacroTotals
  micros: MicroTotals
  daily_targets?: DailyTargets | null
  smart_reduction_tip: SmartReductionTip
  confidence: string
  assumptions: string[]
  notion_page_url?: string | null
}

export interface HealthResponse {
  status: string
  model: string
  vision_configured: boolean
  notion_configured: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error('Backend unreachable')
  return res.json()
}

export async function estimateMeal(
  file: File,
  options: {
    mealType: MealType
    profile: UserProfile | null
    mealCorrection?: string
  },
): Promise<MealEstimate> {
  const form = new FormData()
  form.append('file', file)
  form.append('meal_type', options.mealType)
  form.append('save_to_notion', 'false')
  if (options.profile) {
    form.append('profile_json', JSON.stringify(options.profile))
  }
  if (options.mealCorrection?.trim()) {
    form.append('meal_correction', options.mealCorrection.trim())
  }
  const res = await fetch(`${API_BASE}/api/estimate`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let detail = 'Estimation failed'
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

export async function decomposeMeal(
  mealDescription: string,
  mealType: MealType,
): Promise<{ meal_summary: string; items: FoodItem[]; totals: MacroTotals }> {
  const res = await fetch(`${API_BASE}/api/meal/decompose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meal_description: mealDescription, meal_type: mealType }),
  })
  if (!res.ok) {
    let detail = 'Meal analysis failed'
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

export async function saveMealToNotion(
  estimate: MealEstimate,
  mealType: MealType,
): Promise<{ notion_page_url: string }> {
  const res = await fetch(`${API_BASE}/api/notion/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meal_type: mealType, estimate }),
  })
  if (!res.ok) {
    let detail = 'Notion save failed'
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

export async function lookupFood(item: string, grams: number): Promise<FoodItem> {
  const res = await fetch(`${API_BASE}/api/food/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item, grams }),
  })
  if (!res.ok) {
    let detail = 'Food lookup failed'
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  const data = await res.json()
  return data.item as FoodItem
}
