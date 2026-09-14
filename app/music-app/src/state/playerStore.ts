import { create } from "zustand";
import type { Track } from "../types";

interface PlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  shuffleOn: boolean;
  crossfadeOn: boolean;
  volume: number;
  setCurrentTrackId: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  toggleShuffle: () => void;
  toggleCrossfade: () => void;
  setVolume: (volume: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrackId: null,
  isPlaying: false,
  shuffleOn: false,
  crossfadeOn: true,
  volume: 0.8,
  setCurrentTrackId: (currentTrackId) => set({ currentTrackId }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleShuffle: () => set((s) => ({ shuffleOn: !s.shuffleOn })),
  toggleCrossfade: () => set((s) => ({ crossfadeOn: !s.crossfadeOn })),
  setVolume: (volume) => set({ volume }),
}));

export function getCurrentTrack(
  tracks: Track[],
  currentTrackId: string | null,
): Track | null {
  if (!currentTrackId) return null;
  return tracks.find((t) => t.id === currentTrackId) ?? null;
}
