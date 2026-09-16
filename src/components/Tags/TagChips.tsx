import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface TagChipsProps {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  onDeleteTag: (tag: string) => void;
  onCreateTag: (tag: string) => void;
}

export function TagChips({
  tags,
  activeTag,
  onSelect,
  onDeleteTag,
  onCreateTag,
}: TagChipsProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    onCreateTag(trimmed);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="tag-row">
      {tags.map((tag, i) => (
        <motion.div
          key={tag}
          className={`tag-chip-wrap ${activeTag === tag ? "active" : ""}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * i, duration: 0.2 }}
        >
          <button
            type="button"
            className={`tag-chip ${activeTag === tag ? "active" : ""}`}
            onClick={() => onSelect(activeTag === tag ? null : tag)}
          >
            {tag}
          </button>
          <button
            type="button"
            className="tag-chip-delete"
            title={`Remove tag “${tag}”`}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTag(tag);
            }}
          >
            ×
          </button>
        </motion.div>
      ))}

      {adding ? (
        <div className="tag-create-inline">
          <input
            ref={inputRef}
            className="tag-create-input"
            placeholder="New tag…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitDraft();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={submitDraft}
          />
        </div>
      ) : (
        <button
          type="button"
          className="tag-chip tag-add-btn"
          title="Create a tag"
          onClick={() => setAdding(true)}
        >
          +
        </button>
      )}
    </div>
  );
}
