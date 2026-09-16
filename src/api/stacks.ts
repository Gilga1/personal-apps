import type {
  EnrichResult,
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

export async function deleteTag(tag: string): Promise<number> {
  if (isWebMode()) {
    const data = await api<{ count: number }>(`/api/tags/${encodeURIComponent(tag)}`, {
      method: "DELETE",
    });
    return data.count;
  }
  return invokeTauri<number>("delete_tag", { tag });
}

export async function toggleTrackLike(trackId: string): Promise<boolean> {
  if (isWebMode()) {
    const data = await api<{ liked: boolean }>(`/api/tracks/${trackId}/like`, {
      method: "POST",
    });
    return data.liked;
  }
  return invokeTauri<boolean>("toggle_track_like", { trackId });
}

export async function setTracksMood(
  trackIds: string[],
  mood: string,
): Promise<number> {
  if (isWebMode()) {
    let count = 0;
    for (const trackId of trackIds) {
      await api<{ mood: string }>(`/api/mood/${trackId}`, {
        method: "POST",
        body: JSON.stringify({ mood }),
      });
      count += 1;
    }
    return count;
  }
  return invokeTauri<number>("set_tracks_mood", { trackIds, mood });
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

export async function normalizeLowConfidence(): Promise<EnrichResult> {
  if (isWebMode()) {
    return api<EnrichResult>("/api/normalize/low-confidence", {
      method: "POST",
    });
  }
  return invokeTauri<EnrichResult>("normalize_low_confidence");
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

export async function ingestYoutube(
  url: string,
  playlistName?: string,
): Promise<string> {
  if (isWebMode()) {
    const data = await api<{ job_id: string }>("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ url, playlist_name: playlistName }),
    });
    return data.job_id;
  }
  return invokeTauri<string>("ingest_youtube", {
    url,
    playlistName: playlistName ?? null,
  });
}

export async function getIngestJobs(): Promise<IngestJob[]> {
  if (isWebMode()) return api<IngestJob[]>("/api/ingest");
  return invokeTauri<IngestJob[]>("get_ingest_jobs");
}

export async function cancelIngest(jobId: string): Promise<void> {
  if (isWebMode()) {
    await api(`/api/ingest/${jobId}/cancel`, { method: "POST" });
    return;
  }
  await invokeTauri("cancel_ingest", { jobId });
}

export async function checkYtdlpAvailable(): Promise<boolean> {
  if (isWebMode()) {
    const data = await api<{ available: boolean }>("/api/ingest/ytdlp");
    return data.available;
  }
  return invokeTauri<boolean>("check_ytdlp_available");
}

export async function ensureYtdlp(): Promise<void> {
  if (isWebMode()) return;
  await invokeTauri("ensure_ytdlp");
}

export async function readAudioBytes(filePath: string): Promise<Uint8Array> {
  if (isWebMode()) {
    const res = await fetch(
      `/api/media?path=${encodeURIComponent(filePath)}`,
    );
    if (!res.ok) throw new Error(`Failed to read audio (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const bytes = await invokeTauri<number[]>("read_audio_bytes", { path: filePath });
  return Uint8Array.from(bytes);
}

export async function getUseLlmRerank(): Promise<boolean> {
  if (isWebMode()) return false;
  return invokeTauri<boolean>("get_use_llm_rerank");
}

export async function setUseLlmRerank(enabled: boolean): Promise<void> {
  if (isWebMode()) return;
  await invokeTauri("set_use_llm_rerank", { enabled });
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
