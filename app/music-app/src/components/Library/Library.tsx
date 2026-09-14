import { VirtualizedTrackTable } from "./VirtualizedTrackTable";
import type { Track } from "../../types";

interface LibraryProps {
  tracks: Track[];
  currentTrackId: string | null;
  searchText: string;
  onSearch: (text: string) => void;
  onPickFolder: () => void;
  onOpenSettings: () => void;
  onPlay: (trackId: string) => void;
  onMoodClick: (trackId: string) => void;
}

export function Library({
  tracks,
  currentTrackId,
  searchText,
  onSearch,
  onPickFolder,
  onOpenSettings,
  onPlay,
  onMoodClick,
}: LibraryProps) {
  return (
    <section className="library">
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
          No tracks yet. Point it at a folder of FLAC/MP3 files — nested composer
          folders, loose downloads, whatever shape it&apos;s already in.
          <div>
            <button type="button" className="file-btn" onClick={onPickFolder}>
              Choose folder
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
