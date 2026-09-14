import { useEffect, useRef } from "react";
import { TAGGABLE_MOODS } from "../../constants/moods";

interface MoodPickerProps {
  anchorRect: DOMRect | null;
  onSelect: (mood: string) => void;
  onClose: () => void;
}

export function MoodPicker({ anchorRect, onSelect, onClose }: MoodPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  if (!anchorRect) return null;

  const top = anchorRect.bottom + 6;
  const left = Math.max(8, anchorRect.left);

  return (
    <div
      ref={ref}
      className="mood-picker"
      style={{ top, left }}
      role="menu"
    >
      <p className="mood-picker-label">Tag as</p>
      {TAGGABLE_MOODS.map((mood) => (
        <button
          key={mood}
          type="button"
          className="mood-picker-option"
          data-mood={mood}
          onClick={() => onSelect(mood)}
        >
          {mood}
        </button>
      ))}
    </div>
  );
}
