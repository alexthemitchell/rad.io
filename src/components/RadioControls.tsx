import { type ChangeEvent, type KeyboardEvent } from "react";
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
  const handleChangeFrequency = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>): void => {
    const numValue = Number(value);
    const frequencyHz = signalType === "FM" ? numValue * 1e6 : numValue * 1e3;
    setFrequency(frequencyHz).catch((error) => {
      console.error("RadioControls: Failed to set frequency", error, {
        requestedFrequency: frequencyHz,
        signalType,
        inputValue: value,
      });
    });
  };

  // Keyboard navigation for frequency tuning
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const step = signalType === "FM" ? 0.1 : 10;
    const currentValue =
      signalType === "FM" ? frequency / 1e6 : frequency / 1e3;

    let newValue = currentValue;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      newValue = currentValue + step;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      newValue = currentValue - step;
    } else if (e.key === "PageUp") {
      e.preventDefault();
      newValue = currentValue + step * 10;
    } else if (e.key === "PageDown") {
      e.preventDefault();
      newValue = currentValue - step * 10;
    } else {
      return; // Let other keys work normally
    }

    // Apply min/max bounds
    const min = signalType === "FM" ? 88.1 : 530;
    const max = signalType === "FM" ? 107.9 : 1700;
    newValue = Math.max(min, Math.min(max, newValue));

    const frequencyHz = signalType === "FM" ? newValue * 1e6 : newValue * 1e3;
    setFrequency(frequencyHz).catch((error) => {
      console.error(
        "RadioControls: Failed to set frequency via keyboard",
        error,
        {
          requestedFrequency: frequencyHz,
          signalType,
          key: e.key,
          bounds: { min, max },
        },
      );
    });
  };

  const displayValue = signalType === "FM" ? frequency / 1e6 : frequency / 1e3;
  const min = signalType === "FM" ? 88.1 : 530;
  const max = signalType === "FM" ? 107.9 : 1700;
  const step = signalType === "FM" ? 0.1 : 10;
  const unit = signalType === "FM" ? "MHz" : "kHz";

  const tooltip =
    signalType === "FM"
      ? "Enter FM broadcast frequency (88.1-107.9 MHz). Use arrow keys for fine tuning (±0.1 MHz), Page Up/Down for coarse tuning (±1.0 MHz), or type to adjust. Popular stations: 88.5 (NPR), 95.5 (Classic Rock), 100.3 (Pop)"
      : "Enter AM broadcast frequency (530-1700 kHz). Use arrow keys for fine tuning (±10 kHz), Page Up/Down for coarse tuning (±100 kHz), or type to adjust. Popular stations: 660 (News), 1010 (Sports), 1450 (Public Radio)";

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
        onChange={handleChangeFrequency}
        onKeyDown={handleKeyDown}
        title={tooltip}
        aria-label={`Center frequency in ${unit}. Range: ${min} to ${max} ${unit}. Current: ${displayValue.toFixed(signalType === "FM" ? 1 : 0)} ${unit}. Use arrow keys for fine tuning, Page Up/Down for coarse tuning.`}
        aria-describedby="frequency-hint"
      />
      <span id="frequency-hint" className="visually-hidden">
        Use arrow keys for {step} {unit} increments, Page Up/Down for{" "}
        {step * 10} {unit} increments
      </span>
    </div>
  );
}
