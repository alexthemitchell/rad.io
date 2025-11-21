import { useEffect, useState, useRef } from "react";
import type { SignalLevel } from "../lib/measurement/types";

interface SMeterProps {
  /** Current signal level measurement */
  signalLevel: SignalLevel | null;

  /** Display style for the meter */
  style?: "bar" | "segments";

  /** Whether to show dBm value */
  showDbm?: boolean;

  /** Whether to show dBFS value (engineering mode) */
  showDbfs?: boolean;

  /** Smoothing factor (0-1). Lower = more smoothing. */
  smoothing?: number;
}

/**
 * SMeter - Professional S-Meter Component
 *
 * Displays signal strength using standard S-units (S0-S9+XX)
 * with visual bar/segment meter and numeric readouts.
 *
 * Features:
 * - Standard S-meter scale (S0-S9, S9+10, S9+20, etc.)
 * - Color zones: green (normal), yellow/orange (strong), red (very strong)
 * - Accessibility: ARIA live region with rate-limited announcements
 * - Smooth updates with exponential moving average
 * - Supports both HF and VHF/UHF bands
 *
 * @example
 * ```tsx
 * import { SMeter } from '@/components';
 * import { useStore } from '@/store';
 *
 * function MyComponent() {
 *   const signalLevel = useStore(state => state.signalLevel);
 *   return <SMeter signalLevel={signalLevel} showDbm />;
 * }
 * ```
 */
export default function SMeter({
  signalLevel,
  style = "bar",
  showDbm = true,
  showDbfs = false,
  smoothing = 0.3,
}: SMeterProps): React.JSX.Element {
  // Smoothed values for visual stability
  const [smoothedSUnit, setSmoothedSUnit] = useState(0);
  const [smoothedOverS9, setSmoothedOverS9] = useState(0);

  // ARIA live region state (rate-limited announcements)
  const [ariaAnnouncement, setAriaAnnouncement] = useState("");
  const lastAnnouncementTime = useRef(0);
  const ANNOUNCEMENT_THROTTLE_MS = 2000; // Max 1 announcement per 2 seconds

  useEffect(() => {
    if (!signalLevel) {
      // No signal - gradually decay to S0
      setSmoothedSUnit((prev) => prev * (1 - smoothing));
      setSmoothedOverS9((prev) => prev * (1 - smoothing));
      return;
    }

    // Apply exponential moving average for smooth visual updates
    const targetSUnit = signalLevel.sUnit + signalLevel.overS9 / 6; // Fractional S-units
    setSmoothedSUnit(
      (prev) => smoothing * targetSUnit + (1 - smoothing) * prev,
    );
    setSmoothedOverS9(
      (prev) => smoothing * signalLevel.overS9 + (1 - smoothing) * prev,
    );

    // Rate-limited ARIA announcements
    const now = Date.now();
    if (now - lastAnnouncementTime.current > ANNOUNCEMENT_THROTTLE_MS) {
      const sUnitInt = Math.round(signalLevel.sUnit);
      const overS9Int = Math.round(signalLevel.overS9);

      let announcement = "";
      if (sUnitInt < 9) {
        announcement = `Signal strength S${sUnitInt}`;
      } else {
        announcement = `Signal strength S9 plus ${overS9Int} dB`;
      }

      if (showDbm) {
        announcement += `, ${signalLevel.dBmApprox.toFixed(0)} dBm`;
      }

      setAriaAnnouncement(announcement);
      lastAnnouncementTime.current = now;
    }
  }, [signalLevel, smoothing, showDbm]);

  // Calculate visual representation
  const sUnitInt = signalLevel
    ? Math.round(signalLevel.sUnit)
    : Math.round(smoothedSUnit);
  const overS9Int = signalLevel
    ? Math.round(signalLevel.overS9)
    : Math.round(smoothedOverS9);

  // Calculate percentage for bar width (0-100%)
  // S0 = 0%, S9 = 90%, S9+60 = 100%
  const totalSUnits =
    smoothedSUnit + (smoothedOverS9 > 0 ? smoothedOverS9 / 6 : 0);
  const percentage = Math.min(100, (totalSUnits / 10) * 100); // 10 S-units for full scale (S9+60dB ≈ S10)

  // Determine color based on signal strength
  const getColorClass = (): string => {
    const overS9 = smoothedOverS9;
    const sUnit = smoothedSUnit;

    if (overS9 >= 40) {
      return "s-meter-bar-very-strong"; // Red
    }
    if (overS9 >= 20) {
      return "s-meter-bar-strong"; // Orange
    }
    if (overS9 > 0) {
      return "s-meter-bar-moderate"; // Yellow
    }
    if (sUnit >= 7) {
      return "s-meter-bar-good"; // Green
    }
    if (sUnit >= 4) {
      return "s-meter-bar-fair"; // Light green
    }
    return "s-meter-bar-weak"; // Gray/dim
  };

  // Format S-meter reading
  const formatSMeter = (): string => {
    if (sUnitInt < 9) {
      return `S${sUnitInt}`;
    }
    if (overS9Int === 0) {
      return "S9";
    }
    return `S9+${overS9Int}`;
  };

  // Render segment-style meter (alternative to bar)
  const renderSegments = (): React.JSX.Element => {
    const segments: React.JSX.Element[] = [];
    const numSegments = 15; // S0-S9 (9 segments) + 6 over-S9 segments (10, 20, 30, 40, 50, 60)

    for (let i = 0; i < numSegments; i++) {
      const isActive = i < Math.round((totalSUnits / 10) * numSegments);
      let segmentClass = "s-meter-segment";

      if (isActive) {
        // Color segments based on position
        if (i >= 13) {
          segmentClass += " s-meter-segment-very-strong"; // S9+40 and above
        } else if (i >= 11) {
          segmentClass += " s-meter-segment-strong"; // S9+20 to S9+30
        } else if (i >= 9) {
          segmentClass += " s-meter-segment-moderate"; // S9 to S9+10
        } else if (i >= 6) {
          segmentClass += " s-meter-segment-good"; // S7-S8
        } else if (i >= 3) {
          segmentClass += " s-meter-segment-fair"; // S4-S6
        } else {
          segmentClass += " s-meter-segment-weak"; // S0-S3
        }
      } else {
        segmentClass += " s-meter-segment-inactive";
      }

      segments.push(
        <div
          key={i}
          className={segmentClass}
          aria-hidden="true"
          data-segment={i}
        />,
      );
    }

    return <div className="s-meter-segments">{segments}</div>;
  };

  // Render bar-style meter
  const renderBar = (): React.JSX.Element => {
    return (
      <div className="s-meter-bar-container">
        <div
          className={`s-meter-bar ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
          role="meter"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Signal strength: ${formatSMeter()}`}
        />
      </div>
    );
  };

  return (
    <div className="s-meter" role="region" aria-label="S-Meter signal strength">
      {/* Header with S-unit display */}
      <div className="s-meter-header">
        <span className="s-meter-label">Signal</span>
        <div className="s-meter-values">
          <span className="s-meter-value-primary" aria-live="polite">
            {formatSMeter()}
          </span>
          {showDbm && signalLevel && (
            <span className="s-meter-value-secondary">
              {signalLevel.dBmApprox.toFixed(0)} dBm
            </span>
          )}
          {showDbfs && signalLevel && (
            <span className="s-meter-value-secondary">
              {signalLevel.dBfs.toFixed(1)} dBFS
            </span>
          )}
        </div>
      </div>

      {/* Visual meter */}
      <div className="s-meter-display">
        {style === "segments" ? renderSegments() : renderBar()}
      </div>

      {/* Scale markers */}
      <div className="s-meter-scale" aria-hidden="true">
        <span>S1</span>
        <span>S3</span>
        <span>S5</span>
        <span>S7</span>
        <span>S9</span>
        <span>+20</span>
        <span>+40</span>
        <span>+60</span>
      </div>

      {/* Band indicator and calibration status */}
      {signalLevel && (
        <div className="s-meter-footer">
          <span className="s-meter-band">{signalLevel.band}</span>
          {signalLevel.calibrationStatus !== "uncalibrated" && (
            <span
              className="s-meter-calibration"
              title={`Calibration: ${signalLevel.calibrationStatus}, Uncertainty: ±${signalLevel.uncertaintyDb?.toFixed(1) ?? "?"}dB`}
            >
              {signalLevel.calibrationStatus === "user" ? "📏" : "🏭"}
            </span>
          )}
        </div>
      )}

      {/* ARIA live region for screen readers (rate-limited) */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {ariaAnnouncement}
      </div>
    </div>
  );
}
