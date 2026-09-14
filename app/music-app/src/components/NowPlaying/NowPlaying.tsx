import { Turntable } from "../Turntable/Turntable";
import { MoodChips } from "../MoodChips/MoodChips";
import type { Track } from "../../types";

function fmtTime(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

interface NowPlayingProps {
  track: Track | null;
  isPlaying: boolean;
  shuffleOn: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  moodFilter: string | null;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onSeek: (ratio: number) => void;
  onVolume: (volume: number) => void;
  onMoodFilter: (mood: string | null) => void;
}

export function NowPlaying({
  track,
  isPlaying,
  shuffleOn,
  currentTime,
  duration,
  volume,
  moodFilter,
  onPlayPause,
  onPrev,
  onNext,
  onShuffle,
  onSeek,
  onVolume,
  onMoodFilter,
}: NowPlayingProps) {
  const label = (track?.album || track?.artist || "STACKS")
    .slice(0, 14)
    .toUpperCase();

  return (
    <section className="now-playing">
      <Turntable isPlaying={isPlaying} label={label} />

      <div className="np-info">
        <h1 className="np-title serif">
          {track?.title ?? "Nothing loaded yet"}
        </h1>
        <div className="np-sub">
          {track?.artist ?? "Choose a folder to begin"}
        </div>
        <div className="np-sub" style={{ opacity: 0.7 }}>
          {track
            ? `${track.album}${track.year ? ` · ${track.year}` : ""}`
            : ""}
        </div>

        <div className="np-tags">
          {track?.genre && <span className="tag">{track.genre}</span>}
          {track?.mood && <span className="tag">{track.mood}</span>}
          {track && (
            <span className="tag">
              {track.tag_source === "embedded"
                ? "Embedded tags"
                : track.tag_source === "llm_normalized"
                  ? "LLM normalized"
                  : "Filename match"}
            </span>
          )}
        </div>

        <div className="scrub-row">
          <span>{fmtTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={duration ? (currentTime / duration) * 1000 : 0}
            onChange={(e) => onSeek(Number(e.target.value) / 1000)}
          />
          <span>{fmtTime(duration)}</span>
        </div>

        <div className="transport">
          <button
            type="button"
            className={shuffleOn ? "active" : ""}
            onClick={onShuffle}
            title="Shuffle"
          >
            ⤮
          </button>
          <button type="button" onClick={onPrev} title="Previous">
            ⏮
          </button>
          <button
            type="button"
            className="play"
            onClick={onPlayPause}
            title="Play/Pause"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={onNext} title="Next">
            ⏭
          </button>
          <div className="vol-row">
            <span>🔊</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
            />
          </div>
        </div>

        <MoodChips activeMood={moodFilter} onSelect={onMoodFilter} />
      </div>
    </section>
  );
}
