/**
 * Audio Resampler
 *
 * High-quality audio resampling using windowed sinc interpolation.
 * Provides better quality than simple linear interpolation for
 * converting between SDR sample rates and audio sample rates.
 *
 * Features:
 * - Windowed sinc (Lanczos) resampling
 * - Anti-aliasing low-pass filtering
 * - Configurable quality (kernel size)
 * - Efficient processing for real-time use
 *
 * @module audioResampler
 */

/**
 * Resampler quality presets
 */
export enum ResamplerQuality {
  LOW = 4, // Fast, lower quality (kernel size = 4)
  MEDIUM = 8, // Balanced (kernel size = 8)
  HIGH = 16, // Slow, high quality (kernel size = 16)
  VERY_HIGH = 32, // Very slow, best quality (kernel size = 32)
}

/**
 * Audio Resampler
 *
 * Converts audio sample rate using windowed sinc interpolation.
 * This is significantly better quality than linear interpolation
 * at the cost of more computation.
 */
export class AudioResampler {
  private readonly inputRate: number;
  private readonly outputRate: number;
  private readonly ratio: number;
  private readonly kernelSize: number;
  private readonly sincTable: Float32Array;
  private readonly windowTable: Float32Array;
  private inputBuffer: Float32Array;
  private position = 0;

  /**
   * Create a new audio resampler
   *
   * @param inputRate - Input sample rate in Hz
   * @param outputRate - Output sample rate in Hz
   * @param quality - Resampling quality (kernel size)
   */
  constructor(
    inputRate: number,
    outputRate: number,
    quality: ResamplerQuality = ResamplerQuality.MEDIUM,
  ) {
    this.inputRate = inputRate;
    this.outputRate = outputRate;
    this.ratio = inputRate / outputRate;
    this.kernelSize = quality;

    // Pre-compute sinc and window tables for efficiency
    const tableSize = this.kernelSize * 1024; // High resolution lookup table
    this.sincTable = new Float32Array(tableSize);
    this.windowTable = new Float32Array(tableSize);

    // Build lookup tables
    for (let i = 0; i < tableSize; i++) {
      const x = (i / tableSize) * this.kernelSize;
      this.sincTable[i] = this.sinc(x);
      this.windowTable[i] = this.lanczosWindow(x, this.kernelSize);
    }

    // Initialize input buffer (circular buffer)
    this.inputBuffer = new Float32Array(this.kernelSize * 2);
  }

  /**
   * Sinc function: sin(πx) / (πx)
   */
  private sinc(x: number): number {
    if (Math.abs(x) < 1e-6) {
      return 1.0;
    }
    const pix = Math.PI * x;
    return Math.sin(pix) / pix;
  }

  /**
   * Lanczos window function
   */
  private lanczosWindow(x: number, a: number): number {
    if (Math.abs(x) >= a) {
      return 0.0;
    }
    return this.sinc(x / a);
  }

  /**
   * Get windowed sinc value from lookup table
   */
  private getKernel(x: number): number {
    const absX = Math.abs(x);
    if (absX >= this.kernelSize) {
      return 0;
    }

    // Lookup in table with linear interpolation
    const tablePos = (absX / this.kernelSize) * (this.sincTable.length - 1);
    const index = Math.floor(tablePos);
    const frac = tablePos - index;

    const sinc0 = this.sincTable[index] ?? 0;
    const sinc1 = this.sincTable[index + 1] ?? 0;
    const window0 = this.windowTable[index] ?? 0;
    const window1 = this.windowTable[index + 1] ?? 0;

    const sinc = sinc0 * (1 - frac) + sinc1 * frac;
    const window = window0 * (1 - frac) + window1 * frac;

    return sinc * window;
  }

  /**
   * Resample audio samples
   *
   * @param input - Input samples at input sample rate
   * @returns Resampled output at output sample rate
   */
  resample(input: Float32Array): Float32Array {
    if (this.ratio === 1.0) {
      // No resampling needed
      return input;
    }

    // Calculate output length
    const outputLength = Math.ceil(input.length / this.ratio);
    const output = new Float32Array(outputLength);

    // Shift input buffer and add new samples
    const bufferSize = this.inputBuffer.length;
    const shiftAmount = Math.min(input.length, bufferSize);

    // Shift existing samples
    for (let i = 0; i < bufferSize - shiftAmount; i++) {
      this.inputBuffer[i] = this.inputBuffer[i + shiftAmount] ?? 0;
    }

    // Add new samples
    const startPos = Math.max(0, bufferSize - input.length);
    for (let i = 0; i < Math.min(input.length, bufferSize); i++) {
      this.inputBuffer[startPos + i] = input[i] ?? 0;
    }

    // Resample using windowed sinc interpolation
    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * this.ratio + this.position;
      const srcIndex = Math.floor(srcPos);
      const frac = srcPos - srcIndex;

      let sum = 0;
      let weightSum = 0;

      // Convolve with windowed sinc kernel
      for (let j = -this.kernelSize; j < this.kernelSize; j++) {
        const bufferIndex = srcIndex + j + this.kernelSize;
        if (bufferIndex >= 0 && bufferIndex < bufferSize) {
          const weight = this.getKernel(j - frac);
          sum += (this.inputBuffer[bufferIndex] ?? 0) * weight;
          weightSum += weight;
        }
      }

      // Normalize
      output[i] = weightSum > 0 ? sum / weightSum : 0;
    }

    // Update position for next call
    this.position = (this.position + input.length) % this.ratio;

    return output;
  }

  /**
   * Reset resampler state
   */
  reset(): void {
    this.inputBuffer.fill(0);
    this.position = 0;
  }

  /**
   * Get resampling ratio (input / output)
   */
  getRatio(): number {
    return this.ratio;
  }

  /**
   * Get expected output length for a given input length
   */
  getOutputLength(inputLength: number): number {
    return Math.ceil(inputLength / this.ratio);
  }
}

/**
 * Simple and fast linear interpolation resampler
 *
 * Use when quality is not critical and performance is important.
 */
export class LinearResampler {
  private readonly ratio: number;
  private lastSample = 0;

  constructor(inputRate: number, outputRate: number) {
    this.ratio = inputRate / outputRate;
  }

  /**
   * Resample using linear interpolation
   */
  resample(input: Float32Array): Float32Array {
    if (this.ratio === 1.0) {
      return input;
    }

    const outputLength = Math.ceil(input.length / this.ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * this.ratio;
      const index0 = Math.floor(srcPos);
      const index1 = Math.min(index0 + 1, input.length - 1);
      const frac = srcPos - index0;

      const val0 = input[index0] ?? this.lastSample;
      const val1 = input[index1] ?? val0;
      output[i] = val0 * (1 - frac) + val1 * frac;
    }

    this.lastSample = input[input.length - 1] ?? 0;
    return output;
  }

  reset(): void {
    this.lastSample = 0;
  }

  getRatio(): number {
    return this.ratio;
  }

  getOutputLength(inputLength: number): number {
    return Math.ceil(inputLength / this.ratio);
  }
}

/**
 * Create an optimal resampler for the given sample rates
 *
 * Chooses between linear and sinc resampling based on ratio and quality needs.
 *
 * @param inputRate - Input sample rate
 * @param outputRate - Output sample rate
 * @param quality - Desired quality (optional)
 * @returns Resampler instance
 */
export function createResampler(
  inputRate: number,
  outputRate: number,
  quality?: ResamplerQuality,
): AudioResampler | LinearResampler {
  const ratio = inputRate / outputRate;

  // Use linear resampler for small ratios or when quality is low
  if (!quality || quality === ResamplerQuality.LOW || Math.abs(ratio - 1) < 0.1) {
    return new LinearResampler(inputRate, outputRate);
  }

  return new AudioResampler(inputRate, outputRate, quality);
}
