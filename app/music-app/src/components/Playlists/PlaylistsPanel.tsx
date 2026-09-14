import { useEffect, useState } from "react";
import {
  deletePlaylist,
  getPlaylistTracks,
  getPlaylists,
  savePlaylist,
} from "../../api/stacks";
import type { PlaylistSummary } from "../../types";

interface PlaylistsPanelProps {
  currentQueue: string[];
  queuePrompt?: string | null;
  onLoadPlaylist: (trackIds: string[]) => void;
}

export function PlaylistsPanel({
  currentQueue,
  queuePrompt,
  onLoadPlaylist,
}: PlaylistsPanelProps) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [saveName, setSaveName] = useState("");
  const [expanded, setExpanded] = useState(false);

  const refresh = async () => {
    setPlaylists(await getPlaylists());
  };

  useEffect(() => {
    if (expanded) refresh();
  }, [expanded]);

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name || !currentQueue.length) return;
    await savePlaylist(name, currentQueue, queuePrompt ?? undefined);
    setSaveName("");
    await refresh();
  };

  const handleLoad = async (id: string) => {
    const ids = await getPlaylistTracks(id);
    if (ids.length) onLoadPlaylist(ids);
  };

  const handleDelete = async (id: string) => {
    await deletePlaylist(id);
    await refresh();
  };

  return (
    <div className="playlists-panel">
      <button
        type="button"
        className="file-btn"
        onClick={() => setExpanded(!expanded)}
      >
        Playlists {expanded ? "▾" : "▸"}
      </button>

      {expanded && (
        <div className="playlists-body">
          {currentQueue.length > 0 && (
            <div className="playlist-save-row">
              <input
                className="search-input"
                placeholder="Save current queue as…"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <button type="button" className="primary-btn" onClick={handleSave}>
                Save
              </button>
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="playlists-empty">No saved playlists yet.</p>
          ) : (
            <ul className="playlists-list">
              {playlists.map((pl) => (
                <li key={pl.id} className="playlist-item">
                  <button
                    type="button"
                    className="playlist-load"
                    onClick={() => handleLoad(pl.id)}
                  >
                    <span className="playlist-name">{pl.name}</span>
                    <span className="playlist-meta">
                      {pl.track_count} track{pl.track_count === 1 ? "" : "s"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="playlist-delete"
                    title="Delete"
                    onClick={() => handleDelete(pl.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
