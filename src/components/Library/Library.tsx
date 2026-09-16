import type { Track } from "../../types";
import { TagChips } from "../Tags/TagChips";
import { VirtualizedTrackTable } from "./VirtualizedTrackTable";

interface LibraryProps {
  tracks: Track[];
  allTags: string[];
  currentTrackId: string | null;
  searchText: string;
  tagFilter: string | null;
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
  onCreateTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
  onTagFilter: (tag: string | null) => void;
  onToggleLike: (trackId: string) => void;
}

export function Library({
  tracks,
  allTags,
  currentTrackId,
  searchText,
  tagFilter,
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
  onCreateTag,
  onDeleteTag,
  onTagFilter,
  onToggleLike,
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

      <p className="library-hint">
        Click a <strong>tag pill</strong> on a track to tag it. Use <strong>+</strong>{" "}
        to create a tag (applies to selected rows, or the playing track). Hover a
        filter tag and click <strong>×</strong> to remove it from all tracks.
        For bulk keyword tagging, use <strong>Auto-tag library</strong> in Settings.
      </p>

      <TagChips
        tags={allTags}
        activeTag={tagFilter}
        onSelect={onTagFilter}
        onDeleteTag={onDeleteTag}
        onCreateTag={onCreateTag}
      />

      {selectionCount > 0 && (
        <div className="tag-toolbar">
          <span className="tag-toolbar-count">
            {selectionCount} selected — quick tag:
          </span>
          <div className="tag-toolbar-moods">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="tag-chip compact"
                onClick={() => onTagTracks(Array.from(selectedIds), tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <button type="button" className="file-btn" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      )}

      {tracks.length > 0 ? (
        <VirtualizedTrackTable
          tracks={tracks}
          allTags={allTags}
          currentTrackId={currentTrackId}
          selectedIds={selectedIds}
          onPlay={onPlay}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          onTagTracks={onTagTracks}
          onToggleLike={onToggleLike}
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
