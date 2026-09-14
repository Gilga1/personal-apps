import type {
  IngestJob,
  LlmConfig,
  LlmProviderInfo,
  PlaylistSummary,
  Track,
} from "../types";

/** True when running in browser / Docker (no Tauri IPC). */
export function isWebMode(): boolean {
  return typeof window === "undefined"
    ? true
    : !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function pickLibraryFolder(): Promise<string | null> {
  if (isWebMode()) {
    // Docker: remount /music and call scan — no native folder dialog
    return "/music";
  }
  return invokeTauri<string | null>("pick_library_folder");
}

export async function scanLibrary(path: string): Promise<number> {
  if (isWebMode()) {
    const data = await api<{ added: number }>("/api/scan", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    return data.added;
  }
  return invokeTauri<number>("scan_library", { path });
}

export async function getTracks(): Promise<Track[]> {
  if (isWebMode()) return api<Track[]>("/api/tracks");
  return invokeTauri<Track[]>("get_tracks");
}

export async function setTrackMood(
  trackId: string,
  mood?: string,
): Promise<string> {
  if (isWebMode()) {
    const data = await api<{ mood: string }>(`/api/mood/${trackId}`, {
      method: "POST",
      body: JSON.stringify({ mood }),
    });
    return data.mood;
  }
  return invokeTauri<string>("set_track_mood", { trackId, mood });
}

export async function getLlmConfig(): Promise<LlmConfig> {
  if (isWebMode()) return api<LlmConfig>("/api/llm/config");
  return invokeTauri<LlmConfig>("get_llm_config");
}

export async function setLlmConfig(config: LlmConfig): Promise<void> {
  if (isWebMode()) {
    await api("/api/llm/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
    return;
  }
  return invokeTauri("set_llm_config", { config });
}

export async function testLlmConnection(): Promise<string> {
  if (isWebMode()) {
    const data = await api<{ message: string }>("/api/llm/test", { method: "POST" });
    return data.message;
  }
  return invokeTauri<string>("test_llm_connection");
}

export async function normalizeTrack(trackId: string): Promise<Track> {
  if (isWebMode()) {
    return api<Track>(`/api/normalize/${trackId}`, { method: "POST" });
  }
  return invokeTauri<Track>("normalize_track", { trackId });
}

export async function normalizeLowConfidence(): Promise<number> {
  if (isWebMode()) {
    const data = await api<{ count: number }>("/api/normalize/low-confidence", {
      method: "POST",
    });
    return data.count;
  }
  return invokeTauri<number>("normalize_low_confidence");
}

export async function buildPlaylistQueue(
  prompt: string,
  useLlm: boolean,
): Promise<string[]> {
  if (isWebMode()) {
    const data = await api<{ track_ids: string[] }>("/api/playlist/build", {
      method: "POST",
      body: JSON.stringify({ prompt, use_llm: useLlm }),
    });
    return data.track_ids;
  }
  return invokeTauri<string[]>("build_playlist_queue", { prompt, useLlm });
}

export async function listLlmProviders(): Promise<LlmProviderInfo[]> {
  if (isWebMode()) return api<LlmProviderInfo[]>("/api/llm/providers");
  return invokeTauri<LlmProviderInfo[]>("list_llm_providers");
}

export async function ingestYoutube(url: string): Promise<string> {
  if (isWebMode()) {
    const data = await api<{ job_id: string }>("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return data.job_id;
  }
  return invokeTauri<string>("ingest_youtube", { url });
}

export async function getIngestJobs(): Promise<IngestJob[]> {
  if (isWebMode()) return api<IngestJob[]>("/api/ingest");
  return invokeTauri<IngestJob[]>("get_ingest_jobs");
}

export async function checkYtdlpAvailable(): Promise<boolean> {
  if (isWebMode()) {
    const data = await api<{ available: boolean }>("/api/ingest/ytdlp");
    return data.available;
  }
  return invokeTauri<boolean>("check_ytdlp_available");
}

export async function savePlaylist(
  name: string,
  trackIds: string[],
  createdFrom?: string,
): Promise<string> {
  if (isWebMode()) {
    const data = await api<{ id: string }>("/api/playlists", {
      method: "POST",
      body: JSON.stringify({
        name,
        track_ids: trackIds,
        created_from: createdFrom,
      }),
    });
    return data.id;
  }
  return invokeTauri<string>("save_playlist", {
    name,
    track_ids: trackIds,
    created_from: createdFrom,
  });
}

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  if (isWebMode()) return api<PlaylistSummary[]>("/api/playlists");
  return invokeTauri<PlaylistSummary[]>("get_playlists");
}

export async function getPlaylistTracks(
  playlistId: string,
): Promise<string[]> {
  if (isWebMode()) {
    const data = await api<{ track_ids: string[] }>(
      `/api/playlists/${playlistId}`,
    );
    return data.track_ids;
  }
  return invokeTauri<string[]>("get_playlist_tracks", {
    playlist_id: playlistId,
  });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  if (isWebMode()) {
    await api(`/api/playlists/${playlistId}`, { method: "DELETE" });
    return;
  }
  return invokeTauri("delete_playlist", { playlist_id: playlistId });
}

/** Resolve a local file path to a playable URL (Tauri asset or HTTP media). */
export async function mediaUrl(filePath: string): Promise<string> {
  if (isWebMode()) {
    return `/api/media?path=${encodeURIComponent(filePath)}`;
  }
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(filePath);
}
