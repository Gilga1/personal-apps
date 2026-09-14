import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { ActivityLevel, MedicalCondition, UserProfile } from '../api'
import { getProfileInsights } from '../nutrition'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
]

const CONDITIONS: { value: MedicalCondition; label: string }[] = [
  { value: 'thyroid', label: 'Thyroid' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'hypertension', label: 'Blood pressure' },
  { value: 'pcos', label: 'PCOS' },
]

interface SettingsPanelProps {
  profile: UserProfile
  onSave: (profile: UserProfile) => void
  onClose: () => void
}

export function SettingsPanel({ profile, onSave, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState<UserProfile>({ ...profile })
  const insights = useMemo(() => getProfileInsights(draft), [draft])

  function toggleCondition(value: MedicalCondition) {
    setDraft((prev) => {
      const has = prev.conditions.includes(value)
      return {
        ...prev,
        conditions: has
          ? prev.conditions.filter((c) => c !== value)
          : [...prev.conditions, value],
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink">Your profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-soft hover:bg-mist"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mb-5 text-sm text-ink-soft/75">
          Used for BMI targets, daily calories, and condition-aware tips. Stored on this device only.
        </p>

        {(insights.bmi != null || insights.calorieTarget != null) && (
          <section className="mb-5 rounded-2xl border border-leaf/20 bg-leaf/5 p-4 text-sm">
            {insights.bmi != null && (
              <p className="text-ink">
                <span className="font-medium">BMI:</span> {insights.bmi}{' '}
                <span className="text-ink-soft">({insights.bmiLabel})</span>
              </p>
            )}
            {insights.targetWeightMinKg != null && insights.targetWeightMaxKg != null && (
              <p className="mt-2 text-ink-soft">
                <span className="font-medium text-ink">Healthy weight range:</span>{' '}
                {insights.targetWeightMinKg}–{insights.targetWeightMaxKg} kg
                <span className="block text-xs text-ink-soft/70">
                  Based on BMI 18.5–24.9 for your height
                </span>
              </p>
            )}
            {insights.calorieMin != null && insights.calorieMax != null && (
              <p className="mt-2 text-ink-soft">
                <span className="font-medium text-ink">Daily calories:</span>{' '}
                {insights.calorieMin}–{insights.calorieMax} kcal
                {insights.calorieTarget != null && (
                  <span className="block text-xs text-ink-soft/70">
                    ~{insights.calorieTarget} kcal at your current activity level
                    {insights.proteinTargetG ? ` · ~${insights.proteinTargetG}g protein` : ''}
                  </span>
                )}
              </p>
            )}
            {insights.conditionNote && (
              <p className="mt-2 text-xs text-ink-soft/70">{insights.conditionNote}</p>
            )}
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Height (cm)</span>
            <input
              type="number"
              value={draft.height_cm ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, height_cm: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-xl border border-ink/15 px-3 py-2.5"
              placeholder="175"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Weight (kg)</span>
            <input
              type="number"
              value={draft.weight_kg ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, weight_kg: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-xl border border-ink/15 px-3 py-2.5"
              placeholder="78"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Age</span>
            <input
              type="number"
              value={draft.age ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, age: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-xl border border-ink/15 px-3 py-2.5"
              placeholder="32"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Sex</span>
            <select
              value={draft.sex ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sex: (e.target.value || null) as UserProfile['sex'],
                })
              }
              className="w-full rounded-xl border border-ink/15 px-3 py-2.5"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-ink-soft">Activity level</span>
          <select
            value={draft.activity_level}
            onChange={(e) =>
              setDraft({ ...draft, activity_level: e.target.value as ActivityLevel })
            }
            className="w-full rounded-xl border border-ink/15 px-3 py-2.5"
          >
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink-soft">Medical conditions</legend>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => {
              const active = draft.conditions.includes(c.value)
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCondition(c.value)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-leaf text-white'
                      : 'border border-ink/15 bg-white text-ink-soft'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => {
            onSave(draft)
            onClose()
          }}
          className="mt-6 w-full rounded-2xl bg-ink py-3.5 text-sm font-semibold text-surface"
        >
          Save profile
        </button>
      </div>
    </div>
  )
}
