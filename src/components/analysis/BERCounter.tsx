/**
 * BER (Bit Error Rate) Counter
 *
 * Displays bit error rate measurement for ATSC signals.
 * BER indicates the ratio of erroneous bits to total bits received.
 */

import { type ReactElement, useMemo } from "react";

export interface BERCounterProps {
  /** Total number of bits received */
  totalBits: number;
  /** Number of erroneous bits detected */
  errorBits: number;
  /** Measurement duration in seconds */
  duration?: number;
  /** Whether to show detailed statistics */
  showDetails?: boolean;
}

/**
 * Get BER quality assessment
 */
function getBERQuality(ber: number): {
  label: string;
  color: string;
  description: string;
} {
  if (ber <= 1e-6) {
    return {
      label: "Excellent",
      color: "#00ff00",
      description: "Virtually error-free reception",
    };
  } else if (ber <= 1e-5) {
    return {
      label: "Good",
      color: "#80ff00",
      description: "Very low error rate",
    };
  } else if (ber <= 1e-4) {
    return {
      label: "Fair",
      color: "#ffff00",
      description: "Acceptable error rate",
    };
  } else if (ber <= 1e-3) {
    return {
      label: "Poor",
      color: "#ff8000",
      description: "Elevated error rate",
    };
  } else {
    return {
      label: "Very Poor",
      color: "#ff0000",
      description: "Unacceptable error rate",
    };
  }
}

/**
 * Format BER in scientific notation
 */
function formatBER(ber: number): string {
  if (ber === 0) {
    return "0";
  }
  const exponent = Math.floor(Math.log10(ber));
  const mantissa = ber / Math.pow(10, exponent);
  return `${mantissa.toFixed(2)} × 10^${exponent}`;
}

/**
 * BER Counter Component
 *
 * Displays Bit Error Rate measurement with quality indicator
 * and statistics.
 */
export default function BERCounter({
  totalBits,
  errorBits,
  duration,
  showDetails = false,
}: BERCounterProps): ReactElement {
  const ber = useMemo(() => {
    if (totalBits === 0) {
      return 0;
    }
    return errorBits / totalBits;
  }, [totalBits, errorBits]);

  const quality = useMemo(() => getBERQuality(ber), [ber]);

  const bitRate = useMemo(() => {
    if (!duration || duration === 0) {
      return null;
    }
    return totalBits / duration;
  }, [totalBits, duration]);

  const errorRate = useMemo(() => {
    if (!duration || duration === 0) {
      return null;
    }
    return errorBits / duration;
  }, [errorBits, duration]);

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
      aria-label="BER measurement display"
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
          Bit Error Rate (BER)
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
            fontSize: "28px",
            fontWeight: "bold",
            color: quality.color,
            marginRight: "16px",
            fontFamily: "monospace",
          }}
          aria-label={`BER value: ${formatBER(ber)}`}
        >
          {formatBER(ber)}
        </div>
        <div
          style={{
            padding: "4px 12px",
            backgroundColor: quality.color + "20",
            border: `2px solid ${quality.color}`,
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            color: quality.color,
          }}
          aria-label={`Error rate quality: ${quality.label}`}
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
              <div style={{ color: "#808080" }}>Total Bits:</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {totalBits.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: "#808080" }}>Error Bits:</div>
              <div style={{ color: "#ff8080", fontWeight: "bold" }}>
                {errorBits.toLocaleString()}
              </div>
            </div>
            {duration !== undefined && (
              <>
                <div>
                  <div style={{ color: "#808080" }}>Duration:</div>
                  <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                    {duration.toFixed(2)} s
                  </div>
                </div>
                {bitRate !== null && (
                  <div>
                    <div style={{ color: "#808080" }}>Bit Rate:</div>
                    <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                      {(bitRate / 1e6).toFixed(2)} Mbps
                    </div>
                  </div>
                )}
              </>
            )}
            {errorRate !== null && (
              <div>
                <div style={{ color: "#808080" }}>Error Rate:</div>
                <div style={{ color: "#ff8080", fontWeight: "bold" }}>
                  {errorRate.toFixed(2)} err/s
                </div>
              </div>
            )}
            <div>
              <div style={{ color: "#808080" }}>BER (decimal):</div>
              <div style={{ color: "#e0e0e0", fontWeight: "bold" }}>
                {ber.toExponential(2)}
              </div>
            </div>
          </div>

          <div
            style={{ marginTop: "12px", fontSize: "11px", color: "#606060" }}
          >
            BER measures transmission quality. Lower values indicate fewer
            errors. ATSC typically requires BER &lt; 10⁻⁴ before error
            correction.
          </div>
        </div>
      )}
    </div>
  );
}
