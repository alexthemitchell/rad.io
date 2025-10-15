export type SignalType = "FM" | "AM" | "P25";

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
        <button
          className={`signal-type-btn ${signalType === "P25" ? "active" : ""}`}
          onClick={() => onSignalTypeChange("P25")}
          title="P25 Phase 2 Trunked Radio (700-800 MHz, 150-174 MHz) - TDMA digital trunked radio system for public safety communications. Monitor talkgroups and control channels."
          aria-label={`P25 Trunked Radio mode${signalType === "P25" ? " (currently selected)" : ""}`}
          aria-pressed={signalType === "P25"}
        >
          P25
        </button>
      </div>
    </div>
  );
}
