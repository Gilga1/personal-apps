import { create } from "zustand";
import type { LlmConfig, LlmProviderInfo } from "../types";

interface SettingsState {
  llmConfig: LlmConfig | null;
  providers: LlmProviderInfo[];
  settingsOpen: boolean;
  setLlmConfig: (config: LlmConfig) => void;
  setProviders: (providers: LlmProviderInfo[]) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  llmConfig: null,
  providers: [],
  settingsOpen: false,
  setLlmConfig: (llmConfig) => set({ llmConfig }),
  setProviders: (providers) => set({ providers }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
