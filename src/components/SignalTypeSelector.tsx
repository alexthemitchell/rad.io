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
        >
          FM
        </button>
        <button
          className={`signal-type-btn ${signalType === "AM" ? "active" : ""}`}
          onClick={() => onSignalTypeChange("AM")}
        >
          AM
        </button>
      </div>
    </div>
  );
}
