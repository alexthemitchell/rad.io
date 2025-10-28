/**
 * Demo page for Canvas2D and WebGL renderers
 * Shows Spectrum and Waterfall components with live data
 */

import { useState, useEffect, useRef } from "react";
import { calculateSpectrogram } from "../utils/dsp";
import {
  SimulatedSource,
  Spectrum,
  Waterfall,
  type DataSourceMetadata,
} from "../visualization";
import type { Sample } from "../utils/dsp";
import type { SimulatedSourceConfig } from "../visualization";
import type { ReactElement } from "react";

/**
 * Demo page showing new Canvas2D and WebGL renderers
 */
export default function RenderersDemo(): ReactElement {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pattern, setPattern] = useState<
    "sine" | "qpsk" | "noise" | "fm" | "multi-tone"
  >("sine");
  const [waterfallFrames, setWaterfallFrames] = useState<Float32Array[]>([]);
  const sourceRef = useRef<SimulatedSource | null>(null);

  const FFT_SIZE = 1024;
  const MAX_WATERFALL_FRAMES = 100;

  const [metadata, setMetadata] = useState<DataSourceMetadata | null>(null);

  // Initialize SimulatedSource
  useEffect(() => {
    const config: Partial<SimulatedSourceConfig> = {
      pattern,
      sampleRate: 2048000,
      samplesPerUpdate: 4096,
      updateInterval: 100,
      amplitude: 0.8,
    };
    sourceRef.current = new SimulatedSource(config);
    sourceRef.current.getMetadata().then(setMetadata).catch(console.error);

    return (): void => {
      if (sourceRef.current?.isStreaming()) {
        void sourceRef.current.stopStreaming();
      }
    };
  }, [pattern]);

  // Process samples into FFT data for visualizations
  useEffect(() => {
    if (samples.length < FFT_SIZE) {
      return;
    }

    // Calculate FFT for spectrum display
    const windowed = samples.slice(-FFT_SIZE * 20);
    if (windowed.length >= FFT_SIZE) {
      const spectrogramData = calculateSpectrogram(windowed, FFT_SIZE);

      // Update waterfall with new frame (most recent)
      if (spectrogramData.length > 0) {
        const latestFrame = spectrogramData[spectrogramData.length - 1];
        if (latestFrame) {
          setWaterfallFrames((prev) => {
            const newFrames = [...prev, latestFrame];
            return newFrames.slice(-MAX_WATERFALL_FRAMES);
          });
        }
      }
    }
  }, [samples]);

  // Handle start/stop streaming
  const toggleStreaming = async (): Promise<void> => {
    if (!sourceRef.current) {
      return;
    }

    if (isStreaming) {
      await sourceRef.current.stopStreaming();
      setIsStreaming(false);
      setWaterfallFrames([]);
    } else {
      setWaterfallFrames([]);
      await sourceRef.current.startStreaming((newSamples: Sample[]) => {
        setSamples(newSamples);
      });
      setIsStreaming(true);
    }
  };

  // Get current spectrum data (latest FFT frame)
  const currentSpectrum =
    waterfallFrames.length > 0
      ? waterfallFrames[waterfallFrames.length - 1]
      : new Float32Array(FFT_SIZE);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Canvas2D and WebGL Renderers Demo</h1>
      <p>
        This page demonstrates the new modular renderer architecture with
        automatic WebGL/Canvas2D fallback.
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
            <option value="multi-tone">Multi-Tone</option>
          </select>

          <button
            onClick={(): void => {
              void toggleStreaming();
            }}
            style={{
              padding: "5px 15px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            {isStreaming ? "Stop" : "Start"}
          </button>
        </div>

        {metadata && (
          <div style={{ fontSize: "14px", color: "#666" }}>
            <p>
              Sample Rate: {(metadata.sampleRate / 1e6).toFixed(2)} MHz |
              Pattern: {metadata["pattern"] as string} | Streaming:{" "}
              {isStreaming ? "Yes" : "No"}
            </p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h2>Spectrum (Frequency Line Chart)</h2>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
          Shows current frequency domain as a line chart. WebGL renderer uses
          LINE_STRIP primitive for GPU-accelerated rendering. Automatically
          falls back to Canvas2D if WebGL is unavailable.
        </p>
        <Spectrum
          magnitudes={currentSpectrum ?? new Float32Array(FFT_SIZE)}
          freqMin={0}
          freqMax={FFT_SIZE}
          width={750}
          height={400}
        />
        <p style={{ fontSize: "12px", color: "#999", marginTop: "5px" }}>
          Bins: {FFT_SIZE} | Frames Collected: {waterfallFrames.length}
        </p>
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h2>Waterfall (Time-Frequency Heatmap)</h2>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
          Shows time evolution of frequency content with Viridis colormap. WebGL
          renderer uses texture-based rendering for efficient GPU acceleration.
          Automatically falls back to Canvas2D if WebGL is unavailable.
        </p>
        <Waterfall
          frames={waterfallFrames}
          freqMin={0}
          freqMax={FFT_SIZE}
          width={750}
          height={600}
        />
        <p style={{ fontSize: "12px", color: "#999", marginTop: "5px" }}>
          Frames: {waterfallFrames.length} / {MAX_WATERFALL_FRAMES} max | Bins
          per frame: {FFT_SIZE}
        </p>
      </div>

      <div
        style={{
          marginTop: "40px",
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
        }}
      >
        <h2>Architecture Notes</h2>
        <ul style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <li>
            <strong>Modular Design:</strong> Separate renderer classes
            (CanvasSpectrum, WebGLSpectrum, CanvasWaterfall, WebGLWaterfall)
            implement a common interface
          </li>
          <li>
            <strong>Automatic Fallback:</strong> Components try WebGL first,
            automatically fall back to Canvas2D if unavailable
          </li>
          <li>
            <strong>GPU Acceleration:</strong> WebGL renderers use GLSL shaders
            for efficient GPU-accelerated rendering
          </li>
          <li>
            <strong>Viridis Colormap:</strong> Perceptually uniform colormap for
            waterfall displays
          </li>
          <li>
            <strong>Performance:</strong> WebGL provides 60+ FPS even with large
            datasets; Canvas2D provides reliable fallback
          </li>
        </ul>
      </div>
    </div>
  );
}
