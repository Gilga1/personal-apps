import { invoke } from "@tauri-apps/api/core";
import type { LlmConfig, LlmProviderInfo, Track } from "../types";

export async function pickLibraryFolder(): Promise<string | null> {
  return invoke<string | null>("pick_library_folder");
}

export async function scanLibrary(path: string): Promise<number> {
  return invoke<number>("scan_library", { path });
}

export async function getTracks(): Promise<Track[]> {
  return invoke<Track[]>("get_tracks");
}

export async function setTrackMood(
  trackId: string,
  mood?: string,
): Promise<string> {
  return invoke<string>("set_track_mood", { trackId, mood });
}

export async function getLlmConfig(): Promise<LlmConfig> {
  return invoke<LlmConfig>("get_llm_config");
}

export async function setLlmConfig(config: LlmConfig): Promise<void> {
  return invoke("set_llm_config", { config });
}

export async function testLlmConnection(): Promise<string> {
  return invoke<string>("test_llm_connection");
}

export async function normalizeTrack(trackId: string): Promise<Track> {
  return invoke<Track>("normalize_track", { trackId });
}

export async function normalizeLowConfidence(): Promise<number> {
  return invoke<number>("normalize_low_confidence");
}

export async function buildPlaylistQueue(
  prompt: string,
  useLlm: boolean,
): Promise<string[]> {
  return invoke<string[]>("build_playlist_queue", { prompt, useLlm });
}

export async function listLlmProviders(): Promise<LlmProviderInfo[]> {
  return invoke<LlmProviderInfo[]>("list_llm_providers");
}
