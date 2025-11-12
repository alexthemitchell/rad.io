/**
 * MER (Modulation Error Ratio) Display
 *
 * Displays MER measurement for ATSC signals, which quantifies
 * the quality of the received constellation relative to ideal.
 * MER is similar to SNR but measured in the digital domain.
 */

import { type ReactElement, useMemo } from "react";

export interface Sample {
  I: number;
  Q: number;
}

export interface MERDisplayProps {
  /** Array of received IQ samples */
  samples: Sample[];
  /** Array of ideal reference symbols (8-VSB levels) */
  referenceSymbols?: number[];
  /** Whether to show detailed statistics */
  showDetails?: boolean;
}

// 8-VSB symbol levels (normalized)
const VSB_LEVELS = [-7, -5, -3, -1, 1, 3, 5, 7];

/**
 * Calculate MER from received symbols and ideal reference
 */
function calculateMER(
  samples: Sample[],
  referenceSymbols?: number[],
): {
  mer: number;
  merDb: number;
  errorPower: number;
  signalPower: number;
} {
  if (samples.length === 0) {
    return { mer: 0, merDb: -Infinity, errorPower: 0, signalPower: 0 };
  }

  let errorPower = 0;
  let signalPower = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample) {
      continue;
    }

    // Find closest ideal symbol (if no reference provided)
    let idealI: number;
    if (referenceSymbols && i < referenceSymbols.length) {
      idealI = referenceSymbols[i] ?? 0;
    } else {
      // Find nearest VSB level
      let minDist = Infinity;
      idealI = VSB_LEVELS[0] ?? 0;
      for (const level of VSB_LEVELS) {
        const dist = Math.abs(sample.I - level);
        if (dist < minDist) {
          minDist = dist;
          idealI = level;
        }
      }
    }
    const idealQ = 0; // VSB is primarily I-component

    // Error vector magnitude squared
    const errorI = sample.I - idealI;
    const errorQ = sample.Q - idealQ;
    errorPower += errorI * errorI + errorQ * errorQ;

    // Signal power (ideal constellation point)
    signalPower += idealI * idealI + idealQ * idealQ;
  }

  errorPower /= samples.length;
  signalPower /= samples.length;

  // MER = signal power / error power
  const mer = signalPower / (errorPower + 1e-10);
  const merDb = 10 * Math.log10(mer + 1e-10);

  return { mer, merDb, errorPower, signalPower };
}

/**
 * Get MER quality assessment
 */
function getMERQuality(merDb: number): {
  label: string;
  color: string;
  description: string;
} {
  if (merDb >= 30) {
    return {
      label: "Excellent",
      color: "#00ff00",
      description: "Signal quality is excellent",
    };
  } else if (merDb >= 25) {
    return {
      label: "Good",
      color: "#80ff00",
      description: "Signal quality is good",
    };
  } else if (merDb >= 20) {
    return {
      label: "Fair",
      color: "#ffff00",
      description: "Signal quality is acceptable",
    };
  } else if (merDb >= 15) {
    return {
      label: "Poor",
      color: "#ff8000",
      description: "Signal quality is degraded",
    };
  } else {
    return {
      label: "Very Poor",
      color: "#ff0000",
      description: "Signal quality is severely degraded",
    };
  }
}

/**
 * MER Display Component
 *
 * Shows Modulation Error Ratio measurement with quality indicator
 * and optional detailed statistics.
 */
export default function MERDisplay({
  samples,
  referenceSymbols,
  showDetails = false,
}: MERDisplayProps): ReactElement {
  const { mer, merDb, errorPower, signalPower } = useMemo(
    () => calculateMER(samples, referenceSymbols),
    [samples, referenceSymbols],
  );

  const quality = useMemo(() => getMERQuality(merDb), [merDb]);

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#1a1f2e",
        borderRadius: "8px",
        color: "#e0e0e0",
        fontFamily: "monospace",
      }}
      role="region"
      aria-label="MER measurement display"
    >
      <div style={{ marginBottom: "12px" }}>
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "14px",
            fontWeight: "bold",
            color: "#a0a0a0",
          }}
        >
          Modulation Error Ratio (MER)
        </h3>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          marginBottom: showDetails ? "16px" : "8px",
        }}
      >
        <div
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            color: quality.color,
            marginRight: "8px",
          }}
          aria-label={`MER value: ${merDb.toFixed(2)} decibels`}
        >
          {merDb.toFixed(2)}
        </div>
        <div style={{ fontSize: "18px", color: "#a0a0a0" }}>dB</div>
        <div
          style={{
            marginLeft: "16px",
            padding: "4px 12px",
            backgroundColor: quality.color + "20",
            border: `2px solid ${quality.color}`,
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            color: quality.color,
          }}
          aria-label={`Signal quality: ${quality.label}`}
        >
          {quality.label}
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#808080",
          marginBottom: showDetails ? "12px" : "0",
        }}
      >
        {quality.description}
      </div>

      {showDetails && (
        <div
          style={{
            borderTop: "1px solid #2a2f3e",
            paddingTop: "12px",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ color: "#808080" }}>MER (linear):</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {mer.toFixed(4)}
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>Samples:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {samples.length}
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>Error Power:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {errorPower.toFixed(6)}
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>Signal Power:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {signalPower.toFixed(6)}
              </div>
            </div>
          </div>

          <div
            style={{ marginTop: "12px", fontSize: "11px", color: "#606060" }}
          >
            MER measures constellation accuracy. Higher values indicate better
            signal quality. Typical ATSC reception requires MER ≥ 15 dB.
          </div>
        </div>
      )}
    </div>
  );
}
