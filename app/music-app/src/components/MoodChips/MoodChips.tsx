const MOODS = [
  "Deep Focus",
  "Chill & Nostalgic",
  "High Energy",
  "Late Night",
];

interface MoodChipsProps {
  activeMood: string | null;
  onSelect: (mood: string | null) => void;
}

export function MoodChips({ activeMood, onSelect }: MoodChipsProps) {
  return (
    <div className="mood-row">
      {MOODS.map((mood) => (
        <button
          key={mood}
          type="button"
          className={`mood-chip ${activeMood === mood ? "active" : ""}`}
          data-mood={mood}
          onClick={() => onSelect(activeMood === mood ? null : mood)}
        >
          {mood}
        </button>
      ))}
    </div>
  );
}
