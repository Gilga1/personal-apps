import { create } from "zustand";
import type { Track } from "../types";

interface LibraryState {
  tracks: Track[];
  searchText: string;
  moodFilter: string | null;
  queueOverride: string[] | null;
  loading: boolean;
  setTracks: (tracks: Track[]) => void;
  setSearchText: (text: string) => void;
  setMoodFilter: (mood: string | null) => void;
  setQueueOverride: (ids: string[] | null) => void;
  setLoading: (loading: boolean) => void;
  updateTrack: (track: Track) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  searchText: "",
  moodFilter: null,
  queueOverride: null,
  loading: false,
  setTracks: (tracks) => set({ tracks }),
  setSearchText: (searchText) => set({ searchText, queueOverride: null }),
  setMoodFilter: (moodFilter) => set({ moodFilter, queueOverride: null }),
  setQueueOverride: (queueOverride) => set({ queueOverride, moodFilter: null }),
  setLoading: (loading) => set({ loading }),
  updateTrack: (track) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === track.id ? track : t)),
    })),
}));
