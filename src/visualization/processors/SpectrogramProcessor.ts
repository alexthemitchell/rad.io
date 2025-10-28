import { calculateFFTSync } from "../../utils/dsp";
import { applyWindow, type WindowFunction } from "../../utils/dspProcessing";
import type { Sample } from "../../utils/dsp";
import type { FrameProcessor, FrameProcessorConfig } from "../interfaces";

/**
 * Configuration for Spectrogram processing
 */
export interface SpectrogramProcessorConfig extends FrameProcessorConfig {
  type: "spectrogram";
  /** FFT size for each time slice */
  fftSize: number;
  /** Hop size (overlap between consecutive FFTs) */
  hopSize: number;
  /** Window function to apply */
  windowFunction: WindowFunction;
  /** Whether to use WASM acceleration if available */
  useWasm: boolean;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Maximum number of time slices to buffer */
  maxTimeSlices: number;
}

/**
 * Spectrogram processor output data
 */
export interface SpectrogramOutput {
  /** 2D array: [timeSlice][frequencyBin] power values in dB */
  data: Float32Array[];
  /** Frequency bins in Hz */
  frequencies: Float32Array;
  /** Time values for each slice in seconds */
  times: Float32Array;
  /** FFT size used */
  fftSize: number;
  /** Number of time slices */
  numTimeSlices: number;
}

/**
 * FrameProcessor implementation that computes spectrograms.
 * Transforms IQ samples into time-frequency representation.
 *
 * @example
 * ```typescript
 * const processor = new SpectrogramProcessor({
 *   type: "spectrogram",
 *   fftSize: 1024,
 *   hopSize: 512,
 *   windowFunction: "hann",
 *   useWasm: true,
 *   sampleRate: 2048000,
 *   maxTimeSlices: 100,
 * });
 *
 * const output = processor.process(samples);
 * // output.data[t][f] contains power at time t, frequency bin f
 * ```
 */
export class SpectrogramProcessor
  implements FrameProcessor<Sample[], SpectrogramOutput>
{
  private config: SpectrogramProcessorConfig;
  private buffer: Float32Array[] = [];

  constructor(config: SpectrogramProcessorConfig) {
    this.validateConfig(config);
    this.config = { ...config };
  }

  /**
   * Process IQ samples and return spectrogram output
   */
  process(samples: Sample[]): SpectrogramOutput {
    if (samples.length < this.config.fftSize) {
      // Not enough samples for even one FFT
      return this.emptyOutput();
    }

    // Calculate number of FFT frames we can compute
    const numFrames = Math.floor(
      (samples.length - this.config.fftSize) / this.config.hopSize + 1,
    );

    const newData: Float32Array[] = [];

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.config.hopSize;
      const end = start + this.config.fftSize;
      const frame = samples.slice(start, end);

      // Apply window
      const windowed =
        this.config.windowFunction !== "rectangular"
          ? applyWindow(frame, this.config.windowFunction, this.config.useWasm)
          : frame;

      // Compute FFT for this frame (note: useWasm handled by WASM availability check)
      const magnitudes = calculateFFTSync(windowed, this.config.fftSize);

      newData.push(magnitudes);
    }

    // Add to buffer and maintain max size
    this.buffer.push(...newData);
    if (this.buffer.length > this.config.maxTimeSlices) {
      this.buffer = this.buffer.slice(-this.config.maxTimeSlices);
    }

    return this.buildOutput();
  }

  private buildOutput(): SpectrogramOutput {
    const frequencies = this.generateFrequencyBins();
    const times = this.generateTimeBins();

    return {
      data: this.buffer,
      frequencies,
      times,
      fftSize: this.config.fftSize,
      numTimeSlices: this.buffer.length,
    };
  }

  private emptyOutput(): SpectrogramOutput {
    return {
      data: [],
      frequencies: new Float32Array(0),
      times: new Float32Array(0),
      fftSize: this.config.fftSize,
      numTimeSlices: 0,
    };
  }

  private generateFrequencyBins(): Float32Array {
    const bins = new Float32Array(this.config.fftSize);
    const freqStep = this.config.sampleRate / this.config.fftSize;

    for (let i = 0; i < this.config.fftSize; i++) {
      bins[i] = i * freqStep;
    }

    return bins;
  }

  private generateTimeBins(): Float32Array {
    const times = new Float32Array(this.buffer.length);
    const timeStep = this.config.hopSize / this.config.sampleRate;

    for (let i = 0; i < this.buffer.length; i++) {
      times[i] = i * timeStep;
    }

    return times;
  }

  getConfig(): SpectrogramProcessorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<SpectrogramProcessorConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);
    this.config = newConfig;

    // Clear buffer when config changes
    this.buffer = [];
  }

  /**
   * Clear the spectrogram buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  private validateConfig(config: SpectrogramProcessorConfig): void {
    if (!Number.isInteger(config.fftSize) || config.fftSize <= 0) {
      throw new Error("fftSize must be a positive integer");
    }

    if ((config.fftSize & (config.fftSize - 1)) !== 0) {
      throw new Error("fftSize must be a power of 2");
    }

    if (!Number.isInteger(config.hopSize) || config.hopSize <= 0) {
      throw new Error("hopSize must be a positive integer");
    }

    if (config.hopSize > config.fftSize) {
      throw new Error("hopSize must not exceed fftSize");
    }

    if (config.sampleRate <= 0) {
      throw new Error("sampleRate must be positive");
    }

    if (!Number.isInteger(config.maxTimeSlices) || config.maxTimeSlices <= 0) {
      throw new Error("maxTimeSlices must be a positive integer");
    }
  }
}
