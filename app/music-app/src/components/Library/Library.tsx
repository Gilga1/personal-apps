import type { Track } from "../../types";

function fmtTime(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

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

      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            <th>Title</th>
            <th>Artist</th>
            <th>Album</th>
            <th>Mood</th>
            <th style={{ width: 60 }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => (
            <tr
              key={track.id}
              className={track.id === currentTrackId ? "playing-row" : ""}
              onClick={() => onPlay(track.id)}
            >
              <td><span className="eq">♪</span></td>
              <td className="title-cell">
                <span className="t">{track.title}</span>
              </td>
              <td className="muted">{track.artist}</td>
              <td className="muted">{track.album}</td>
              <td>
                <span
                  className="mood-pill"
                  data-mood={track.mood}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoodClick(track.id);
                  }}
                >
                  {track.mood}
                </span>
              </td>
              <td className="muted">{fmtTime(track.duration_sec)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {tracks.length === 0 && (
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
