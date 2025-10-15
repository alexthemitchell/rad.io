import { ChangeEvent } from "react";
import { SignalType } from "./SignalTypeSelector";

type RadioControlsProps = {
  frequency: number;
  signalType: SignalType;
  setFrequency: (frequencyHz: number) => Promise<void>;
};

export default function RadioControls({
  frequency,
  signalType,
  setFrequency,
}: RadioControlsProps) {
  const handleChangeFrequency = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    const numValue = Number(value);
    if (signalType === "FM") {
      setFrequency(numValue * 1e6).catch(console.error);
    } else {
      setFrequency(numValue * 1e3).catch(console.error);
    }
  };

  const displayValue =
    signalType === "FM" ? frequency / 1e6 : frequency / 1e3;
  const min = signalType === "FM" ? 88.1 : 530;
  const max = signalType === "FM" ? 107.9 : 1700;
  const step = signalType === "FM" ? 0.1 : 10;
  const unit = signalType === "FM" ? "MHz" : "kHz";

  return (
    <div className="control-group">
      <label className="control-label">
        Frequency ({unit})
      </label>
      <input
        type="number"
        name="frequency"
        className="control-input"
        min={min}
        max={max}
        step={step}
        value={displayValue.toFixed(signalType === "FM" ? 1 : 0)}
        onChange={handleChangeFrequency}
      />
    </div>
  );
}
