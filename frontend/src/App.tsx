import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import {
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import {
  checkHealth,
  decomposeMeal,
  estimateMeal,
  type MealEstimate,
  type MealType,
  type UserProfile,
} from './api'
import { ResultsPanel } from './components/ResultsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { loadProfile, saveProfile } from './profile'

type Status = 'idle' | 'analyzing' | 'done' | 'error'

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-workout']

export default function App() {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<MealEstimate | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [visionReady, setVisionReady] = useState(false)
  const [notionReady, setNotionReady] = useState(false)
  const [mealType, setMealType] = useState<MealType>('Lunch')
  const [lastFile, setLastFile] = useState<File | null>(null)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile())
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setBackendOk(true)
        setVisionReady(h.vision_configured)
        setNotionReady(h.notion_configured)
      })
      .catch(() => {
        setBackendOk(false)
        setVisionReady(false)
        setNotionReady(false)
      })
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo (JPG, PNG, or WEBP).')
      setStatus('error')
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    const url = URL.createObjectURL(file)
    setPreview(url)
    setEstimate(null)
    setError(null)
    setStatus('analyzing')
    setLastFile(file)

    try {
      const result = await estimateMeal(file, {
        mealType,
        profile,
      })
      setEstimate(result)
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    void handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setEstimate(null)
    setLastFile(null)
    setError(null)
    setStatus('idle')
  }

  async function handleReanalyze(mealDescription: string) {
    const desc = mealDescription.trim()
    if (!desc) return

    setReanalyzing(true)
    setError(null)
    try {
      if (lastFile) {
        const result = await estimateMeal(lastFile, {
          mealType,
          profile,
          mealCorrection: desc,
        })
        setEstimate(result)
      } else {
        const partial = await decomposeMeal(desc, mealType)
        setEstimate((prev) =>
          prev
            ? {
                ...prev,
                meal_summary: partial.meal_summary,
                items: partial.items,
                totals: partial.totals,
                notion_page_url: null,
                assumptions: [
                  ...prev.assumptions.filter((a) => !a.startsWith('Re-analyzed')),
                  `Re-analyzed from description: ${desc}`,
                ],
              }
            : null,
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Re-analysis failed'
      setError(message)
      throw err
    } finally {
      setReanalyzing(false)
    }
  }

  function handleSaveProfile(next: UserProfile) {
    setProfile(next)
    saveProfile(next)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-3 pb-4 pt-4 sm:max-w-2xl sm:px-6 sm:pb-10 sm:pt-6">
      <header className="animate-fade-up mb-5 sm:mb-8">
        <div className="mb-1 flex items-start justify-between gap-3">
          <p className="font-display text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            ThaliScan
          </p>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-2xl border border-ink/10 bg-card/80 p-2.5 text-ink-soft hover:bg-white"
            aria-label="Profile settings"
          >
            <Settings2 className="size-5" />
          </button>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-ink-soft/80 sm:text-base">
          Snap your North Indian veg thali — macros, micros, and one smart cut.
        </p>
        <div className="mt-2 hidden flex-wrap items-center gap-2 text-xs text-ink-soft/70 sm:flex">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              backendOk === false
                ? 'bg-red-100 text-danger'
                : backendOk
                  ? 'bg-leaf/10 text-leaf'
                  : 'bg-black/5'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                backendOk === false ? 'bg-danger' : backendOk ? 'bg-leaf' : 'bg-ink/30 animate-pulse-soft'
              }`}
            />
            {backendOk === null
              ? 'Checking API…'
              : backendOk
                ? visionReady
                  ? notionReady
                    ? 'API + Notion ready'
                    : 'API ready'
                  : 'API up · set NVIDIA_API_KEY'
                : 'API offline'}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5">
        <section className={`animate-fade-up relative overflow-hidden rounded-3xl border border-ink/8 bg-card/80 shadow-[0_20px_50px_-28px_rgba(26,46,36,0.45)] backdrop-blur-sm ${estimate ? 'sm:block' : ''}`}>
          <div className={`relative p-4 sm:p-6 ${estimate ? 'hidden sm:block' : ''}`}>
            <div className="mb-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">Meal type</span>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5"
                >
                  {MEAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {preview ? (
              <div className="overflow-hidden rounded-2xl bg-ink/5">
                <img
                  src={preview}
                  alt="Meal preview"
                  className="max-h-72 w-full object-cover sm:max-h-80"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-mist/50 px-4 py-14 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-ink text-turmeric">
                  <UtensilsCrossed className="size-7" strokeWidth={1.75} />
                </div>
                <p className="font-display text-xl text-ink">Your plate, estimated</p>
                <p className="max-w-xs text-sm text-ink-soft/75">
                  Dal, sabzi, roti, rice, paneer — with fibre, iron, calcium, and more.
                </p>
              </div>
            )}

            <input
              ref={fileRef}
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onInputChange}
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label
                htmlFor={inputId}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-semibold text-surface transition hover:bg-ink-soft active:scale-[0.98]"
              >
                {status === 'analyzing' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Reading plate…
                  </>
                ) : (
                  <>
                    <Camera className="size-4 text-turmeric" />
                    Take Photo / Upload
                  </>
                )}
              </label>

              {preview && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-ink/15 bg-white/70 px-4 py-3.5 text-sm font-medium text-ink-soft transition hover:bg-white"
                >
                  <RefreshCw className="size-4" />
                  Reset
                </button>
              )}
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft/60">
              <ImagePlus className="size-3.5" />
              Profile stored on device · review & save meals to Notion after scanning.
            </p>
          </div>
        </section>

        {error && (
          <div
            className="animate-fade-up rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        {estimate && (
          <div className="flex justify-center sm:hidden">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-leaf underline-offset-2 hover:underline"
            >
              ← Scan a different meal
            </button>
          </div>
        )}

        {status === 'analyzing' && (
          <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-ink/8 bg-card/90 px-4 py-4 text-sm text-ink-soft">
            <Sparkles className="size-5 animate-pulse-soft text-turmeric" />
            Estimating macros, micros, and your smart tip…
          </div>
        )}

        {estimate && (
          <ResultsPanel
            estimate={estimate}
            mealType={mealType}
            notionReady={notionReady}
            sourceFile={lastFile}
            onReanalyze={handleReanalyze}
            reanalyzing={reanalyzing}
          />
        )}
      </main>

      <footer className={`mt-6 text-center text-xs text-ink-soft/50 ${estimate ? 'hidden sm:block sm:mt-10' : ''}`}>
        Estimates only · not medical advice
      </footer>

      {showSettings && (
        <SettingsPanel
          profile={profile}
          onSave={handleSaveProfile}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
