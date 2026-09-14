import { useState } from "react";

interface CommandBarProps {
  onBuildQueue: (prompt: string, useLlm: boolean) => Promise<void>;
  useLlmRerank: boolean;
  queueActive?: boolean;
  onResetQueue?: () => void;
}

export function CommandBar({
  onBuildQueue,
  useLlmRerank,
  queueActive,
  onResetQueue,
}: CommandBarProps) {
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);

  const build = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || building) return;
    setBuilding(true);
    try {
      await onBuildQueue(trimmed, useLlmRerank);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <div className="nl-row">
        <input
          className="nl-input"
          placeholder="e.g. queue something like Chopin nocturnes and acoustic Hindi ballads"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") build();
          }}
          disabled={building}
        />
        <button type="button" onClick={build} disabled={building || !prompt.trim()}>
          {building ? "Building…" : "Build queue"}
        </button>
        {queueActive && onResetQueue && (
          <button
            type="button"
            className="icon-btn reset-queue-btn"
            title="Show all tracks"
            onClick={onResetQueue}
          >
            ↺
          </button>
        )}
      </div>
      <div className="nl-hint">
        Matches title, artist, album, and mood keywords offline
        {useLlmRerank ? "; LLM re-ranks top picks" : ""}. Run Auto-tag in Settings
        if most tracks are Unsorted.
      </div>
    </>
  );
}
