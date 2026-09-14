import { useState } from "react";

interface CommandBarProps {
  onBuildQueue: (prompt: string, useLlm: boolean) => void;
  llmEnabled: boolean;
}

export function CommandBar({ onBuildQueue, llmEnabled }: CommandBarProps) {
  const [prompt, setPrompt] = useState("");

  return (
    <>
      <div className="nl-row">
        <input
          className="nl-input"
          placeholder="e.g. queue something like Chopin nocturnes and acoustic Hindi ballads"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && prompt.trim()) {
              onBuildQueue(prompt.trim(), llmEnabled);
            }
          }}
        />
        <button type="button" onClick={() => prompt.trim() && onBuildQueue(prompt.trim(), llmEnabled)}>
          Build queue
        </button>
      </div>
      <div className="nl-hint">
        Keyword matching offline{llmEnabled ? " with optional LLM re-rank" : ""}.
        Configure provider in Settings.
      </div>
    </>
  );
}
