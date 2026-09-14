import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_PATTERN,
  getTotalDuration,
  type BreathingPattern,
  type BreathingPhase,
} from './breathingPattern'
import { playPhaseChime, playTick, vibratePhaseChange, vibrateTick } from './signals'

export interface BreathingCycleState {
  isRunning: boolean
  isPaused: boolean
  pattern: BreathingPattern
  phaseIndex: number
  phase: BreathingPhase
  secondsRemaining: number
  progress: number
  cycleCount: number
}

interface UseBreathingCycleOptions {
  pattern?: BreathingPattern
  soundEnabled?: boolean
  hapticsEnabled?: boolean
  onCycleComplete?: (count: number) => void
}

function findPhaseAtProgress(pattern: BreathingPattern, progress: number): {
  phaseIndex: number
  phase: BreathingPhase
  phaseProgress: number
  secondsRemaining: number
} {
  const total = getTotalDuration(pattern)
  const elapsed = progress * total
  let accumulated = 0

  for (let i = 0; i < pattern.phases.length; i++) {
    const phase = pattern.phases[i]
    const next = accumulated + phase.duration

    if (elapsed < next || i === pattern.phases.length - 1) {
      const intoPhase = Math.min(Math.max(elapsed - accumulated, 0), phase.duration)
      const phaseProgress = phase.duration === 0 ? 1 : intoPhase / phase.duration
      const secondsRemaining = Math.max(1, Math.ceil(phase.duration - intoPhase))

      return { phaseIndex: i, phase, phaseProgress, secondsRemaining }
    }

    accumulated = next
  }

  const last = pattern.phases[pattern.phases.length - 1]
  return {
    phaseIndex: pattern.phases.length - 1,
    phase: last,
    phaseProgress: 1,
    secondsRemaining: 1,
  }
}

export function useBreathingCycle({
  pattern = DEFAULT_PATTERN,
  soundEnabled = true,
  hapticsEnabled = true,
  onCycleComplete,
}: UseBreathingCycleOptions = {}) {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)

  const startTimeRef = useRef<number | null>(null)
  const pausedProgressRef = useRef(0)
  const lastPhaseIndexRef = useRef(0)
  const lastSecondRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const { phaseIndex, phase, secondsRemaining } = findPhaseAtProgress(pattern, progress)

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    if (startTimeRef.current === null) return

    const totalMs = getTotalDuration(pattern) * 1000
    const elapsed = performance.now() - startTimeRef.current
    const rawProgress = pausedProgressRef.current + elapsed / totalMs

    if (rawProgress >= 1) {
      const completed = Math.floor(rawProgress)
      if (completed > 0) {
        setCycleCount((c) => {
          const next = c + completed
          onCycleComplete?.(next)
          return next
        })
      }
      pausedProgressRef.current = rawProgress % 1
      startTimeRef.current = performance.now()
    }

    const nextProgress = rawProgress % 1
    setProgress(nextProgress)

    const phaseInfo = findPhaseAtProgress(pattern, nextProgress)

    if (phaseInfo.phaseIndex !== lastPhaseIndexRef.current) {
      lastPhaseIndexRef.current = phaseInfo.phaseIndex
      if (soundEnabled) playPhaseChime(phaseInfo.phase.kind)
      if (hapticsEnabled) vibratePhaseChange()
      lastSecondRef.current = phaseInfo.secondsRemaining
    } else if (lastSecondRef.current !== phaseInfo.secondsRemaining) {
      lastSecondRef.current = phaseInfo.secondsRemaining
      if (soundEnabled) playTick()
      if (hapticsEnabled) vibrateTick()
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [hapticsEnabled, onCycleComplete, pattern, soundEnabled])

  const start = useCallback(() => {
    startTimeRef.current = performance.now()
    pausedProgressRef.current = progress
    lastPhaseIndexRef.current = findPhaseAtProgress(pattern, progress).phaseIndex
    lastSecondRef.current = findPhaseAtProgress(pattern, progress).secondsRemaining
    setIsRunning(true)
    setIsPaused(false)
    stopLoop()
    rafRef.current = requestAnimationFrame(tick)
  }, [pattern, progress, stopLoop, tick])

  const pause = useCallback(() => {
    if (!isRunning || isPaused) return
    stopLoop()
    const totalMs = getTotalDuration(pattern) * 1000
    const elapsed = startTimeRef.current ? performance.now() - startTimeRef.current : 0
    pausedProgressRef.current = (pausedProgressRef.current + elapsed / totalMs) % 1
    setProgress(pausedProgressRef.current)
    startTimeRef.current = null
    setIsPaused(true)
  }, [isPaused, isRunning, pattern, stopLoop])

  const resume = useCallback(() => {
    if (!isPaused) return
    start()
  }, [isPaused, start])

  const reset = useCallback(() => {
    stopLoop()
    startTimeRef.current = null
    pausedProgressRef.current = 0
    lastPhaseIndexRef.current = 0
    lastSecondRef.current = null
    setProgress(0)
    setIsRunning(false)
    setIsPaused(false)
    setCycleCount(0)
  }, [stopLoop])

  const toggle = useCallback(() => {
    if (!isRunning) {
      start()
      return
    }
    if (isPaused) {
      resume()
    } else {
      pause()
    }
  }, [isPaused, isRunning, pause, resume, start])

  useEffect(() => {
    return () => stopLoop()
  }, [stopLoop])

  return {
    isRunning,
    isPaused,
    pattern,
    phaseIndex,
    phase,
    secondsRemaining,
    progress,
    cycleCount,
    start,
    pause,
    resume,
    reset,
    toggle,
  }
}
