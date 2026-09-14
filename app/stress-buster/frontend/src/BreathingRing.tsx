import { useMemo } from 'react'
import { getPhaseOffsets, type BreathingPattern } from './breathingPattern'

interface BreathingRingProps {
  pattern: BreathingPattern
  progress: number
  phaseIndex: number
  size?: number
}

const SIZE = 280
const CENTER = SIZE / 2
const RADIUS = 118
const STROKE = 3

function polarToCartesian(angle: number, radius = RADIUS) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  }
}

function describeArc(startAngle: number, endAngle: number) {
  const start = polarToCartesian(startAngle)
  const end = polarToCartesian(endAngle)
  const sweep = endAngle - startAngle
  const largeArc = sweep > 180 ? 1 : 0

  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function BreathingRing({ pattern, progress, phaseIndex, size = SIZE }: BreathingRingProps) {
  const offsets = useMemo(() => getPhaseOffsets(pattern), [pattern])

  const dotAngle = progress * 360
  const dot = polarToCartesian(dotAngle)

  const markerAngles = offsets.map((offset) => offset * 360)

  const arcEndAngle = Math.max(progress * 360, 0.5)
  const activeArc = describeArc(0, arcEndAngle)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={size}
        height={size}
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="#2a4040"
          strokeWidth={STROKE}
          opacity="0.7"
        />

        {markerAngles.map((angle, i) => {
          const point = polarToCartesian(angle, RADIUS)
          const isActive = i <= phaseIndex
          return (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={3.5}
              fill={isActive ? '#5ff5e0' : '#4a5c5c'}
              opacity={isActive ? 0.9 : 0.45}
            />
          )
        })}

        <path
          d={activeArc}
          fill="none"
          stroke="#5ff5e0"
          strokeWidth={5}
          strokeLinecap="round"
          filter="url(#arc-glow)"
          opacity="0.85"
        />

        <circle
          cx={dot.x}
          cy={dot.y}
          r={7}
          fill="#ffffff"
          filter="url(#dot-glow)"
        />
        <circle
          cx={dot.x}
          cy={dot.y}
          r={4}
          fill="#e8fffc"
        />
      </svg>

    </div>
  )
}
