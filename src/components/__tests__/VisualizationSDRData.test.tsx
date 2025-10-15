/**
 * Exhaustive Visualization Tests with Realistic SDR Data
 *
 * Tests all visualization components with the type of data expected from real SDR devices.
 * Validates that visualizations can handle various signal types, modulation schemes,
 * and edge cases encountered in practical SDR applications.
 *
 * Updated to use Web Audio API-based signal generation with significantly reduced
 * sample counts to prevent memory exhaustion and reduce O(n²) DFT computation time.
 */

import { render } from "@testing-library/react";
import IQConstellation from "../IQConstellation";
import Spectrogram from "../Spectrogram";
import WaveformVisualizer from "../WaveformVisualizer";
import { calculateWaveform } from "../../utils/dsp";
import type { Sample } from "../../utils/dsp";
import { clearMemoryPools } from "../../utils/testMemoryManager";
import {
  generateFMSignal,
  generateAMSignal,
  generateQPSKSignal,
  generateNoiseSignal,
  generatePulsedSignal,
} from "../../utils/audioTestSignals";

// Helper to create mock FFT data without expensive O(n²) DFT computation
function createMockFFTData(rows: number, bins: number): Float32Array[] {
  const data: Float32Array[] = [];
  for (let i = 0; i < rows; i++) {
    const row = new Float32Array(bins);
    for (let j = 0; j < bins; j++) {
      row[j] = -60 + Math.random() * 40; // Realistic noise floor
    }
    row[Math.floor(bins / 2)] = -10; // Peak at center
    data.push(row);
  }
  return data;
}

describe("Visualization Tests with Realistic SDR Data", () => {
  // Clean up memory after each test to prevent heap overflow
  afterEach(() => {
    clearMemoryPools();
  });

  // Also add a hook to force GC more frequently during tests
  beforeEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  describe("IQ Constellation with SDR Signals", () => {
    it("should render FM signal constellation", () => {
      const samples = generateFMSignal(500); // Minimal for testing
      const { container, unmount } = render(
        <IQConstellation samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // FM should show circular pattern
      const magnitudes = samples
        .slice(0, 50)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const avgMag = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      expect(avgMag).toBeGreaterThan(0.3); // Strong signal

      unmount();
    });

    it("should render AM signal constellation", () => {
      const samples = generateAMSignal(500); // Minimal for testing
      const { container, unmount } = render(
        <IQConstellation samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // AM should show varying magnitude
      const magnitudes = samples
        .slice(0, 50)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const maxMag = Math.max(...magnitudes);
      const minMag = Math.min(...magnitudes);
      expect(maxMag - minMag).toBeGreaterThan(0.2); // Amplitude variation

      unmount();
    });

    it("should render QPSK constellation with distinct points", () => {
      const samples = generateQPSKSignal(500); // Minimal for testing
      const { container, unmount } = render(
        <IQConstellation samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // QPSK should cluster around 4 constellation points
      const uniqueRegions = new Set();
      for (const sample of samples.slice(0, 50)) {
        const quadrant = `${sample.I > 0 ? "+" : "-"}${sample.Q > 0 ? "+" : "-"}`;
        uniqueRegions.add(quadrant);
      }
      expect(uniqueRegions.size).toBeGreaterThan(1); // Multiple quadrants

      unmount();
    });

    it("should render noise-only signal", () => {
      const samples = generateNoiseSignal(500); // Minimal for testing
      const { container } = render(<IQConstellation samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Noise should have low magnitude
      const magnitudes = samples
        .slice(0, 50)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const avgMag = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      expect(avgMag).toBeLessThan(0.1); // Weak signal
    });

    it("should handle large datasets efficiently", () => {
      // Use 2k samples to test larger datasets without memory exhaustion
      const samples = generateFMSignal(2000);
      const { container, unmount } = render(
        <IQConstellation samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(samples.length).toBe(2000);

      // Clean up immediately after test
      unmount();
    });

    it("should handle varying signal strengths", () => {
      // Generate samples with gain ramp
      const samples: Sample[] = [];
      for (let i = 0; i < 500; i++) {
        const gain = i / 500; // 0 to 1
        const phase = (2 * Math.PI * 100e3 * i) / 10e6;
        samples.push({
          I: gain * 0.5 * Math.cos(phase),
          Q: gain * 0.5 * Math.sin(phase),
        });
      }

      const { container } = render(<IQConstellation samples={samples} />);
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });
  });

  describe("Spectrogram with Mock FFT Data", () => {
    // Note: Using mock FFT data to avoid expensive O(n²) DFT computations.
    // DSP accuracy is tested in dsp.test.ts. These tests focus on rendering.

    it("should render spectrogram visualization", () => {
      const spectrogramData = createMockFFTData(5, 256);

      const { container, unmount } = render(
        <Spectrogram fftData={spectrogramData} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(spectrogramData.length).toBe(5);

      unmount();
    });

    it("should handle different FFT sizes", () => {
      const fftSizes = [128, 256, 512];

      for (const fftSize of fftSizes) {
        const spectrogramData = createMockFFTData(3, fftSize);

        const { container, unmount } = render(
          <Spectrogram fftData={spectrogramData} />,
        );

        const canvas = container.querySelector("canvas");
        expect(canvas).toBeInTheDocument();
        expect(spectrogramData[0]?.length).toBe(fftSize);

        unmount();
      }
    });
  });

  describe("Waveform with SDR Signals", () => {
    it("should show AM envelope modulation", () => {
      const samples = generateAMSignal(500); // Minimal for testing
      const { amplitude } = calculateWaveform(samples);

      const { container, unmount } = render(
        <WaveformVisualizer samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // AM envelope should vary
      const maxAmp = Math.max(...Array.from(amplitude));
      const minAmp = Math.min(...Array.from(amplitude));
      expect(maxAmp - minAmp).toBeGreaterThan(0.2);

      unmount();
    });

    it("should show FM constant envelope", () => {
      const samples = generateFMSignal(500); // Minimal for testing
      const { amplitude } = calculateWaveform(samples);

      const { container, unmount } = render(
        <WaveformVisualizer samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // FM should have relatively constant amplitude
      const maxAmp = Math.max(...Array.from(amplitude));
      const minAmp = Math.min(...Array.from(amplitude));
      const variation = maxAmp - minAmp;
      expect(variation).toBeLessThan(0.3); // Less variation than AM

      unmount();
    });

    it("should show pulsed signal timing", () => {
      const samples = generatePulsedSignal(1000); // Minimal for testing
      const { amplitude } = calculateWaveform(samples);

      const { container, unmount } = render(
        <WaveformVisualizer samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Should show on/off periods
      const maxAmp = Math.max(...Array.from(amplitude));
      const nearZero = amplitude.filter((a: number) => a < 0.1).length;
      const nearMax = amplitude.filter((a: number) => a > maxAmp * 0.5).length;

      expect(nearZero).toBeGreaterThan(10); // Off periods (adjusted threshold)
      expect(nearMax).toBeGreaterThan(10); // On periods (adjusted threshold)

      unmount();
    });

    it("should handle long duration signals", () => {
      const samples = generateFMSignal(1000); // Minimal for testing

      const { container, unmount } = render(
        <WaveformVisualizer samples={samples} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      unmount();
    });
  });

  describe("Cross-Visualization Consistency", () => {
    it("should show consistent signal power across visualizations", () => {
      const samples = generateFMSignal(500); // Minimal sample count

      // IQ Constellation - calculate average magnitude
      const iqMagnitudes = samples
        .slice(0, 100)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const iqAvgPower =
        iqMagnitudes.reduce((a: number, b: number) => a + b, 0) /
        iqMagnitudes.length;

      // Waveform - calculate RMS
      const { amplitude } = calculateWaveform(samples.slice(0, 100));
      const rms = Math.sqrt(
        amplitude.reduce((sum: number, a: number) => sum + a * a, 0) /
          amplitude.length,
      );

      // All should indicate strong signal
      expect(iqAvgPower).toBeGreaterThan(0.3);
      expect(rms).toBeGreaterThan(0.3);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle typical FM station at 100.3 MHz", () => {
      const samples = generateFMSignal(500, 0);

      const { container: iqContainer, unmount: unmountIQ } = render(
        <IQConstellation samples={samples} />,
      );
      expect(iqContainer.querySelector("canvas")).toBeInTheDocument();

      // Use mock FFT data instead of expensive computation
      const spectrogramData = createMockFFTData(3, 256);

      const { container: specContainer, unmount: unmountSpec } = render(
        <Spectrogram fftData={spectrogramData} />,
      );
      expect(specContainer.querySelector("canvas")).toBeInTheDocument();

      const { container: waveContainer, unmount: unmountWave } = render(
        <WaveformVisualizer samples={samples} />,
      );
      expect(waveContainer.querySelector("canvas")).toBeInTheDocument();

      // Cleanup
      unmountIQ();
      unmountSpec();
      unmountWave();
    });

    it("should handle weak signal with strong noise", () => {
      const weakSignal = generateFMSignal(500, 0).map((s) => ({
        I: s.I * 0.1,
        Q: s.Q * 0.1,
      }));
      const noise = generateNoiseSignal(500);

      const combined: Sample[] = weakSignal.map((s, i) => ({
        I: s.I + (noise[i]?.I ?? 0),
        Q: s.Q + (noise[i]?.Q ?? 0),
      }));

      const { container } = render(<IQConstellation samples={combined} />);
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });
  });
});
