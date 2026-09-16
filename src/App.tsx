import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildPlaylistQueue,
  deleteTag,
  getTracks,
  getUseLlmRerank,
  pickLibraryFolder,
  scanLibrary,
  setTracksMood,
  toggleTrackLike,
} from "./api/stacks";
import { audioEngine } from "./audio/AudioEngine";
import { CommandBar } from "./components/CommandBar/CommandBar";
import { IngestPanel } from "./components/Ingest/IngestPanel";
import { Library } from "./components/Library/Library";
import { NowPlaying } from "./components/NowPlaying/NowPlaying";
import { PlaylistsPanel } from "./components/Playlists/PlaylistsPanel";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { ToastStack } from "./components/Toast/ToastStack";
import { useLibraryStore } from "./state/libraryStore";
import { getCurrentTrack, usePlayerStore } from "./state/playerStore";
import { useSettingsStore } from "./state/settingsStore";
import { useToastStore } from "./state/toastStore";
import { isFullscreen, toggleFullscreen } from "./utils/fullscreen";
import "./styles/stacks.css";

function App() {
  const {
    tracks,
    searchText,
    moodFilter,
    likedOnly,
    queueOverride,
    loading,
    setTracks,
    setSearchText,
    setMoodFilter,
    setLikedOnly,
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

  const { setSettingsOpen, useLlmRerank } = useSettingsStore();
  const { push, update, dismiss } = useToastStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queuePrompt, setQueuePrompt] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);

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
    getUseLlmRerank().then(useSettingsStore.getState().setUseLlmRerank);
  }, []);

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
    if (likedOnly) {
      pool = pool.filter((t) => t.liked);
    }
    if (moodFilter) {
      pool = pool.filter(
        (t) =>
          t.mood === moodFilter || t.situational_tags.includes(moodFilter),
      );
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      pool = pool.filter((t) =>
        `${t.title}${t.artist}${t.album}`.toLowerCase().includes(q),
      );
    }
    return pool;
  }, [tracks, moodFilter, likedOnly, searchText, queueOverride]);

  const playPool = useMemo(() => {
    if (queueOverride) {
      return queueOverride
        .map((id) => tracks.find((t) => t.id === id))
        .filter(Boolean) as typeof tracks;
    }
    let pool = tracks;
    if (likedOnly) {
      pool = pool.filter((t) => t.liked);
    }
    if (moodFilter) {
      pool = pool.filter(
        (t) =>
          t.mood === moodFilter || t.situational_tags.includes(moodFilter),
      );
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      pool = pool.filter((t) =>
        `${t.title}${t.artist}${t.album}`.toLowerCase().includes(q),
      );
    }
    return pool;
  }, [tracks, moodFilter, likedOnly, searchText, queueOverride]);

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
    let lastTick = 0;
    const unsubscribe = audioEngine.onProgress((time, dur) => {
      const now = performance.now();
      if (now - lastTick < 200) return;
      lastTick = now;
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

  const handleToggleSelect = useCallback(
    (trackId: string, extendRange?: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (extendRange && selectionAnchorId) {
          const ids = filteredTracks.map((t) => t.id);
          const a = ids.indexOf(selectionAnchorId);
          const b = ids.indexOf(trackId);
          if (a >= 0 && b >= 0) {
            const [start, end] = a < b ? [a, b] : [b, a];
            for (let i = start; i <= end; i += 1) {
              next.add(ids[i]);
            }
            return next;
          }
        }
        if (next.has(trackId)) next.delete(trackId);
        else next.add(trackId);
        return next;
      });
      setSelectionAnchorId(trackId);
    },
    [filteredTracks, selectionAnchorId],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(filteredTracks.map((t) => t.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [filteredTracks],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of tracks) {
      if (t.mood && t.mood !== "Unsorted") set.add(t.mood);
      for (const tag of t.situational_tags) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const handleTagTracks = async (trackIds: string[], mood: string) => {
    if (!trackIds.length) return;
    await setTracksMood(trackIds, mood);
    for (const id of trackIds) {
      const track = tracks.find((t) => t.id === id);
      if (track) {
        updateTrack({ ...track, mood, mood_source: "manual_override" });
      }
    }
    setSelectedIds(new Set());
  };

  const handleCreateTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || trimmed === "Unsorted") return;
    const ids =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : currentTrackId
          ? [currentTrackId]
          : [];
    if (!ids.length) {
      const toastId = push(
        "Select tracks in the library, or play one, then press + to tag.",
        "error",
      );
      setTimeout(() => dismiss(toastId), 4000);
      return;
    }
    await handleTagTracks(ids, trimmed);
  };

  const handleDeleteTag = async (tag: string) => {
    await deleteTag(tag);
    if (moodFilter === tag) setMoodFilter(null);
    await refreshTracks();
  };

  const handleToggleLike = async (trackId?: string) => {
    const id = typeof trackId === "string" ? trackId : currentTrackId;
    if (!id) return;
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    try {
      const liked = await toggleTrackLike(id);
      updateTrack({ ...track, liked });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push(`Could not update like: ${message}`, "error");
    }
  };

  const resetQueue = useCallback(() => {
    setQueueOverride(null);
    setQueuePrompt(null);
    setMoodFilter(null);
    setLikedOnly(false);
    setSearchText("");
  }, [setQueueOverride, setMoodFilter, setLikedOnly, setSearchText]);

  const handlePlaylistImported = useCallback(
    (ids: string[]) => {
      setQueueOverride(ids);
      setQueuePrompt("YouTube import");
    },
    [setQueueOverride],
  );

  const handleBuildQueue = async (prompt: string, useLlm: boolean) => {
    const toastId = push(`Building queue for "${prompt}"…`, "progress", 0);
    try {
      const ids = await buildPlaylistQueue(prompt, useLlm);
      if (!ids.length) {
        update(
          toastId,
          "No matches — try words like workout, focus, or an artist name.",
          "error",
        );
        setTimeout(() => dismiss(toastId), 5000);
        return;
      }
      setQueuePrompt(prompt);
      setQueueOverride(ids);
      update(
        toastId,
        `Queue ready — ${ids.length} track${ids.length === 1 ? "" : "s"} matched.`,
        "success",
        100,
      );
      setTimeout(() => dismiss(toastId), 4000);
      await playTrack(ids[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      update(toastId, `Queue build failed: ${message}`, "error");
      setTimeout(() => dismiss(toastId), 5000);
    }
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
        onPlayPause={togglePlayPause}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onShuffle={toggleShuffle}
        onCrossfade={toggleCrossfade}
        onToggleLike={handleToggleLike}
        onSeek={(ratio) => audioEngine.seek(ratio)}
        onVolume={(v) => {
          setVolume(v);
          audioEngine.setVolume(v);
        }}
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
          useLlmRerank={useLlmRerank}
          queueActive={!!queueOverride}
          onResetQueue={resetQueue}
        />
        <IngestPanel
          onIngestComplete={refreshTracks}
          onPlaylistImported={handlePlaylistImported}
        />
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
        allTags={allTags}
        currentTrackId={currentTrackId}
        searchText={searchText}
        tagFilter={moodFilter}
        likedOnly={likedOnly}
        queuePrompt={queuePrompt}
        queueActive={!!queueOverride}
        selectedIds={selectedIds}
        onSearch={setSearchText}
        onPickFolder={pickFolder}
        onOpenSettings={() => setSettingsOpen(true)}
        onResetQueue={resetQueue}
        onPlay={(id) => {
          playTrack(id);
        }}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onClearSelection={() => setSelectedIds(new Set())}
        onTagTracks={handleTagTracks}
        onCreateTag={handleCreateTag}
        onDeleteTag={handleDeleteTag}
        onTagFilter={setMoodFilter}
        onLikedOnly={setLikedOnly}
        onToggleLike={handleToggleLike}
      />
      </motion.div>

      <SettingsModal onLibraryTagged={refreshTracks} />
      <ToastStack />
    </div>
  );
}

export default App;
