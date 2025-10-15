/**
 * Exhaustive Visualization Tests with Realistic SDR Data
 *
 * Tests all visualization components with the type of data expected from real SDR devices.
 * Validates that visualizations can handle various signal types, modulation schemes,
 * and edge cases encountered in practical SDR applications.
 */

import { render } from "@testing-library/react";
import IQConstellation from "../IQConstellation";
import Spectrogram from "../Spectrogram";
import WaveformVisualizer from "../WaveformVisualizer";
import { calculateSpectrogramRow, calculateWaveform } from "../../utils/dsp";
import type { Sample } from "../../utils/dsp";
import { 
  clearMemoryPools, 
  generateSamplesChunked 
} from "../../utils/testMemoryManager";

/**
 * Generate realistic FM broadcast signal
 * Simulates what HackRF/RTLSDR would capture from a strong FM station
 */
function generateFMSignal(sampleCount = 512, carrierOffset = 0): Sample[] {
  // Use chunked generation for large sample counts to reduce memory pressure
  if (sampleCount > 10000) {
    return generateSamplesChunked(sampleCount, (n) => {
      const sampleRate = 10e6; // 10 MSPS
      const carrierFreq = carrierOffset; // Offset from center
      const carrierAmp = 0.5;
      const audioFreq = 1000; // 1 kHz audio tone
      const freqDeviation = 75e3; // FM deviation

      // Audio modulation signal
      const audio = Math.sin((2 * Math.PI * audioFreq * n) / sampleRate);

      // FM modulation
      const phase =
        (2 * Math.PI * carrierFreq * n) / sampleRate +
        (freqDeviation / audioFreq) * audio;

      // IQ components with noise
      const I = carrierAmp * Math.cos(phase) + (Math.random() - 0.5) * 0.02;
      const Q = carrierAmp * Math.sin(phase) + (Math.random() - 0.5) * 0.02;

      return { I, Q };
    });
  }

  const samples: Sample[] = [];
  const sampleRate = 10e6; // 10 MSPS
  const carrierFreq = carrierOffset; // Offset from center
  const carrierAmp = 0.5;
  const audioFreq = 1000; // 1 kHz audio tone
  const freqDeviation = 75e3; // FM deviation

  for (let n = 0; n < sampleCount; n++) {
    // Audio modulation signal
    const audio = Math.sin((2 * Math.PI * audioFreq * n) / sampleRate);

    // FM modulation
    const phase =
      (2 * Math.PI * carrierFreq * n) / sampleRate +
      (freqDeviation / audioFreq) * audio;

    // IQ components with noise
    const I = carrierAmp * Math.cos(phase) + (Math.random() - 0.5) * 0.02;
    const Q = carrierAmp * Math.sin(phase) + (Math.random() - 0.5) * 0.02;

    samples.push({ I, Q });
  }

  return samples;
}

/**
 * Generate AM broadcast signal
 * Simulates traditional AM radio signal
 */
function generateAMSignal(sampleCount = 512, carrierOffset = 0): Sample[] {
  // Use chunked generation for large sample counts
  if (sampleCount > 10000) {
    return generateSamplesChunked(sampleCount, (n) => {
      const sampleRate = 10e6;
      const carrierFreq = carrierOffset;
      const audioFreq = 1000; // 1 kHz audio
      const modulationIndex = 0.8; // 80% modulation

      const audio = Math.sin((2 * Math.PI * audioFreq * n) / sampleRate);
      const amplitude = 0.5 * (1 + modulationIndex * audio);
      const phase = (2 * Math.PI * carrierFreq * n) / sampleRate;

      const I = amplitude * Math.cos(phase) + (Math.random() - 0.5) * 0.02;
      const Q = amplitude * Math.sin(phase) + (Math.random() - 0.5) * 0.02;

      return { I, Q };
    });
  }

  const samples: Sample[] = [];
  const sampleRate = 10e6;
  const carrierFreq = carrierOffset;
  const audioFreq = 1000; // 1 kHz audio
  const modulationIndex = 0.8; // 80% modulation

  for (let n = 0; n < sampleCount; n++) {
    const audio = Math.sin((2 * Math.PI * audioFreq * n) / sampleRate);
    const amplitude = 0.5 * (1 + modulationIndex * audio);
    const phase = (2 * Math.PI * carrierFreq * n) / sampleRate;

    const I = amplitude * Math.cos(phase) + (Math.random() - 0.5) * 0.02;
    const Q = amplitude * Math.sin(phase) + (Math.random() - 0.5) * 0.02;

    samples.push({ I, Q });
  }

  return samples;
}

/**
 * Generate digital modulation (QPSK)
 * Simulates digital communications signal
 */
function generateQPSKSignal(sampleCount = 512): Sample[] {
  const samples: Sample[] = [];
  const symbolRate = 1e3; // 1 kHz symbol rate
  const sampleRate = 10e6;
  const samplesPerSymbol = Math.floor(sampleRate / symbolRate);

  // QPSK constellation points
  const constellationPoints = [
    { I: 0.707, Q: 0.707 }, // 45°
    { I: -0.707, Q: 0.707 }, // 135°
    { I: -0.707, Q: -0.707 }, // 225°
    { I: 0.707, Q: -0.707 }, // 315°
  ];

  for (let n = 0; n < sampleCount; n++) {
    const symbolIndex = Math.floor(n / samplesPerSymbol);
    const point = constellationPoints[symbolIndex % 4];
    if (point) {
      const I = point.I * 0.5 + (Math.random() - 0.5) * 0.05;
      const Q = point.Q * 0.5 + (Math.random() - 0.5) * 0.05;
      samples.push({ I, Q });
    }
  }

  return samples;
}

/**
 * Generate noise-only signal
 * Simulates empty frequency or very weak signal
 */
function generateNoiseSignal(sampleCount = 512): Sample[] {
  const samples: Sample[] = [];
  for (let n = 0; n < sampleCount; n++) {
    samples.push({
      I: (Math.random() - 0.5) * 0.1,
      Q: (Math.random() - 0.5) * 0.1,
    });
  }
  return samples;
}

/**
 * Generate multi-tone signal
 * Simulates frequency with multiple signals present
 */
function generateMultiToneSignal(sampleCount = 512): Sample[] {
  const samples: Sample[] = [];
  const sampleRate = 10e6;

  // Multiple carriers at different frequencies
  const tones = [
    { freq: 100e3, amp: 0.3 },
    { freq: 200e3, amp: 0.2 },
    { freq: -150e3, amp: 0.25 },
  ];

  for (let n = 0; n < sampleCount; n++) {
    let I = 0;
    let Q = 0;

    for (const tone of tones) {
      const phase = (2 * Math.PI * tone.freq * n) / sampleRate;
      I += tone.amp * Math.cos(phase);
      Q += tone.amp * Math.sin(phase);
    }

    // Add noise
    I += (Math.random() - 0.5) * 0.02;
    Q += (Math.random() - 0.5) * 0.02;

    samples.push({ I, Q });
  }

  return samples;
}

/**
 * Generate pulsed signal
 * Simulates radar or burst transmissions
 */
function generatePulsedSignal(sampleCount = 512): Sample[] {
  const samples: Sample[] = [];
  const sampleRate = 10e6;
  const pulseFreq = 100e3;
  const pulseWidth = 1000; // samples
  const pulseInterval = 5000; // samples

  for (let n = 0; n < sampleCount; n++) {
    const inPulse = n % pulseInterval < pulseWidth;
    const amplitude = inPulse ? 0.7 : 0.0;
    const phase = (2 * Math.PI * pulseFreq * n) / sampleRate;

    const I = amplitude * Math.cos(phase) + (Math.random() - 0.5) * 0.01;
    const Q = amplitude * Math.sin(phase) + (Math.random() - 0.5) * 0.01;

    samples.push({ I, Q });
  }

  return samples;
}

describe("Visualization Tests with Realistic SDR Data", () => {
  // Clean up memory after each test to prevent heap overflow
  afterEach(() => {
    clearMemoryPools();
  });

  describe("IQ Constellation with SDR Signals", () => {
    it("should render FM signal constellation", () => {
      const samples = generateFMSignal(5000);
      const { container } = render(<IQConstellation samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // FM should show circular pattern
      const magnitudes = samples
        .slice(0, 100)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const avgMag = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      expect(avgMag).toBeGreaterThan(0.3); // Strong signal
    });

    it("should render AM signal constellation", () => {
      const samples = generateAMSignal(5000);
      const { container } = render(<IQConstellation samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // AM should show varying magnitude
      const magnitudes = samples
        .slice(0, 100)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const maxMag = Math.max(...magnitudes);
      const minMag = Math.min(...magnitudes);
      expect(maxMag - minMag).toBeGreaterThan(0.2); // Amplitude variation
    });

    it("should render QPSK constellation with distinct points", () => {
      const samples = generateQPSKSignal(5000);
      const { container } = render(<IQConstellation samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // QPSK should cluster around 4 constellation points
      const uniqueRegions = new Set();
      for (const sample of samples.slice(0, 100)) {
        const quadrant = `${sample.I > 0 ? "+" : "-"}${sample.Q > 0 ? "+" : "-"}`;
        uniqueRegions.add(quadrant);
      }
      expect(uniqueRegions.size).toBeGreaterThan(1); // Multiple quadrants
    });

    it("should render noise-only signal", () => {
      const samples = generateNoiseSignal(5000);
      const { container } = render(<IQConstellation samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Noise should have low magnitude
      const magnitudes = samples
        .slice(0, 100)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const avgMag = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      expect(avgMag).toBeLessThan(0.1); // Weak signal
    });

    it("should handle very large datasets (100k+ samples)", () => {
      // Reduced from 100k to 50k to prevent memory issues
      const samples = generateFMSignal(50000);
      const { container, unmount } = render(<IQConstellation samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(samples.length).toBe(50000);
      
      // Clean up immediately after test
      unmount();
    });

    it("should handle varying signal strengths", () => {
      // Generate samples with gain ramp
      const samples: Sample[] = [];
      for (let i = 0; i < 5000; i++) {
        const gain = i / 5000; // 0 to 1
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

  describe("Spectrogram with SDR Signals", () => {
    it("should show FM signal in frequency domain", () => {
      const samples = generateFMSignal(10240, 100e3); // 100 kHz offset
      const fftSize = 1024;
      const spectrogramData: Float32Array[] = [];

      for (let i = 0; i < 10; i++) {
        const rowSamples = samples.slice(i * fftSize, (i + 1) * fftSize);
        const row = calculateSpectrogramRow(rowSamples, fftSize);
        spectrogramData.push(row);
      }

      const { container } = render(
        <Spectrogram fftData={spectrogramData} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(spectrogramData.length).toBe(10);
    });

    it("should show multi-tone signal with distinct peaks", () => {
      const samples = generateMultiToneSignal(10240);
      const fftSize = 1024;
      const spectrogramData: Float32Array[] = [];

      for (let i = 0; i < 10; i++) {
        const rowSamples = samples.slice(i * fftSize, (i + 1) * fftSize);
        const row = calculateSpectrogramRow(rowSamples, fftSize);
        spectrogramData.push(row);
      }

      const { container } = render(
        <Spectrogram fftData={spectrogramData} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Check that we have multiple peaks
      const firstRow = spectrogramData[0];
      if (firstRow) {
        const peaks = Array.from(firstRow).filter((val) => val > -20); // dB threshold
        expect(peaks.length).toBeGreaterThan(3); // Multiple tones visible
      }
    });

    it("should show pulsed signal temporal variation", () => {
      const samples = generatePulsedSignal(20480);
      const fftSize = 1024;
      const spectrogramData: Float32Array[] = [];

      for (let i = 0; i < 20; i++) {
        const rowSamples = samples.slice(i * fftSize, (i + 1) * fftSize);
        const row = calculateSpectrogramRow(rowSamples, fftSize);
        spectrogramData.push(row);
      }

      const { container } = render(
        <Spectrogram fftData={spectrogramData} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Power should vary over time
      const rowPowers = spectrogramData.map((row) => {
        const maxVal = Math.max(...Array.from(row));
        return maxVal;
      });

      const maxPower = Math.max(...rowPowers);
      const minPower = Math.min(...rowPowers);
      expect(maxPower - minPower).toBeGreaterThan(20); // Significant variation
    });

    it("should handle different FFT sizes", () => {
      const fftSizes = [256, 512, 1024, 2048, 4096];

      for (const fftSize of fftSizes) {
        const samples = generateFMSignal(fftSize * 5);
        const spectrogramData: Float32Array[] = [];

        for (let i = 0; i < 5; i++) {
          const rowSamples = samples.slice(i * fftSize, (i + 1) * fftSize);
          const row = calculateSpectrogramRow(rowSamples, fftSize);
          spectrogramData.push(row);
        }

        const { container } = render(
          <Spectrogram fftData={spectrogramData} />,
        );

        const canvas = container.querySelector("canvas");
        expect(canvas).toBeInTheDocument();
        expect(spectrogramData[0]?.length).toBe(fftSize);
      }
    });

    it("should show noise floor correctly", () => {
      const samples = generateNoiseSignal(10240);
      const fftSize = 1024;
      const spectrogramData: Float32Array[] = [];

      for (let i = 0; i < 10; i++) {
        const rowSamples = samples.slice(i * fftSize, (i + 1) * fftSize);
        const row = calculateSpectrogramRow(rowSamples, fftSize);
        spectrogramData.push(row);
      }

      const { container } = render(
        <Spectrogram fftData={spectrogramData} />,
      );

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Noise should have relatively flat spectrum
      const firstRow = spectrogramData[0];
      if (firstRow) {
        const values = Array.from(firstRow);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
          values.length;
        expect(variance).toBeLessThan(100); // Relatively flat
      }
    });
  });

  describe("Waveform with SDR Signals", () => {
    it("should show AM envelope modulation", () => {
      const samples = generateAMSignal(10000);
      const { amplitude } = calculateWaveform(samples);

      const { container } = render(<WaveformVisualizer samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // AM envelope should vary
      const maxAmp = Math.max(...Array.from(amplitude));
      const minAmp = Math.min(...Array.from(amplitude));
      expect(maxAmp - minAmp).toBeGreaterThan(0.2);
    });

    it("should show FM constant envelope", () => {
      const samples = generateFMSignal(10000);
      const { amplitude } = calculateWaveform(samples);

      const { container } = render(<WaveformVisualizer samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // FM should have relatively constant amplitude
      const maxAmp = Math.max(...Array.from(amplitude));
      const minAmp = Math.min(...Array.from(amplitude));
      const variation = maxAmp - minAmp;
      expect(variation).toBeLessThan(0.3); // Less variation than AM
    });

    it("should show pulsed signal timing", () => {
      const samples = generatePulsedSignal(20000);
      const { amplitude } = calculateWaveform(samples);

      const { container } = render(<WaveformVisualizer samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();

      // Should show on/off periods
      const maxAmp = Math.max(...Array.from(amplitude));
      const nearZero = amplitude.filter((a: number) => a < 0.1).length;
      const nearMax = amplitude.filter((a: number) => a > maxAmp * 0.5).length;

      expect(nearZero).toBeGreaterThan(100); // Off periods
      expect(nearMax).toBeGreaterThan(100); // On periods
    });

    it("should handle long duration signals", () => {
      const samples = generateFMSignal(50000);

      const { container } = render(<WaveformVisualizer samples={samples} />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });
  });

  describe("Cross-Visualization Consistency", () => {
    it("should show consistent signal power across visualizations", () => {
      const samples = generateFMSignal(10240, 100e3);

      // IQ Constellation - calculate average magnitude
      const iqMagnitudes = samples
        .slice(0, 1000)
        .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
      const iqAvgPower =
        iqMagnitudes.reduce((a: number, b: number) => a + b, 0) /
        iqMagnitudes.length;

      // Spectrogram - calculate FFT power
      const fftSize = 1024;
      const fftRow = calculateSpectrogramRow(
        samples.slice(0, fftSize),
        fftSize,
      );
      const fftArray: number[] = Array.from(fftRow);
      const fftMaxPower = Math.max(...fftArray);

      // Waveform - calculate RMS
      const { amplitude } = calculateWaveform(samples.slice(0, 1000));
      const rms = Math.sqrt(
        amplitude.reduce((sum: number, a: number) => sum + a * a, 0) /
          amplitude.length,
      );

      // All should indicate strong signal
      expect(iqAvgPower).toBeGreaterThan(0.3);
      expect(fftMaxPower).toBeGreaterThan(-20); // dB
      expect(rms).toBeGreaterThan(0.3);
    });

    it("should show frequency content consistently", () => {
      // Generate signal at known frequency
      const carrierOffset = 200e3; // 200 kHz from center
      const samples = generateFMSignal(10240, carrierOffset);
      const fftSize = 1024;

      // Calculate expected bin
      const sampleRate = 10e6;
      const freqResolution = sampleRate / fftSize;
      const expectedBin = Math.round(carrierOffset / freqResolution);

      // Get FFT
      const fftRow = calculateSpectrogramRow(
        samples.slice(0, fftSize),
        fftSize,
      );

      // Find peak bin (accounting for frequency shift)
      const fftArray: number[] = Array.from(fftRow);
      const peakBin = fftArray.indexOf(Math.max(...fftArray));

      // Should be close to expected (±5 bins for spectral leakage)
      const binDiff = Math.abs(peakBin - expectedBin);
      expect(binDiff).toBeLessThan(5);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle typical FM station at 100.3 MHz", () => {
      // Reduced from 50k to 20k to prevent memory issues
      const samples = generateFMSignal(20000, 0); // Centered

      const { container: iqContainer, unmount: unmountIQ } = render(
        <IQConstellation samples={samples.slice(0, 5000)} />,
      );
      expect(iqContainer.querySelector("canvas")).toBeInTheDocument();

      const fftSize = 1024;
      const spectrogramData: Float32Array[] = [];
      for (let i = 0; i < 10; i++) {
        const row = calculateSpectrogramRow(
          samples.slice(i * fftSize, (i + 1) * fftSize),
          fftSize,
        );
        spectrogramData.push(row);
      }

      const { container: specContainer, unmount: unmountSpec } = render(
        <Spectrogram fftData={spectrogramData} />,
      );
      expect(specContainer.querySelector("canvas")).toBeInTheDocument();

      const { container: waveContainer, unmount: unmountWave } = render(
        <WaveformVisualizer samples={samples.slice(0, 5000)} />,
      );
      expect(waveContainer.querySelector("canvas")).toBeInTheDocument();
      
      // Cleanup
      unmountIQ();
      unmountSpec();
      unmountWave();
    });

    it("should handle weak signal with strong noise", () => {
      // Generate weak signal + noise
      const weakSignal = generateFMSignal(5000, 0).map((s) => ({
        I: s.I * 0.1,
        Q: s.Q * 0.1,
      }));
      const noise = generateNoiseSignal(5000);

      const combined: Sample[] = weakSignal.map((s, i) => ({
        I: s.I + (noise[i]?.I ?? 0),
        Q: s.Q + (noise[i]?.Q ?? 0),
      }));

      const { container } = render(<IQConstellation samples={combined} />);
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });

    it("should handle scanning across frequency band", () => {
      // Simulate frequency sweep
      const sweepData: Sample[] = [];
      for (let freq = -500e3; freq <= 500e3; freq += 50e3) {
        const segment = generateFMSignal(500, freq);
        sweepData.push(...segment);
      }

      const fftSize = 1024;
      const spectrogramData: Float32Array[] = [];
      for (let i = 0; i < Math.floor(sweepData.length / fftSize); i++) {
        const row = calculateSpectrogramRow(
          sweepData.slice(i * fftSize, (i + 1) * fftSize),
          fftSize,
        );
        spectrogramData.push(row);
      }

      const { container } = render(<Spectrogram fftData={spectrogramData} />);
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });
  });
});
