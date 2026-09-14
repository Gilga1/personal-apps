import { motion } from "framer-motion";

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
      {MOODS.map((mood, i) => (
        <motion.button
          key={mood}
          type="button"
          className={`mood-chip ${activeMood === mood ? "active" : ""}`}
          data-mood={mood}
          onClick={() => onSelect(activeMood === mood ? null : mood)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.25 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          {mood}
        </motion.button>
      ))}
    </div>
  );
}
