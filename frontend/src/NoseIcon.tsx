interface NoseIconProps {
  pulse?: number
  phaseKind?: 'inhale' | 'hold' | 'exhale'
}

export function NoseIcon({ pulse = 0, phaseKind = 'exhale' }: NoseIconProps) {
  const scale = 1 + pulse * (phaseKind === 'inhale' ? 0.08 : phaseKind === 'hold' ? 0.03 : 0.02)
  const glowOpacity = 0.35 + pulse * 0.45

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ transform: `scale(${scale})`, transition: 'transform 0.4s ease-out' }}
    >
      <div
        className="absolute size-28 rounded-full blur-2xl"
        style={{
          background: 'radial-gradient(circle, rgba(95, 245, 224, 0.55) 0%, transparent 70%)',
          opacity: glowOpacity,
        }}
      />
      <svg
        viewBox="0 0 120 140"
        className="relative size-24 sm:size-28"
        aria-hidden="true"
      >
        <defs>
          <filter id="nose-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="nose-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7af0e0" />
            <stop offset="100%" stopColor="#3db8a8" />
          </linearGradient>
        </defs>

        <path
          d="M60 18 C42 18 30 38 30 62 C30 88 42 118 60 128 C78 118 90 88 90 62 C90 38 78 18 60 18 Z"
          fill="url(#nose-fill)"
          stroke="#5ff5e0"
          strokeWidth="2.5"
          filter="url(#nose-glow)"
          opacity="0.95"
        />

        <ellipse cx="48" cy="108" rx="7" ry="9" fill="#1a3030" opacity="0.85" />
        <ellipse cx="72" cy="108" rx="7" ry="9" fill="#1a3030" opacity="0.85" />

        <path
          d="M60 42 C54 58 52 78 54 96"
          stroke="#2a6860"
          strokeWidth="2"
          fill="none"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}
