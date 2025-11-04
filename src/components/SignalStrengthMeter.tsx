import { useEffect, useState } from "react";
import { type Sample, calculateSignalStrength } from "../utils/dsp";

type SignalStrengthMeterProps = {
  samples?: Sample[];
};

/**
 * SignalStrengthMeter displays real-time signal strength indicator
 * Shows signal strength in dBm with visual bar and quality label
 */
export default function SignalStrengthMeter({
  samples = [],
}: SignalStrengthMeterProps): React.JSX.Element {
  const [signalStrength, setSignalStrength] = useState(-100);

  useEffect(() => {
    if (samples.length > 0) {
      const strength = calculateSignalStrength(samples);
      setSignalStrength((prev) => (prev === strength ? prev : strength));
    } else {
      setSignalStrength((prev) => (prev === -100 ? prev : -100));
    }
  }, [samples]);

  // Convert dBm (-100 to 0) to percentage (0 to 100)
  const percentage = Math.max(0, Math.min(100, signalStrength + 100));

  const getSignalQuality = (dBm: number): string => {
    if (dBm >= -30) {
      return "Excellent";
    }
    if (dBm >= -50) {
      return "Good";
    }
    if (dBm >= -70) {
      return "Fair";
    }
    if (dBm >= -90) {
      return "Weak";
    }
    return "Very Weak";
  };

  const getSignalClass = (dBm: number): string => {
    if (dBm >= -30) {
      return "excellent";
    }
    if (dBm >= -50) {
      return "good";
    }
    if (dBm >= -70) {
      return "fair";
    }
    return "weak";
  };

  const quality = getSignalQuality(signalStrength);
  const signalClass = getSignalClass(signalStrength);

  return (
    <div
      className="signal-strength-meter"
      role="region"
      aria-label="Signal strength indicator"
    >
      <div className="signal-strength-header">
        <span className="signal-strength-label">Signal Strength</span>
        <span className="signal-strength-value" aria-live="polite">
          {signalStrength.toFixed(1)} dBm
        </span>
      </div>
      <div className="signal-strength-container">
        <div
          className="signal-strength-bar-container"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Signal strength: ${quality}`}
        >
          <div
            className={`signal-strength-bar ${signalClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="signal-strength-text">{quality}</span>
      </div>
    </div>
  );
}
