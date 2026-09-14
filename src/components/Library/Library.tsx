import { VirtualizedTrackTable } from "./VirtualizedTrackTable";
import type { Track } from "../../types";

interface LibraryProps {
  tracks: Track[];
  currentTrackId: string | null;
  searchText: string;
  queuePrompt?: string | null;
  queueActive?: boolean;
  onSearch: (text: string) => void;
  onPickFolder: () => void;
  onOpenSettings: () => void;
  onResetQueue?: () => void;
  onPlay: (trackId: string) => void;
  onMoodClick: (trackId: string) => void;
}

export function Library({
  tracks,
  currentTrackId,
  searchText,
  queuePrompt,
  queueActive,
  onSearch,
  onPickFolder,
  onOpenSettings,
  onResetQueue,
  onPlay,
  onMoodClick,
}: LibraryProps) {
  return (
    <section className="library">
      {queueActive && queuePrompt && (
        <div className="queue-banner">
          <span>
            Queue: <strong>{queuePrompt}</strong> · {tracks.length} track
            {tracks.length === 1 ? "" : "s"}
          </span>
          {onResetQueue && (
            <button
              type="button"
              className="icon-btn"
              title="Show all tracks"
              onClick={onResetQueue}
            >
              ↺
            </button>
          )}
        </div>
      )}

      <div className="lib-head">
        <h2>Library</h2>
        <input
          className="search-input"
          placeholder="Filter by title, artist, album…"
          value={searchText}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button type="button" className="file-btn" onClick={onPickFolder}>
          Choose folder
        </button>
        <button type="button" className="file-btn" onClick={onOpenSettings}>
          Settings
        </button>
      </div>

      {tracks.length > 0 ? (
        <VirtualizedTrackTable
          tracks={tracks}
          currentTrackId={currentTrackId}
          onPlay={onPlay}
          onMoodClick={onMoodClick}
        />
      ) : (
        <div className="empty-state">
          {queueActive
            ? "No tracks matched this queue. Try different words or reset to browse your full library."
            : "No tracks yet. Point it at a folder of FLAC/MP3 files — nested composer folders, loose downloads, whatever shape it's already in."}
          <div>
            {queueActive && onResetQueue ? (
              <button type="button" className="file-btn" onClick={onResetQueue}>
                Show all tracks
              </button>
            ) : (
              <button type="button" className="file-btn" onClick={onPickFolder}>
                Choose folder
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
