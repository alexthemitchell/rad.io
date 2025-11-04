import { useFrequencyInput } from "../hooks/useFrequencyInput";
import { type SignalType } from "./SignalTypeSelector";

type RadioControlsProps = {
  frequency: number;
  signalType: SignalType;
  setFrequency: (frequencyHz: number) => Promise<void>;
};

export default function RadioControls({
  frequency,
  signalType,
  setFrequency,
}: RadioControlsProps): React.JSX.Element {
  const {
    displayValue,
    min,
    max,
    step,
    unit,
    tooltip,
    ariaLabel,
    hint,
    handleChange,
    handleKeyDown,
  } = useFrequencyInput({
    frequency,
    signalType,
    setFrequency,
  });

  return (
    <div className="control-group">
      <label className="control-label" htmlFor="frequency-input">
        Frequency ({unit})
      </label>
      <input
        id="frequency-input"
        type="number"
        name="frequency"
        className="control-input"
        min={min}
        max={max}
        step={step}
        value={displayValue.toFixed(signalType === "FM" ? 1 : 0)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        title={tooltip}
        aria-label={ariaLabel}
        aria-describedby="frequency-hint"
      />
      <span id="frequency-hint" className="visually-hidden">
        {hint}
      </span>
    </div>
  );
}
