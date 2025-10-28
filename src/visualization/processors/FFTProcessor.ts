import { calculateFFTSync } from "../../utils/dsp";
import { applyWindow, type WindowFunction } from "../../utils/dspProcessing";
import type { Sample } from "../../utils/dsp";
import type { FrameProcessor, FrameProcessorConfig } from "../interfaces";

/**
 * Configuration for FFT processing
 */
export interface FFTProcessorConfig extends FrameProcessorConfig {
  type: "fft";
  /** FFT size (must be power of 2) */
  fftSize: number;
  /** Window function to apply before FFT */
  windowFunction: WindowFunction;
  /** Whether to use WASM acceleration if available */
  useWasm: boolean;
  /** Sample rate in Hz (for frequency binning) */
  sampleRate: number;
}

/**
 * FFT processor output data
 */
export interface FFTOutput {
  /** Power spectrum magnitude in dB */
  magnitudes: Float32Array;
  /** Frequency bins in Hz */
  frequencies: Float32Array;
  /** FFT size used */
  fftSize: number;
}

/**
 * FrameProcessor implementation that performs FFT with windowing.
 * Transforms IQ samples into frequency-domain power spectrum.
 *
 * @example
 * ```typescript
 * const processor = new FFTProcessor({
 *   type: "fft",
 *   fftSize: 2048,
 *   windowFunction: "hann",
 *   useWasm: true,
 *   sampleRate: 2048000,
 * });
 *
 * const output = processor.process(samples);
 * // output.magnitudes contains power spectrum in dB
 * ```
 */
export class FFTProcessor implements FrameProcessor<Sample[], FFTOutput> {
  private config: FFTProcessorConfig;

  constructor(config: FFTProcessorConfig) {
    this.validateConfig(config);
    this.config = { ...config };
  }

  /**
   * Process IQ samples and return FFT output
   */
  process(samples: Sample[]): FFTOutput {
    // Ensure we have correct number of samples
    const inputSamples =
      samples.length > this.config.fftSize
        ? samples.slice(0, this.config.fftSize)
        : samples;

    if (inputSamples.length < this.config.fftSize) {
      // Pad with zeros if needed
      const padded: Sample[] = [...inputSamples];
      while (padded.length < this.config.fftSize) {
        padded.push({ I: 0, Q: 0 });
      }
      return this.processInternal(padded);
    }

    return this.processInternal(inputSamples);
  }

  private processInternal(samples: Sample[]): FFTOutput {
    // Apply window function if not rectangular
    const windowed =
      this.config.windowFunction !== "rectangular"
        ? applyWindow(samples, this.config.windowFunction, this.config.useWasm)
        : samples;

    // Calculate FFT (note: useWasm is handled inside calculateFFTSync via WASM availability check)
    const magnitudes = calculateFFTSync(windowed, this.config.fftSize);

    // Generate frequency bins
    const frequencies = this.generateFrequencyBins();

    return {
      magnitudes,
      frequencies,
      fftSize: this.config.fftSize,
    };
  }

  private generateFrequencyBins(): Float32Array {
    const bins = new Float32Array(this.config.fftSize);
    const freqStep = this.config.sampleRate / this.config.fftSize;

    for (let i = 0; i < this.config.fftSize; i++) {
      // FFT output is from 0 to sampleRate
      // After FFT shift, DC is at center
      bins[i] = i * freqStep;
    }

    return bins;
  }

  getConfig(): FFTProcessorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<FFTProcessorConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);
    this.config = newConfig;
  }

  private validateConfig(config: FFTProcessorConfig): void {
    if (!Number.isInteger(config.fftSize) || config.fftSize <= 0) {
      throw new Error("fftSize must be a positive integer");
    }

    // Check if power of 2
    if ((config.fftSize & (config.fftSize - 1)) !== 0) {
      throw new Error("fftSize must be a power of 2");
    }

    if (config.sampleRate <= 0) {
      throw new Error("sampleRate must be positive");
    }
  }
}
