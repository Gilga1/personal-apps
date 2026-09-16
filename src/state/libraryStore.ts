import { create } from "zustand";
import type { Track } from "../types";

interface LibraryState {
  tracks: Track[];
  searchText: string;
  moodFilter: string | null;
  likedOnly: boolean;
  queueOverride: string[] | null;
  loading: boolean;
  setTracks: (tracks: Track[]) => void;
  setSearchText: (text: string) => void;
  setMoodFilter: (mood: string | null) => void;
  setLikedOnly: (likedOnly: boolean) => void;
  setQueueOverride: (ids: string[] | null) => void;
  setLoading: (loading: boolean) => void;
  updateTrack: (track: Track) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  searchText: "",
  moodFilter: null,
  likedOnly: false,
  queueOverride: null,
  loading: false,
  setTracks: (tracks) => set({ tracks }),
  setSearchText: (searchText) => set({ searchText, queueOverride: null }),
  setMoodFilter: (moodFilter) => set({ moodFilter, queueOverride: null }),
  setLikedOnly: (likedOnly) => set({ likedOnly, queueOverride: null }),
  setQueueOverride: (queueOverride) =>
    set({ queueOverride, moodFilter: null, likedOnly: false }),
  setLoading: (loading) => set({ loading }),
  updateTrack: (track) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === track.id ? track : t)),
    })),
}));
