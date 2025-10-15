export type SignalType = "FM" | "AM";

type SignalTypeSelectorProps = {
  signalType: SignalType;
  onSignalTypeChange: (type: SignalType) => void;
};

export default function SignalTypeSelector({
  signalType,
  onSignalTypeChange,
}: SignalTypeSelectorProps) {
  return (
    <div className="control-group">
      <label className="control-label">Signal Type</label>
      <div className="signal-type-selector">
        <button
          className={`signal-type-btn ${signalType === "FM" ? "active" : ""}`}
          onClick={() => onSignalTypeChange("FM")}
          title="FM Radio (88.1-107.9 MHz) - Frequency Modulation broadcasts with stereo sound. Common for music and talk stations."
          aria-label={`FM Radio mode${signalType === "FM" ? " (currently selected)" : ""}`}
          aria-pressed={signalType === "FM"}
        >
          FM
        </button>
        <button
          className={`signal-type-btn ${signalType === "AM" ? "active" : ""}`}
          onClick={() => onSignalTypeChange("AM")}
          title="AM Radio (530-1700 kHz) - Amplitude Modulation broadcasts with longer range. Common for news, talk, and sports."
          aria-label={`AM Radio mode${signalType === "AM" ? " (currently selected)" : ""}`}
          aria-pressed={signalType === "AM"}
        >
          AM
        </button>
      </div>
    </div>
  );
}
