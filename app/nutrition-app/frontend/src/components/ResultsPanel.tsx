import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { MealEstimate, MealType } from '../api'
import { lookupFood, saveMealToNotion } from '../api'
import {
  caloriesFromMacros,
  scaleFoodItemByGrams,
  scaleMicros,
  sumMacroTotals,
  toEditableItems,
  withMacroCalories,
  type EditableItem,
} from '../nutrition'

function MacroPill({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl bg-mist/80 px-2.5 py-2.5 text-center sm:px-3 sm:py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-soft/60 sm:text-[11px]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-semibold text-ink sm:mt-1 sm:text-xl">
        {Math.round(value)}
        <span className="ml-0.5 text-xs font-sans font-medium text-ink-soft/70 sm:text-sm">
          {unit}
        </span>
      </p>
    </div>
  )
}

function MicroChip({ label, value, unit }: { label: string; value: number; unit: string }) {
  if (!value) return null
  return (
    <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs text-ink-soft">
      {label}: {value < 10 ? value.toFixed(1) : Math.round(value)}
      {unit}
    </span>
  )
}

interface ResultsPanelProps {
  estimate: MealEstimate
  mealType: MealType
  notionReady: boolean
  sourceFile: File | null
  onReanalyze: (mealDescription: string) => Promise<void>
  reanalyzing: boolean
}

export function ResultsPanel({
  estimate,
  mealType,
  notionReady,
  sourceFile,
  onReanalyze,
  reanalyzing,
}: ResultsPanelProps) {
  const [mealSummary, setMealSummary] = useState(estimate.meal_summary)
  const [items, setItems] = useState<EditableItem[]>(() => toEditableItems(estimate.items))
  const [baseCalories] = useState(() =>
    caloriesFromMacros(
      estimate.totals.protein_g,
      estimate.totals.carbs_g,
      estimate.totals.fat_g,
    ),
  )
  const [notionUrl, setNotionUrl] = useState<string | null>(estimate.notion_page_url ?? null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemGrams, setNewItemGrams] = useState('100')
  const [addingItem, setAddingItem] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [gramDrafts, setGramDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setMealSummary(estimate.meal_summary)
    setItems(toEditableItems(estimate.items))
    setGramDrafts({})
    setNotionUrl(estimate.notion_page_url ?? null)
    setSaveError(null)
    setReanalyzeError(null)
  }, [estimate])

  const totals = useMemo(() => sumMacroTotals(items), [items])
  const micros = useMemo(
    () => scaleMicros(estimate.micros, baseCalories, totals.calories),
    [estimate.micros, baseCalories, totals.calories],
  )

  const tip = estimate.smart_reduction_tip
  const targets = estimate.daily_targets

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        if (patch.grams !== undefined && patch.grams !== row.grams) {
          return { ...scaleFoodItemByGrams(row, patch.grams), id: row.id }
        }
        return { ...row, ...patch }
      }),
    )
  }

  function commitGrams(id: string, raw: string) {
    const grams = parseFloat(raw)
    if (!Number.isNaN(grams) && grams > 0) {
      updateItem(id, { grams })
    }
    setGramDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((row) => row.id !== id))
    setGramDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleReanalyze() {
    const desc = mealSummary.trim()
    if (!desc) {
      setReanalyzeError('Enter what this meal actually is')
      return
    }
    setReanalyzeError(null)
    try {
      await onReanalyze(desc)
    } catch (err) {
      setReanalyzeError(err instanceof Error ? err.message : 'Re-analysis failed')
    }
  }

  async function handleAddItem() {
    const name = newItemName.trim()
    const grams = parseFloat(newItemGrams)
    if (!name) {
      setAddError('Enter a food name')
      return
    }
    if (!grams || grams <= 0) {
      setAddError('Enter a valid weight in grams')
      return
    }

    setAddingItem(true)
    setAddError(null)
    try {
      const lookedUp = await lookupFood(name, grams)
      const id = `item-new-${Date.now()}`
      setItems((prev) => [...prev, { ...withMacroCalories(lookedUp), id }])
      setNewItemName('')
      setNewItemGrams('100')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not look up food')
    } finally {
      setAddingItem(false)
    }
  }

  async function handleSaveNotion() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: MealEstimate = {
        ...estimate,
        meal_summary: mealSummary.trim() || estimate.meal_summary,
        items: items.map(withMacroCalories),
        totals,
        micros,
      }
      const res = await saveMealToNotion(payload, mealType)
      setNotionUrl(res.notion_page_url)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-up space-y-3 sm:space-y-4">
      {targets?.calories && (
        <section className="rounded-2xl border border-ink/8 bg-card/90 px-3 py-2.5 text-xs text-ink-soft sm:px-4 sm:py-3 sm:text-sm">
          <span className="font-medium text-ink">Daily target:</span>{' '}
          {targets.calories_min != null && targets.calories_max != null ? (
            <>
              {Math.round(targets.calories_min)}–{Math.round(targets.calories_max)} kcal
              <span className="text-ink-soft/70">
                {' '}
                · ~{Math.round(targets.calories)} kcal today
              </span>
            </>
          ) : (
            <>~{Math.round(targets.calories)} kcal</>
          )}
          {targets.protein_g ? ` · ${targets.protein_g}g protein` : ''}
        </section>
      )}

      <section className="rounded-3xl border border-ink/8 bg-card/90 p-4 shadow-[0_16px_40px_-24px_rgba(26,46,36,0.4)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">Meal breakdown</h2>
          <span className="shrink-0 rounded-full bg-leaf/10 px-2 py-0.5 text-[10px] font-medium capitalize text-leaf sm:px-2.5 sm:py-1 sm:text-xs">
            {estimate.confidence}
          </span>
        </div>

        <div className="mb-4 rounded-2xl border border-ink/10 bg-mist/30 p-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft/70">
            What is this meal?
          </label>
          <textarea
            value={mealSummary}
            onChange={(e) => setMealSummary(e.target.value)}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm leading-snug text-ink focus:border-leaf/40 focus:outline-none"
            placeholder="e.g. Boondi raita with curd"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleReanalyze()}
              disabled={reanalyzing || !mealSummary.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {reanalyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refetch
            </button>
            <button
              type="button"
              onClick={() => {
                setMealSummary('')
                setReanalyzeError(null)
              }}
              disabled={reanalyzing || !mealSummary}
              className="inline-flex items-center justify-center rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-mist/50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft/60">
            {sourceFile
              ? 'Refetch uses your photo + the name above'
              : 'Refetch builds components from the name above'}
          </p>
          {reanalyzeError && <p className="mt-2 text-sm text-danger">{reanalyzeError}</p>}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MacroPill label="Calories" value={totals.calories} unit="kcal" />
          <MacroPill label="Protein" value={totals.protein_g} unit="g" />
          <MacroPill label="Carbs" value={totals.carbs_g} unit="g" />
          <MacroPill label="Fat" value={totals.fat_g} unit="g" />
        </div>

        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          <MicroChip label="Fibre" value={micros.fibre_g} unit="g" />
          <MicroChip label="Iron" value={micros.iron_mg} unit="mg" />
          <MicroChip label="Calcium" value={micros.calcium_mg} unit="mg" />
          <MicroChip label="Zinc" value={micros.zinc_mg} unit="mg" />
          <MicroChip label="Mg" value={micros.magnesium_mg} unit="mg" />
          <MicroChip label="Sodium" value={micros.sodium_mg} unit="mg" />
          <MicroChip label="Potassium" value={micros.potassium_mg} unit="mg" />
        </div>

        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-ink/8 bg-white p-3 sm:grid sm:grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr_2rem] sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:p-3 sm:first:rounded-t-2xl"
            >
              <div className="flex items-start justify-between gap-2 sm:block">
                <input
                  type="text"
                  value={row.item}
                  onChange={(e) => updateItem(row.id, { item: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-ink focus:border-ink/15 focus:bg-mist/40 focus:outline-none sm:w-full"
                />
                <button
                  type="button"
                  onClick={() => removeItem(row.id)}
                  className="shrink-0 rounded-lg p-1.5 text-ink-soft/50 hover:bg-red-50 hover:text-danger sm:hidden"
                  aria-label={`Remove ${row.item}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {(row.notes || row.source) && (
                <p className="mt-0.5 px-1 text-[11px] text-ink-soft/60 sm:col-span-1">
                  {row.notes}
                  {row.source && (
                    <span className="ml-1 rounded bg-mist/60 px-1 py-0.5 text-[9px] uppercase tracking-wide">
                      {row.source}
                    </span>
                  )}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:contents">
                <div className="flex flex-1 items-center gap-1 sm:flex-none">
                  <span className="text-xs text-ink-soft/50 sm:hidden">g</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={gramDrafts[row.id] ?? String(row.grams)}
                    onChange={(e) =>
                      setGramDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    onBlur={(e) => commitGrams(row.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    className="w-20 rounded-lg border border-ink/10 bg-mist/30 px-2 py-2 text-sm text-ink sm:w-full"
                  />
                  <span className="hidden text-xs text-ink-soft/50 sm:inline">g</span>
                </div>
                <p className="text-sm sm:text-right">
                  <span className="text-ink-soft/50 sm:hidden">Cal </span>
                  <span className="font-semibold text-ink">
                    {Math.round(caloriesFromMacros(row.protein_g, row.carbs_g, row.fat_g))}
                  </span>
                </p>
                <p className="text-sm sm:text-right">
                  <span className="text-ink-soft/50 sm:hidden">P </span>
                  <span className="font-semibold text-ink">{row.protein_g.toFixed(1)}g</span>
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(row.id)}
                  className="hidden rounded-lg p-1.5 text-ink-soft/50 hover:bg-red-50 hover:text-danger sm:block"
                  aria-label={`Remove ${row.item}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="rounded-2xl border border-dashed border-ink/15 px-3 py-6 text-center text-sm text-ink-soft/60">
              No items yet. Re-analyze the meal or add items below.
            </li>
          )}
        </ul>

        <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-mist/20 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft/70">
            Add food item
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g. boondi, curd, roti"
              className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={newItemGrams}
                onChange={(e) => setNewItemGrams(e.target.value)}
                placeholder="Grams"
                className="w-24 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleAddItem()}
                disabled={addingItem}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink/90 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {addingItem ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add
              </button>
            </div>
          </div>
          {addError && <p className="mt-2 text-sm text-danger">{addError}</p>}
        </div>

        {estimate.assumptions?.length > 0 && (
          <details className="mt-4 text-xs text-ink-soft/65">
            <summary className="cursor-pointer font-medium text-ink-soft/80">Assumptions</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {estimate.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-3xl border border-leaf/25 bg-gradient-to-br from-[#e8f3ec] to-[#dceee3] p-4 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-turmeric-deep">
          Smart Reduction Tip
        </p>
        <p className="mt-2 font-display text-base leading-snug text-ink sm:text-lg">{tip.tip}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-ink-soft">
          {tip.estimated_calorie_savings != null && (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs sm:text-sm">
              ~{Math.round(tip.estimated_calorie_savings)} kcal saved
            </span>
          )}
          {tip.estimated_protein_change_g != null && tip.estimated_protein_change_g !== 0 && (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs sm:text-sm">
              Protein {tip.estimated_protein_change_g > 0 ? '+' : ''}
              {tip.estimated_protein_change_g.toFixed(1)} g
            </span>
          )}
        </div>
      </section>

      {notionReady && items.length > 0 && (
        <>
          <div className="h-[4.25rem] shrink-0 sm:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-20 sm:static">
            <div className="border-t border-ink/10 bg-[#eef2ec]/95 px-3 py-2 shadow-[0_-6px_20px_-8px_rgba(26,46,36,0.2)] backdrop-blur-md sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
              <div className="mx-auto flex max-w-lg flex-col gap-1.5 sm:max-w-2xl sm:flex-row sm:items-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveNotion()}
                  disabled={saving || !!notionUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : notionUrl ? (
                    'Saved to Notion'
                  ) : (
                    'Save to Notion'
                  )}
                </button>
                {notionUrl && (
                  <a
                    href={notionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-center text-sm font-medium text-leaf underline-offset-2 hover:underline"
                  >
                    Open in Notion →
                  </a>
                )}
                {saveError && (
                  <p className="text-center text-sm text-danger sm:text-left">{saveError}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
