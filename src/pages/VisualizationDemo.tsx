/**
 * Demo page showcasing visualizations with SimulatedSource.
 * This demonstrates the new visualization module architecture with decoupled components.
 */

import { useState, useEffect, useRef } from "react";
import {
  SimulatedSource,
  FFTChart,
  IQConstellation,
  WaveformVisualizer,
} from "../visualization";
import type { Sample } from "../utils/dsp";
import type { SimulatedSourceConfig } from "../visualization";
import type { ReactElement } from "react";

/**
 * Demo page showing all visualization components with SimulatedSource
 */
export default function VisualizationDemo(): ReactElement {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pattern, setPattern] = useState<
    "sine" | "qpsk" | "noise" | "fm" | "multi-tone"
  >("sine");
  const sourceRef = useRef<SimulatedSource | null>(null);

  // Initialize SimulatedSource
  useEffect(() => {
    const config: Partial<SimulatedSourceConfig> = {
      pattern,
      sampleRate: 2048000,
      samplesPerUpdate: 2048,
      updateInterval: 50,
      amplitude: 0.8,
    };
    sourceRef.current = new SimulatedSource(config);

    return (): void => {
      if (sourceRef.current?.isStreaming()) {
        void sourceRef.current.stopStreaming();
      }
    };
  }, [pattern]);

  // Handle start/stop streaming
  const toggleStreaming = async (): Promise<void> => {
    if (!sourceRef.current) {
      return;
    }

    if (isStreaming) {
      await sourceRef.current.stopStreaming();
      setIsStreaming(false);
    } else {
      await sourceRef.current.startStreaming((newSamples: Sample[]) => {
        setSamples(newSamples);
      });
      setIsStreaming(true);
    }
  };

  const metadata = sourceRef.current?.getMetadata();

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Visualization Module Demo</h1>
      <p>
        This page demonstrates the new visualization module with{" "}
        <code>SimulatedSource</code>.
      </p>

      <div style={{ marginBottom: "20px" }}>
        <h2>Controls</h2>
        <div style={{ marginBottom: "10px" }}>
          <label htmlFor="pattern-select" style={{ marginRight: "10px" }}>
            Signal Pattern:
          </label>
          <select
            id="pattern-select"
            value={pattern}
            onChange={(e): void =>
              setPattern(
                e.target.value as
                  | "sine"
                  | "qpsk"
                  | "noise"
                  | "fm"
                  | "multi-tone",
              )
            }
            disabled={isStreaming}
            style={{
              padding: "5px",
              fontSize: "16px",
              marginRight: "20px",
            }}
          >
            <option value="sine">Sine Wave</option>
            <option value="qpsk">QPSK</option>
            <option value="noise">Noise</option>
            <option value="fm">FM</option>
            <option value="multi-tone">Multi-tone</option>
          </select>

          <button
            onClick={(): void => {
              void toggleStreaming();
            }}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: isStreaming ? "#dc3545" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isStreaming ? "Stop" : "Start"} Streaming
          </button>
        </div>

        {metadata && (
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
            <p>
              Source: {metadata.name} | Sample Rate:{" "}
              {(metadata.sampleRate / 1e6).toFixed(2)} MHz | Center Frequency:{" "}
              {((metadata.centerFrequency ?? 0) / 1e6).toFixed(2)} MHz
            </p>
            <p>Samples: {samples.length}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: "30px" }}>
        <h2>Visualizations</h2>

        <div style={{ marginBottom: "40px" }}>
          <h3>IQ Constellation</h3>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Shows the in-phase (I) and quadrature (Q) components of the signal
          </p>
          <IQConstellation
            samples={samples}
            width={750}
            height={400}
            continueInBackground={true}
          />
        </div>

        <div style={{ marginBottom: "40px" }}>
          <h3>Waveform</h3>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Shows the amplitude envelope over time
          </p>
          <WaveformVisualizer
            samples={samples}
            width={750}
            height={300}
            continueInBackground={true}
          />
        </div>

        <div style={{ marginBottom: "40px" }}>
          <h3>Spectrogram</h3>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Shows the frequency content over time (power spectral density)
          </p>
          <FFTChart
            samples={samples}
            width={750}
            height={600}
            fftSize={1024}
            freqMin={0}
            freqMax={1024}
          />
        </div>
      </div>

      <div
        style={{ marginTop: "40px", padding: "20px", background: "#f8f9fa" }}
      >
        <h2>Architecture Notes</h2>
        <ul style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <li>
            <strong>DataSource Interface:</strong> <code>SimulatedSource</code>{" "}
            implements the <code>DataSource</code> interface, providing a clean
            contract for any data source (hardware, simulated, or recorded).
          </li>
          <li>
            <strong>Decoupled Components:</strong> Visualization components in{" "}
            <code>src/visualization/components/</code> are now decoupled from
            device I/O, accepting samples as props.
          </li>
          <li>
            <strong>Pattern Generation:</strong> <code>SimulatedSource</code>{" "}
            can generate various signal patterns (sine, QPSK, FM, noise,
            multi-tone) for testing different modulation schemes.
          </li>
          <li>
            <strong>Streaming Lifecycle:</strong> Proper start/stop streaming
            with configurable sample rates and update intervals.
          </li>
        </ul>
      </div>
    </div>
  );
}
