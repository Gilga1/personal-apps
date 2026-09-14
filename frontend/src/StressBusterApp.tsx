import { useEffect, useState } from 'react'
import { BreathingRing } from './BreathingRing'
import { NoseIcon } from './NoseIcon'
import { PATTERNS, type BreathingPattern } from './breathingPattern'
import { useBreathingCycle } from './useBreathingCycle'

export function StressBusterApp() {
  const [pattern, setPattern] = useState<BreathingPattern>(PATTERNS[0])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [flashKey, setFlashKey] = useState(0)

  const {
    isRunning,
    isPaused,
    phase,
    phaseIndex,
    secondsRemaining,
    progress,
    cycleCount,
    toggle,
    reset,
  } = useBreathingCycle({
    pattern,
    soundEnabled,
    hapticsEnabled,
  })

  const phaseKind = phase.kind
  const phasePulse =
    phaseKind === 'inhale'
      ? 0.5 + Math.sin(progress * Math.PI * 8) * 0.2
      : phaseKind === 'hold'
        ? 0.4
        : 0.25 + Math.sin(progress * Math.PI * 4) * 0.15

  useEffect(() => {
    setFlashKey((k) => k + 1)
  }, [secondsRemaining, phaseIndex])

  const statusLabel = !isRunning
    ? 'Tap to begin'
    : isPaused
      ? 'Paused'
      : `${cycleCount} breath${cycleCount === 1 ? '' : 's'} completed`

  return (
    <div className="stress-buster-root">
      <div className="stress-buster-shell">
        <header className="stress-buster-header">
          <p className="stress-buster-title">Breathe</p>
          <button
            type="button"
            className="stress-buster-settings-btn"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Settings"
            aria-expanded={showSettings}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </header>

        {showSettings && (
          <div className="stress-buster-settings animate-fade-up">
            <label className="stress-buster-field">
              <span>Pattern</span>
              <select
                value={pattern.id}
                onChange={(e) => {
                  const next = PATTERNS.find((p) => p.id === e.target.value)
                  if (next) {
                    setPattern(next)
                    reset()
                  }
                }}
              >
                {PATTERNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="stress-buster-toggle">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              <span>Sound cues</span>
            </label>

            <label className="stress-buster-toggle">
              <input
                type="checkbox"
                checked={hapticsEnabled}
                onChange={(e) => setHapticsEnabled(e.target.checked)}
              />
              <span>Haptic signals</span>
            </label>
          </div>
        )}

        <button
          type="button"
          className="stress-buster-stage"
          onClick={toggle}
          aria-label={isRunning && !isPaused ? 'Pause breathing exercise' : 'Start breathing exercise'}
        >
          <div className="stress-buster-ring-wrap">
            <BreathingRing
              pattern={pattern}
              progress={progress}
              phaseIndex={phaseIndex}
              size={300}
            />
            <div className="stress-buster-nose">
              <NoseIcon pulse={phasePulse} phaseKind={phaseKind} />
            </div>
          </div>

          <div className="stress-buster-copy">
            <p className="stress-buster-instruction">{phase.instruction}</p>
            {phase.subInstruction && (
              <p className="stress-buster-sub">{phase.subInstruction}</p>
            )}
            <p key={flashKey} className="stress-buster-count" aria-live="polite">
              {secondsRemaining}
            </p>
          </div>
        </button>

        <footer className="stress-buster-footer">
          <p className="stress-buster-status">{statusLabel}</p>
          {isRunning && (
            <button type="button" className="stress-buster-reset" onClick={reset}>
              Reset
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
