import { useEffect, useRef, useState } from "react";

interface TagPickerProps {
  anchorRect: DOMRect | null;
  tags: string[];
  onSelect: (tag: string) => void;
  onClose: () => void;
}

export function TagPicker({ anchorRect, tags, onSelect, onClose }: TagPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
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

  const submitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onSelect(trimmed);
      setDraft("");
    }
  };

  return (
    <div ref={ref} className="mood-picker" style={{ top, left }} role="menu">
      <p className="mood-picker-label">Tag as</p>
      <div className="tag-picker-create">
        <input
          ref={inputRef}
          className="tag-create-input"
          placeholder="Type a new tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitDraft();
          }}
        />
        <button type="button" className="file-btn compact" onClick={submitDraft}>
          Apply
        </button>
      </div>
      {tags.length > 0 && (
        <div className="tag-picker-list">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="mood-picker-option"
              onClick={() => onSelect(tag)}
            >
              {tag}
            </button>
          ))}
          <button
            type="button"
            className="mood-picker-option muted-option"
            onClick={() => onSelect("Unsorted")}
          >
            Unsorted
          </button>
        </div>
      )}
    </div>
  );
}
