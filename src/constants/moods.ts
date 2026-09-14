export const MOODS = [
  "Deep Focus",
  "Chill & Nostalgic",
  "High Energy",
  "Late Night",
] as const;

export type MoodLabel = (typeof MOODS)[number] | "Unsorted";

export const TAGGABLE_MOODS: MoodLabel[] = ["Unsorted", ...MOODS];
