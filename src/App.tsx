import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildPlaylistQueue,
  getTracks,
  pickLibraryFolder,
  scanLibrary,
  setTrackMood,
} from "./api/stacks";
import { audioEngine } from "./audio/AudioEngine";
import { CommandBar } from "./components/CommandBar/CommandBar";
import { IngestPanel } from "./components/Ingest/IngestPanel";
import { Library } from "./components/Library/Library";
import { NowPlaying } from "./components/NowPlaying/NowPlaying";
import { PlaylistsPanel } from "./components/Playlists/PlaylistsPanel";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { useLibraryStore } from "./state/libraryStore";
import { getCurrentTrack, usePlayerStore } from "./state/playerStore";
import { useSettingsStore } from "./state/settingsStore";
import { isFullscreen, toggleFullscreen } from "./utils/fullscreen";
import "./styles/stacks.css";

function App() {
  const {
    tracks,
    searchText,
    moodFilter,
    queueOverride,
    loading,
    setTracks,
    setSearchText,
    setMoodFilter,
    setQueueOverride,
    setLoading,
    updateTrack,
  } = useLibraryStore();

  const {
    currentTrackId,
    isPlaying,
    shuffleOn,
    crossfadeOn,
    volume,
    setCurrentTrackId,
    setIsPlaying,
    toggleShuffle,
    toggleCrossfade,
    setVolume,
  } = usePlayerStore();

  const { setSettingsOpen, llmConfig } = useSettingsStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queuePrompt, setQueuePrompt] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const refreshTracks = useCallback(async () => {
    try {
      const data = await getTracks();
      setTracks(data);
    } catch (err) {
      console.error("Failed to load tracks:", err);
    }
  }, [setTracks]);

  useEffect(() => {
    refreshTracks();
  }, [refreshTracks]);

  useEffect(() => {
    audioEngine.setCrossfadeEnabled(crossfadeOn);
  }, [crossfadeOn]);

  const filteredTracks = useMemo(() => {
    let pool = tracks;
    if (queueOverride) {
      const order = new Map(queueOverride.map((id, i) => [id, i]));
      pool = tracks
        .filter((t) => order.has(t.id))
        .sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
      return pool;
    }
    if (moodFilter) {
      pool = pool.filter((t) => t.mood === moodFilter);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      pool = pool.filter((t) =>
        `${t.title}${t.artist}${t.album}`.toLowerCase().includes(q),
      );
    }
    return pool;
  }, [tracks, moodFilter, searchText, queueOverride]);

  const playPool = useMemo(() => {
    if (queueOverride) {
      return queueOverride
        .map((id) => tracks.find((t) => t.id === id))
        .filter(Boolean) as typeof tracks;
    }
    let pool = tracks;
    if (moodFilter) pool = pool.filter((t) => t.mood === moodFilter);
    if (searchText) {
      const q = searchText.toLowerCase();
      pool = pool.filter((t) =>
        `${t.title}${t.artist}${t.album}`.toLowerCase().includes(q),
      );
    }
    return pool;
  }, [tracks, moodFilter, searchText, queueOverride]);

  const playTrack = useCallback(
    async (trackId: string) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      setCurrentTrackId(trackId);
      try {
        await audioEngine.loadAndPlay(track.file_path);
        audioEngine.setVolume(volume);
        setIsPlaying(true);
        audioEngine.setPlaying(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Could not play this track: ${message}`);
        setIsPlaying(false);
        audioEngine.setPlaying(false);
      }
    },
    [tracks, volume, setCurrentTrackId, setIsPlaying],
  );

  const togglePlayPause = useCallback(async () => {
    if (!currentTrackId) {
      if (playPool[0]) await playTrack(playPool[0].id);
      return;
    }
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      audioEngine.setPlaying(false);
    } else {
      await audioEngine.play();
      setIsPlaying(true);
      audioEngine.setPlaying(true);
    }
  }, [currentTrackId, isPlaying, playPool, playTrack, setIsPlaying]);

  const step = useCallback(
    async (dir: 1 | -1) => {
      if (!playPool.length) return;
      const idx = playPool.findIndex((t) => t.id === currentTrackId);
      if (shuffleOn && !queueOverride) {
        const others = playPool.filter((t) => t.id !== currentTrackId);
        const next = others.length
          ? others[Math.floor(Math.random() * others.length)]
          : playPool[0];
        await playTrack(next.id);
        return;
      }
      const nextIdx =
        idx === -1
          ? 0
          : (idx + dir + playPool.length) % playPool.length;
      await playTrack(playPool[nextIdx].id);
    },
    [playPool, currentTrackId, shuffleOn, queueOverride, playTrack],
  );

  useEffect(() => {
    const unsubscribe = audioEngine.onProgress((time, dur) => {
      setCurrentTime(time);
      setDuration(dur);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    audioEngine.onEnded(() => {
      step(1);
    });
  }, [step]);

  useEffect(() => {
    void isFullscreen().then(setFullscreen);
  }, []);

  const handleToggleFullscreen = async () => {
    const next = await toggleFullscreen();
    setFullscreen(next);
  };

  const pickFolder = async () => {
    const folder = await pickLibraryFolder();
    if (!folder) return;
    setLoading(true);
    try {
      const added = await scanLibrary(folder);
      await refreshTracks();
      if (added === 0) {
        alert(
          "No FLAC or MP3 files found in that folder. Try a folder that contains audio files.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Library scan failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodClick = async (trackId: string) => {
    const mood = await setTrackMood(trackId);
    const track = tracks.find((t) => t.id === trackId);
    if (track) updateTrack({ ...track, mood, mood_source: "manual_override" });
  };

  const handleBuildQueue = async (prompt: string, useLlm: boolean) => {
    const ids = await buildPlaylistQueue(prompt, useLlm);
    if (!ids.length) {
      alert("No matches — try simpler terms or check your library.");
      return;
    }
    setQueuePrompt(prompt);
    setQueueOverride(ids);
    await playTrack(ids[0]);
  };

  const handleLoadPlaylist = async (ids: string[]) => {
    setQueuePrompt(null);
    setQueueOverride(ids);
    await playTrack(ids[0]);
  };

  const currentQueue = queueOverride ?? playPool.map((t) => t.id);
  const currentTrack = getCurrentTrack(tracks, currentTrackId);

  return (
    <div className={`app ${fullscreen ? "is-fullscreen" : ""}`}>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <div className="wordmark serif">Stacks</div>
          <div className="tagline">a fireside for a scattered collection</div>
        </div>
        <div className="header-actions">
          <div className="counts">
            {loading
              ? "Scanning…"
              : `${tracks.length} track${tracks.length === 1 ? "" : "s"} loaded`}
          </div>
          <button
            type="button"
            className="icon-btn"
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={handleToggleFullscreen}
          >
            {fullscreen ? "⤓" : "⤢"}
          </button>
        </div>
      </motion.header>

      <NowPlaying
        track={currentTrack}
        isPlaying={isPlaying}
        shuffleOn={shuffleOn}
        crossfadeOn={crossfadeOn}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        moodFilter={moodFilter}
        onPlayPause={togglePlayPause}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onShuffle={toggleShuffle}
        onCrossfade={toggleCrossfade}
        onSeek={(ratio) => audioEngine.seek(ratio)}
        onVolume={(v) => {
          setVolume(v);
          audioEngine.setVolume(v);
        }}
        onMoodFilter={setMoodFilter}
      />

      <motion.section
        className="library"
        style={{ marginTop: 0, border: "none", background: "transparent", padding: 0 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
      >
        <CommandBar
          onBuildQueue={handleBuildQueue}
          llmEnabled={!!llmConfig}
        />
        <IngestPanel onIngestComplete={refreshTracks} />
        <PlaylistsPanel
          currentQueue={currentQueue}
          queuePrompt={queuePrompt}
          onLoadPlaylist={handleLoadPlaylist}
        />
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
      >
      <Library
        tracks={filteredTracks}
        currentTrackId={currentTrackId}
        searchText={searchText}
        onSearch={setSearchText}
        onPickFolder={pickFolder}
        onOpenSettings={() => setSettingsOpen(true)}
        onPlay={(id) => {
          setQueueOverride(null);
          setQueuePrompt(null);
          playTrack(id);
        }}
        onMoodClick={handleMoodClick}
      />
      </motion.div>

      <SettingsModal />
    </div>
  );
}

export default App;
