import type { UserProfile } from './api'

const STORAGE_KEY = 'thaliscan-profile'

export const DEFAULT_PROFILE: UserProfile = {
  activity_level: 'moderate',
  conditions: [],
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}
