import { useCallback, useState } from "react";

export interface VFOControlProps {
  frequencyHz: number;
  onChange: (nextHz: number) => void;
}

/**
 * VFOControl - Dial + digit entry shell for future integration.
 * Not yet wired to radio state; provides minimal accessible controls.
 */
function VFOControl({
  frequencyHz,
  onChange,
}: VFOControlProps): React.JSX.Element {
  const [step, setStep] = useState<number>(1000);

  const nudge = useCallback(
    (delta: number): void => {
      const next = Math.max(0, frequencyHz + delta);
      onChange(next);
    },
    [frequencyHz, onChange],
  );

  return (
    <div className="vfo-control" role="group" aria-label="VFO Control">
      <button
        className="tune-button"
        onClick={(): void => nudge(-step)}
        aria-label="Tune down"
      >
        –
      </button>
      <div
        className="vfo-readout rad-tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {(frequencyHz / 1e6).toFixed(3)} MHz
      </div>
      <button
        className="tune-button"
        onClick={(): void => nudge(step)}
        aria-label="Tune up"
      >
        +
      </button>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="visually-hidden">Step size</span>
        <select
          value={step}
          onChange={(e): void => setStep(parseInt(e.target.value, 10))}
          aria-label="Step size"
        >
          <option value={1}>1 Hz</option>
          <option value={10}>10 Hz</option>
          <option value={100}>100 Hz</option>
          <option value={1000}>1 kHz</option>
          <option value={10000}>10 kHz</option>
          <option value={100000}>100 kHz</option>
          <option value={1000000}>1 MHz</option>
        </select>
      </label>
    </div>
  );
}

export default VFOControl;
