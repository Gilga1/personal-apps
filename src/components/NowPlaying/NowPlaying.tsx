import { AnimatePresence, motion } from "framer-motion";
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
  crossfadeOn: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  moodFilter: string | null;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onCrossfade: () => void;
  onSeek: (ratio: number) => void;
  onVolume: (volume: number) => void;
  onMoodFilter: (mood: string | null) => void;
}

export function NowPlaying({
  track,
  isPlaying,
  shuffleOn,
  crossfadeOn,
  currentTime,
  duration,
  volume,
  moodFilter,
  onPlayPause,
  onPrev,
  onNext,
  onShuffle,
  onCrossfade,
  onSeek,
  onVolume,
  onMoodFilter,
}: NowPlayingProps) {
  const label = (track?.album || track?.artist || "STACKS")
    .slice(0, 14)
    .toUpperCase();

  const muted = volume === 0;

  return (
    <motion.section
      className="now-playing"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Turntable isPlaying={isPlaying} label={label} />

      <div className="np-info">
        <AnimatePresence mode="wait">
          <motion.div
            key={track?.id ?? "empty"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
          >
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
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="np-tags"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
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
        </motion.div>

        <div className="scrub-row">
          <span>{fmtTime(currentTime)}</span>
          <input
            type="range"
            className="scrub-slider"
            min={0}
            max={1000}
            value={duration ? (currentTime / duration) * 1000 : 0}
            onChange={(e) => onSeek(Number(e.target.value) / 1000)}
          />
          <span>{fmtTime(duration)}</span>
        </div>

        <div className="transport-row">
          <div className="transport">
            <motion.button
              type="button"
              className={shuffleOn ? "active" : ""}
              onClick={onShuffle}
              title="Shuffle"
              whileTap={{ scale: 0.92 }}
            >
              ⤮
            </motion.button>
            <motion.button
              type="button"
              className={crossfadeOn ? "active" : ""}
              onClick={onCrossfade}
              title="Crossfade"
              whileTap={{ scale: 0.92 }}
            >
              ∿
            </motion.button>
            <motion.button
              type="button"
              onClick={onPrev}
              title="Previous"
              whileTap={{ scale: 0.92 }}
            >
              ⏮
            </motion.button>
            <motion.button
              type="button"
              className="play"
              onClick={onPlayPause}
              title="Play/Pause"
              whileTap={{ scale: 0.94 }}
              animate={isPlaying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
            >
              {isPlaying ? "⏸" : "▶"}
            </motion.button>
            <motion.button
              type="button"
              onClick={onNext}
              title="Next"
              whileTap={{ scale: 0.92 }}
            >
              ⏭
            </motion.button>
          </div>

          <div className="volume-panel">
            <button
              type="button"
              className="vol-icon"
              title={muted ? "Unmute" : "Mute"}
              onClick={() => onVolume(muted ? 0.8 : 0)}
            >
              {muted ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              className="volume-slider"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
            />
            <span className="vol-label">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <MoodChips activeMood={moodFilter} onSelect={onMoodFilter} />
      </div>
    </motion.section>
  );
}
