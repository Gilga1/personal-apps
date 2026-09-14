let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioContext = new Ctx()
  }
  return audioContext
}

export function playPhaseChime(kind: 'inhale' | 'hold' | 'exhale'): void {
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  const frequencies: Record<'inhale' | 'hold' | 'exhale', number> = {
    inhale: 392,
    hold: 330,
    exhale: 262,
  }

  oscillator.type = 'sine'
  oscillator.frequency.value = frequencies[kind]
  gain.gain.value = 0.0001

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)

  oscillator.start(now)
  oscillator.stop(now + 0.4)
}

export function playTick(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 520
  gain.gain.value = 0.0001

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

  oscillator.start(now)
  oscillator.stop(now + 0.1)
}

export function vibratePhaseChange(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([30, 40, 30])
  }
}

export function vibrateTick(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(8)
  }
}
