import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../../types";
import { MoodPicker } from "./MoodPicker";
import { TrackCheckbox } from "./TrackCheckbox";

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
  selectedIds: Set<string>;
  onPlay: (trackId: string) => void;
  onToggleSelect: (trackId: string, extendRange?: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onTagTracks: (trackIds: string[], mood: string) => void;
}

export function VirtualizedTrackTable({
  tracks,
  currentTrackId,
  selectedIds,
  onPlay,
  onToggleSelect,
  onSelectAll,
  onTagTracks,
}: VirtualizedTrackTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(420);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [pickerTrackIds, setPickerTrackIds] = useState<string[]>([]);

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

  const openPicker = (trackIds: string[], target: HTMLElement) => {
    setPickerTrackIds(trackIds);
    setPickerAnchor(target.getBoundingClientRect());
  };

  const closePicker = () => {
    setPickerAnchor(null);
    setPickerTrackIds([]);
  };

  const allSelected = tracks.length > 0 && tracks.every((t) => selectedIds.has(t.id));

  const totalHeight = tracks.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER * 2;
  const endIdx = Math.min(tracks.length, startIdx + visibleCount);
  const offsetY = startIdx * ROW_HEIGHT;
  const visible = tracks.slice(startIdx, endIdx);

  return (
    <>
      <div ref={containerRef} className="virt-scroll" onScroll={onScroll}>
        <div className="virt-inner" style={{ height: totalHeight }}>
          <table
            className="virt-table track-table"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            <thead>
              <tr>
                <th className="col-check">
                  <TrackCheckbox
                    checked={allSelected}
                    label="Select all tracks"
                    onToggle={() => onSelectAll(!allSelected)}
                  />
                </th>
                <th className="col-eq" />
                <th className="col-title">Title</th>
                <th className="col-artist">Artist</th>
                <th className="col-album">Album</th>
                <th className="col-mood">Mood</th>
                <th className="col-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((track) => (
                <tr
                  key={track.id}
                  className={[
                    track.id === currentTrackId ? "playing-row" : "",
                    selectedIds.has(track.id) ? "selected-row" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onPlay(track.id)}
                >
                  <td className="col-check" onClick={(e) => e.stopPropagation()}>
                    <TrackCheckbox
                      checked={selectedIds.has(track.id)}
                      label={`Select ${track.title}`}
                      onToggle={(shiftKey) => onToggleSelect(track.id, shiftKey)}
                    />
                  </td>
                  <td className="col-eq"><span className="eq">♪</span></td>
                  <td className="col-title title-cell">
                    <span className="t">{track.title}</span>
                  </td>
                  <td className="col-artist muted">{track.artist}</td>
                  <td className="col-album muted">{track.album}</td>
                  <td className="col-mood">
                    <span
                      className="mood-pill"
                      data-mood={track.mood}
                      title="Click to tag"
                      onClick={(e) => {
                        e.stopPropagation();
                        const ids = selectedIds.has(track.id)
                          ? Array.from(selectedIds)
                          : [track.id];
                        openPicker(ids, e.currentTarget);
                      }}
                    >
                      {track.mood}
                    </span>
                  </td>
                  <td className="col-time muted">{fmtTime(track.duration_sec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <MoodPicker
        anchorRect={pickerAnchor}
        onClose={closePicker}
        onSelect={(mood) => {
          onTagTracks(pickerTrackIds, mood);
          closePicker();
        }}
      />
    </>
  );
}
