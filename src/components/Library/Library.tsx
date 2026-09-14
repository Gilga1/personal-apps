import { MOODS } from "../../constants/moods";
import type { Track } from "../../types";
import { VirtualizedTrackTable } from "./VirtualizedTrackTable";

interface LibraryProps {
  tracks: Track[];
  currentTrackId: string | null;
  searchText: string;
  queuePrompt?: string | null;
  queueActive?: boolean;
  selectedIds: Set<string>;
  onSearch: (text: string) => void;
  onPickFolder: () => void;
  onOpenSettings: () => void;
  onResetQueue?: () => void;
  onPlay: (trackId: string) => void;
  onToggleSelect: (trackId: string, extendRange?: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onTagTracks: (trackIds: string[], mood: string) => void;
}

export function Library({
  tracks,
  currentTrackId,
  searchText,
  queuePrompt,
  queueActive,
  selectedIds,
  onSearch,
  onPickFolder,
  onOpenSettings,
  onResetQueue,
  onPlay,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onTagTracks,
}: LibraryProps) {
  const selectionCount = selectedIds.size;

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

      {selectionCount > 0 && (
        <div className="tag-toolbar">
          <span>
            {selectionCount} track{selectionCount === 1 ? "" : "s"} selected
          </span>
          <div className="tag-toolbar-moods">
            {MOODS.map((mood) => (
              <button
                key={mood}
                type="button"
                className="mood-chip compact"
                data-mood={mood}
                onClick={() => onTagTracks(Array.from(selectedIds), mood)}
              >
                {mood}
              </button>
            ))}
            <button
              type="button"
              className="mood-chip compact"
              data-mood="Unsorted"
              onClick={() => onTagTracks(Array.from(selectedIds), "Unsorted")}
            >
              Unsorted
            </button>
          </div>
          <button type="button" className="file-btn" onClick={onClearSelection}>
            Clear
          </button>
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
          selectedIds={selectedIds}
          onPlay={onPlay}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          onTagTracks={onTagTracks}
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
