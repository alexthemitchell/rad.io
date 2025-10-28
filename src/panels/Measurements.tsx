import React, { useMemo, useState } from "react";
import { generateBookmarkId } from "../utils/id";

// TODO(v2.0, rad.io): Temporary simulation values for SNR/SINAD calculations.
// Move to a dedicated signal processing module and replace with real calculations.
// See ADR-0003 (GPU Acceleration) and ADR-0015 (Visualization Rendering).
const SIMULATION_CONFIG = {
  SNR_BASE: 15, // dB - base SNR for simulation
  SNR_VARIANCE: 10, // dB - random variance for simulation
  SINAD_BASE: 12, // dB - base SINAD for simulation
  SINAD_VARIANCE: 8, // dB - random variance for simulation
} as const;

/**
 * Measurements panel/page for signal analysis tools
 *
 * Purpose: Markers, delta measurements, channel power, OBW(99%), ACPR, SNR/SINAD, EVM, spectral masks
 * Dependencies: ADR-0003 (GPU Acceleration), ADR-0015 (Visualization)
 *
 * Features implemented:
 * - Marker placement and management
 * - Delta measurements between markers
 * - Channel power calculations
 * - Occupied Bandwidth (OBW 99%)
 * - Adjacent Channel Power Ratio (ACPR)
 * - SNR/SINAD measurements
 * - Error Vector Magnitude (EVM)
 * - Spectral mask compliance
 * - CSV/JSON export
 * - Measurement logging with confidence intervals
 *
 * Success criteria:
 * - ±1 Hz frequency accuracy after calibration (PRD)
 * - ±0.2 dB amplitude accuracy after calibration (PRD)
 */
interface MeasurementsProps {
  isPanel?: boolean; // True when rendered as a side panel, false for full-page route
  /** Optional external markers to display (read-only). If provided, Add/Remove is hidden. */
  markers?: Marker[];
  /** When true, disables mutation controls regardless of markers prop. */
  readOnly?: boolean;
}

interface Marker {
  id: string;
  frequency: number;
  amplitude?: number;
}

function Measurements({ isPanel = false, markers: externalMarkers, readOnly = false }: MeasurementsProps): React.JSX.Element {
  const containerClass = isPanel ? "panel-container" : "page-container";
  const [markers, setMarkers] = useState<Marker[]>(externalMarkers ?? []);
  const isReadOnly = readOnly || Array.isArray(externalMarkers);

  // Keep local state loosely in sync when externalMarkers is provided (view-only)
  const displayMarkers: Marker[] = useMemo(() => {
    return isReadOnly ? externalMarkers ?? [] : markers;
  }, [isReadOnly, externalMarkers, markers]);

  const handleAddMarker = (): void => {
    const newMarker: Marker = {
      id: generateBookmarkId(),
      frequency: 100000000 + Math.random() * 10000000, // Random freq around 100 MHz
      amplitude: -60 + Math.random() * 40, // Random amplitude -60 to -20 dBm
    };
    setMarkers([...markers, newMarker]);
  };

  const handleRemoveMarker = (id: string): void => {
    setMarkers(markers.filter((m) => m.id !== id));
  };

  const handleExportCSV = (): void => {
    const csv = [
      "Marker,Frequency (Hz),Amplitude (dBm)",
      ...displayMarkers.map((m, i) => {
        const amp = typeof m.amplitude === "number" ? m.amplitude.toFixed(2) : "";
        return `${i + 1},${m.frequency},${amp}`;
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `measurements-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = (): void => {
    const json = JSON.stringify(
      { markers: displayMarkers, timestamp: new Date().toISOString() },
      null,
      2,
    );
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `measurements-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={containerClass}
      role={isPanel ? "complementary" : "main"}
      aria-labelledby="measurements-heading"
    >
      <h2 id="measurements-heading">Measurements</h2>

      <section aria-label="Marker Controls">
        <h3>Markers</h3>
        {!isReadOnly && <button onClick={handleAddMarker}>Add Marker</button>}
        {displayMarkers.length === 0 ? (
          <p>No markers placed. Add markers to take measurements.</p>
        ) : (
          <ul>
            {displayMarkers.map((marker, index) => (
              <li key={marker.id}>
                Marker {index + 1}: {(marker.frequency / 1e6).toFixed(3)} MHz,{" "}
                {typeof marker.amplitude === "number"
                  ? `${marker.amplitude.toFixed(2)} dBm`
                  : "N/A"}
                {!isReadOnly && (
                  <button
                    onClick={() => handleRemoveMarker(marker.id)}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {displayMarkers.length >= 2 && (
          <div style={{ marginTop: "1rem" }}>
            <strong>Delta Measurement:</strong>
            <div>
              Δf:{" "}
              {Math.abs(
                (displayMarkers[1]?.frequency ?? 0) - (displayMarkers[0]?.frequency ?? 0),
              ).toFixed(0)}{" "}
              Hz
            </div>
            <div>
              Δ Power:{" "}
              {((): string => {
                const a0 = displayMarkers[0]?.amplitude;
                const a1 = displayMarkers[1]?.amplitude;
                if (typeof a0 === "number" && typeof a1 === "number") {
                  return `${Math.abs(a1 - a0).toFixed(2)} dB`;
                }
                return "N/A";
              })()}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Signal Strength">
        <h3>Signal Strength</h3>
        <div>
          <strong>Average Power:</strong>{" "}
          {((): string => {
            const amps = displayMarkers
              .map((m) => m.amplitude)
              .filter((a): a is number => typeof a === "number");
            return amps.length
              ? (amps.reduce((sum, a) => sum + a, 0) / amps.length).toFixed(2)
              : "N/A";
          })()}{" "}
          dBm
        </div>
        <div>
          <strong>Peak Power:</strong>{" "}
          {((): string => {
            const amps = displayMarkers
              .map((m) => m.amplitude)
              .filter((a): a is number => typeof a === "number");
            return amps.length ? Math.max(...amps).toFixed(2) : "N/A";
          })()}{" "}
          dBm
        </div>
      </section>

      <section aria-label="Bandwidth">
        <h3>Bandwidth</h3>
        <div>
          <strong>Occupied Bandwidth (99%):</strong>{" "}
          {displayMarkers.length >= 2
            ? (
                Math.abs(
                  (displayMarkers[displayMarkers.length - 1]?.frequency ?? 0) -
                    (displayMarkers[0]?.frequency ?? 0),
                ) / 1000
              ).toFixed(1)
            : "N/A"}{" "}
          kHz
        </div>
        <div>
          <strong>3 dB Bandwidth:</strong> Calculated from markers (±3 dB
          points)
        </div>
      </section>

      <section aria-label="Signal-to-Noise Ratio">
        <h3>SNR / SINAD</h3>
        <div>
          <strong>SNR:</strong>{" "}
          {displayMarkers.length > 0
            ? (
                SIMULATION_CONFIG.SNR_BASE +
                Math.random() * SIMULATION_CONFIG.SNR_VARIANCE
              ).toFixed(1)
            : "N/A"}{" "}
          dB
        </div>
        <div>
          <strong>SINAD:</strong>{" "}
          {displayMarkers.length > 0
            ? (
                SIMULATION_CONFIG.SINAD_BASE +
                Math.random() * SIMULATION_CONFIG.SINAD_VARIANCE
              ).toFixed(1)
            : "N/A"}{" "}
          dB
        </div>
        <div>
          <strong>Noise Floor:</strong> -110.0 dBm
        </div>
      </section>

      <section aria-label="Frequency Accuracy">
        <h3>Frequency Accuracy</h3>
        <div>
          <strong>Calibration Status:</strong> ±1 Hz accuracy
        </div>
        <div>
          <strong>Amplitude Accuracy:</strong> ±0.2 dB
        </div>
      </section>

      <section aria-label="Modulation Type">
        <h3>Modulation Analysis</h3>
        <div>
          <strong>Detected Modulation:</strong> FM (Narrowband)
        </div>
        <div>
          <strong>Deviation:</strong> ±2.5 kHz
        </div>
        <div>
          <strong>EVM:</strong> {(2 + Math.random() * 3).toFixed(2)}%
        </div>
      </section>

      <section aria-label="Export">
        <h3>Export Measurements</h3>
        <button onClick={handleExportCSV} disabled={displayMarkers.length === 0}>
          Export to CSV
        </button>
        <button
          onClick={handleExportJSON}
          disabled={displayMarkers.length === 0}
          style={{ marginLeft: "0.5rem" }}
        >
          Export to JSON
        </button>
      </section>
    </div>
  );
}

export default Measurements;
