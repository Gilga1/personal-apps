import { invoke } from "@tauri-apps/api/core";
import type {
  IngestJob,
  LlmConfig,
  LlmProviderInfo,
  PlaylistSummary,
  Track,
} from "../types";

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

export async function ingestYoutube(url: string): Promise<string> {
  return invoke<string>("ingest_youtube", { url });
}

export async function getIngestJobs(): Promise<IngestJob[]> {
  return invoke<IngestJob[]>("get_ingest_jobs");
}

export async function checkYtdlpAvailable(): Promise<boolean> {
  return invoke<boolean>("check_ytdlp_available");
}

export async function savePlaylist(
  name: string,
  trackIds: string[],
  createdFrom?: string,
): Promise<string> {
  return invoke<string>("save_playlist", {
    name,
    track_ids: trackIds,
    created_from: createdFrom,
  });
}

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  return invoke<PlaylistSummary[]>("get_playlists");
}

export async function getPlaylistTracks(
  playlistId: string,
): Promise<string[]> {
  return invoke<string[]>("get_playlist_tracks", { playlist_id: playlistId });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  return invoke("delete_playlist", { playlist_id: playlistId });
}
