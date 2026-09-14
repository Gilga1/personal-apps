export type BreathingPhaseKind = 'inhale' | 'hold' | 'exhale'

export interface BreathingPhase {
  kind: BreathingPhaseKind
  duration: number
  instruction: string
  subInstruction?: string
}

export interface BreathingPattern {
  id: string
  name: string
  phases: BreathingPhase[]
}

export const DEFAULT_PATTERN: BreathingPattern = {
  id: 'relax-4-4-8',
  name: 'Relax 4-4-8',
  phases: [
    {
      kind: 'inhale',
      duration: 4,
      instruction: 'Slow inhale',
      subInstruction: 'through nose',
    },
    {
      kind: 'hold',
      duration: 4,
      instruction: 'Hold',
      subInstruction: 'gently',
    },
    {
      kind: 'exhale',
      duration: 8,
      instruction: 'Slow exhale',
      subInstruction: 'through mouth',
    },
  ],
}

export const PATTERNS: BreathingPattern[] = [
  DEFAULT_PATTERN,
  {
    id: 'box-4-4-4-4',
    name: 'Box 4-4-4-4',
    phases: [
      {
        kind: 'inhale',
        duration: 4,
        instruction: 'Slow inhale',
        subInstruction: 'through nose',
      },
      {
        kind: 'hold',
        duration: 4,
        instruction: 'Hold',
        subInstruction: 'full lungs',
      },
      {
        kind: 'exhale',
        duration: 4,
        instruction: 'Slow exhale',
        subInstruction: 'through mouth',
      },
      {
        kind: 'hold',
        duration: 4,
        instruction: 'Hold',
        subInstruction: 'empty lungs',
      },
    ],
  },
  {
    id: 'calm-4-7-8',
    name: 'Calm 4-7-8',
    phases: [
      {
        kind: 'inhale',
        duration: 4,
        instruction: 'Slow inhale',
        subInstruction: 'through nose',
      },
      {
        kind: 'hold',
        duration: 7,
        instruction: 'Hold',
        subInstruction: 'gently',
      },
      {
        kind: 'exhale',
        duration: 8,
        instruction: 'Slow exhale',
        subInstruction: 'through mouth',
      },
    ],
  },
]

export function getTotalDuration(pattern: BreathingPattern): number {
  return pattern.phases.reduce((sum, phase) => sum + phase.duration, 0)
}

export function getPhaseOffsets(pattern: BreathingPattern): number[] {
  const total = getTotalDuration(pattern)
  let elapsed = 0
  return pattern.phases.map((phase) => {
    const start = elapsed / total
    elapsed += phase.duration
    return start
  })
}
