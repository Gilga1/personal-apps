interface TurntableProps {
  isPlaying: boolean;
  label: string;
}

export function Turntable({ isPlaying, label }: TurntableProps) {
  return (
    <div className="plinth">
      <div className="turntable">
        <div className="glow" />
        <div className={`record ${isPlaying ? "playing" : ""}`}>
          <div className="label">{label}</div>
          <div className="spindle" />
        </div>
        <div className="tonearm-base" />
        <div className={`tonearm ${isPlaying ? "playing" : ""}`} />
      </div>
    </div>
  );
}
