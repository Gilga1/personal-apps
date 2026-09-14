import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../../types";

const ROW_HEIGHT = 42;
const BUFFER = 6;

function fmtTime(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

interface VirtualizedTrackTableProps {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (trackId: string) => void;
  onMoodClick: (trackId: string) => void;
}

export function VirtualizedTrackTable({
  tracks,
  currentTrackId,
  onPlay,
  onMoodClick,
}: VirtualizedTrackTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(420);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = tracks.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const visibleCount =
    Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER * 2;
  const endIdx = Math.min(tracks.length, startIdx + visibleCount);
  const offsetY = startIdx * ROW_HEIGHT;
  const visible = tracks.slice(startIdx, endIdx);

  return (
    <div
      ref={containerRef}
      className="virt-scroll"
      onScroll={onScroll}
    >
      <div className="virt-inner" style={{ height: totalHeight }}>
        <table className="virt-table" style={{ transform: `translateY(${offsetY}px)` }}>
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
            {visible.map((track) => (
              <tr
                key={track.id}
                className={track.id === currentTrackId ? "playing-row" : ""}
                style={{ height: ROW_HEIGHT }}
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
      </div>
    </div>
  );
}
