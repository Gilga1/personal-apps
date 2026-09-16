interface TrackCheckboxProps {
  checked: boolean;
  label: string;
  onToggle: (shiftKey: boolean) => void;
}

export function TrackCheckbox({ checked, label, onToggle }: TrackCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`track-check ${checked ? "checked" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
    >
      {checked ? "✓" : ""}
    </button>
  );
}
