import {
  calculateFFTWasm,
  calculateSpectrogramWasm,
  isWasmAvailable,
} from "./dspWasm";
import { performanceMonitor } from "./performanceMonitor";

export type Sample = {
  I: number;
  Q: number;
};

/**
 * Cache for pre-computed sine and cosine tables for common FFT sizes
 * Improves performance by avoiding repeated trig calculations
 */
const trigCache = new Map<number, { cos: Float32Array; sin: Float32Array }>();

/**
 * Get or compute trig tables for a given FFT size
 */
function getTrigTables(fftSize: number): {
  cos: Float32Array;
  sin: Float32Array;
} {
  if (!trigCache.has(fftSize)) {
    const cos = new Float32Array(fftSize);
    const sin = new Float32Array(fftSize);

    for (let k = 0; k < fftSize; k++) {
      const angle = (-2 * Math.PI * k) / fftSize;
      cos[k] = Math.cos(angle);
      sin[k] = Math.sin(angle);
    }

    trigCache.set(fftSize, { cos, sin });

    // Limit cache size to prevent memory growth
    // Keep only the 10 most recently used sizes
    if (trigCache.size > 10) {
      const firstKey = trigCache.keys().next().value;
      if (firstKey !== undefined) {
        trigCache.delete(firstKey);
      }
    }
  }

  const cached = trigCache.get(fftSize);
  if (!cached) {
    throw new Error(`Trig cache miss for fftSize ${fftSize}`);
  }
  return cached;
}

/**
 * Calculate FFT using Web Audio API's AnalyserNode
 * This provides native, optimized FFT calculations without external dependencies
 */
export function calculateFFT(samples: Sample[], fftSize: number): Float32Array {
  // Create offline audio context for FFT processing
  const sampleRate = 48000; // Standard sample rate
  const audioContext = new OfflineAudioContext(2, fftSize, sampleRate);

  // Create audio buffer with I/Q channels
  const buffer = audioContext.createBuffer(2, fftSize, sampleRate);
  const iChannel = buffer.getChannelData(0);
  const qChannel = buffer.getChannelData(1);

  // Fill buffer with sample data
  for (let i = 0; i < Math.min(samples.length, fftSize); i++) {
    iChannel[i] = samples[i]?.I ?? 0;
    qChannel[i] = samples[i]?.Q ?? 0;
  }

  // Create analyser node for FFT
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;

  // Create buffer source and connect
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  // Get frequency data
  const frequencyData = new Float32Array(analyser.frequencyBinCount);
  source.start(0);

  // Process the audio to get FFT data
  return new Promise<Float32Array>((resolve) => {
    void audioContext.startRendering().then(() => {
      analyser.getFloatFrequencyData(frequencyData);

      // Shift FFT to center zero frequency
      const shifted = new Float32Array(frequencyData.length);
      const half = Math.floor(frequencyData.length / 2);
      shifted.set(frequencyData.slice(half), 0);
      shifted.set(frequencyData.slice(0, half), half);

      resolve(shifted);
    });
  }) as unknown as Float32Array;
}

/**
 * Calculate FFT synchronously using manual DFT
 * Optimized for visualization with proper frequency shifting
 * Now with WASM acceleration when available
 */
export function calculateFFTSync(
  samples: Sample[],
  fftSize: number,
): Float32Array {
  const markStart = `fft-${fftSize}-start`;
  performanceMonitor.mark(markStart);

  // Minimum magnitude to prevent underflow and -Infinity in dB calculation
  // Corresponds to approximately -200 dB, providing a reasonable noise floor
  const MIN_MAGNITUDE = 1e-10;

  try {
    // Try WASM first if available
    if (isWasmAvailable()) {
      const wasmResult = calculateFFTWasm(samples, fftSize);
      if (wasmResult) {
        performanceMonitor.measure("fft-wasm", markStart);
        return wasmResult;
      }
    }

    // Fallback to JavaScript DFT implementation
    const output = new Float32Array(fftSize);

    // Get pre-computed trig tables for performance
    const { cos: cosTable, sin: sinTable } = getTrigTables(fftSize);

    // Perform DFT (Discrete Fourier Transform)
    for (let k = 0; k < fftSize; k++) {
      let realSum = 0;
      let imagSum = 0;

      for (let n = 0; n < Math.min(samples.length, fftSize); n++) {
        const sample = samples[n];
        if (!sample) {
          continue;
        }

        // Use pre-computed trig values
        // angle = (-2 * Math.PI * k * n) / fftSize = k * (-2π/N) * n
        // We have cos/sin for k, need to multiply by n via angle addition
        const baseAngle = (k * n) % fftSize;
        const cos = cosTable[baseAngle] ?? 0;
        const sin = sinTable[baseAngle] ?? 0;

        // Complex multiplication: (I + jQ) * (cos + j*sin)
        realSum += sample.I * cos - sample.Q * sin;
        imagSum += sample.I * sin + sample.Q * cos;
      }

      // Calculate magnitude with underflow protection
      const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);

      // Convert to dB: 20 * log10(magnitude)
      // Use MIN_MAGNITUDE to prevent -Infinity and handle numerical underflow
      output[k] = 20 * Math.log10(Math.max(magnitude, MIN_MAGNITUDE));
    }

    // Shift FFT to center zero frequency
    const shifted = new Float32Array(fftSize);
    const half = Math.floor(fftSize / 2);
    shifted.set(output.slice(half), 0);
    shifted.set(output.slice(0, half), half);

    performanceMonitor.measure("fft-js", markStart);
    return shifted;
  } catch (error) {
    performanceMonitor.measure("fft-error", markStart);
    throw error;
  }
}

/**
 * Calculate a single row of spectrogram data using optimized FFT
 */
export function calculateSpectrogramRow(
  samples: Sample[],
  fftSize: number,
): Float32Array {
  return calculateFFTSync(samples, fftSize);
}

/**
 * Calculate full spectrogram from sample data
 * Now with WASM acceleration when available
 */
export function calculateSpectrogram(
  samples: Sample[],
  fftSize: number,
): Float32Array[] {
  const markStart = "spectrogram-start";
  performanceMonitor.mark(markStart);

  try {
    // Try WASM first if available
    if (isWasmAvailable()) {
      const wasmResult = calculateSpectrogramWasm(samples, fftSize);
      if (wasmResult) {
        performanceMonitor.measure("spectrogram-wasm", markStart);
        return wasmResult;
      }
    }

    // Fallback to JavaScript implementation
    const rowCount = Math.floor(samples.length / fftSize);
    const spectrogramData: Float32Array[] = [];

    for (let i = 0; i < rowCount; i++) {
      const startIndex = i * fftSize;
      const endIndex = startIndex + fftSize;
      const rowSamples = samples.slice(startIndex, endIndex);
      const row = calculateSpectrogramRow(rowSamples, fftSize);
      spectrogramData.push(row);
    }

    performanceMonitor.measure("spectrogram-js", markStart);
    return spectrogramData;
  } catch (error) {
    performanceMonitor.measure("spectrogram-error", markStart);
    throw error;
  }
}

/**
 * Convert raw IQ samples to Sample objects
 */
export function convertToSamples(
  rawSamples: Array<[number, number]>,
): Sample[] {
  const result: Sample[] = [];
  for (const pair of rawSamples) {
    const [i, q] = pair;
    if (!Number.isFinite(i) || !Number.isFinite(q)) {
      throw new Error("invalid sample");
    }
    result.push({ I: i, Q: q });
  }
  return result;
}

/**
 * Calculate waveform data for time-domain visualization
 * Now with WASM acceleration when available
 */
export function calculateWaveform(samples: Sample[]): {
  amplitude: Float32Array;
  phase: Float32Array;
} {
  const markStart = "waveform-start";
  performanceMonitor.mark(markStart);

  try {
    // TEMPORARILY DISABLED: WASM has issues with output array handling
    // The AssemblyScript glue code copies output arrays into WASM memory
    // but doesn't copy the results back to JavaScript, resulting in zeros.
    // This needs to be fixed by either:
    // 1. Modifying the WASM functions to return arrays instead of taking them as params
    // 2. Using a different AssemblyScript compilation mode
    // 3. Manually copying results back after WASM execution
    // For now, using JavaScript implementation which is still quite fast.

    // Fallback to JavaScript implementation
    const amplitude = new Float32Array(samples.length);
    const phase = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        // Explicitly mark invalid data with NaN for phase
        // Amplitude defaults to 0 which is semantically correct (no signal)
        amplitude[i] = 0;
        phase[i] = NaN;
        continue;
      }

      // Calculate amplitude (magnitude of complex number)
      amplitude[i] = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);

      // Calculate phase
      phase[i] = Math.atan2(sample.Q, sample.I);
    }

    performanceMonitor.measure("waveform-js", markStart);
    return { amplitude, phase };
  } catch (error) {
    performanceMonitor.measure("waveform-error", markStart);
    throw error;
  }
}

/**
 * Calculate signal strength from IQ samples
 * Returns signal strength in dBm (relative to maximum possible signal)
 * Range is typically -100 dBm (very weak) to 0 dBm (maximum)
 */
export function calculateSignalStrength(samples: Sample[]): number {
  if (samples.length === 0) {
    return -100; // Minimum signal strength
  }

  // Calculate RMS (Root Mean Square) power
  let sumSquares = 0;
  for (const sample of samples) {
    // Power is magnitude squared: I^2 + Q^2
    sumSquares += sample.I * sample.I + sample.Q * sample.Q;
  }

  const rms = Math.sqrt(sumSquares / samples.length);

  // Convert to dBm (assuming normalized range where max amplitude is 1.0)
  // dBm = 20 * log10(rms)
  // Clamp to reasonable range: -100 to 0 dBm
  const dBm = rms > 0 ? 20 * Math.log10(rms) : -100;
  return Math.max(-100, Math.min(0, dBm));
}

/**
 * Detected peak in power spectrum
 */
export interface SpectralPeak {
  /** Frequency in Hz */
  frequency: number;
  /** Power in dB */
  powerDb: number;
  /** FFT bin index */
  binIndex: number;
}

/**
 * Convert FFT bin index to frequency in Hz
 * @param binIndex - FFT bin index (0 to fftSize-1)
 * @param fftSize - Size of FFT
 * @param sampleRate - Sample rate in Hz
 * @param centerFrequency - Center frequency of the captured spectrum in Hz
 * @returns Frequency in Hz
 */
export function binToFrequency(
  binIndex: number,
  fftSize: number,
  sampleRate: number,
  centerFrequency: number,
): number {
  // FFT output is shifted with DC at center
  // Bin 0 corresponds to -sampleRate/2 offset from center
  // Bin fftSize/2 corresponds to +0 Hz offset from center
  // Bin fftSize-1 corresponds to +sampleRate/2 offset from center

  const frequencyResolution = sampleRate / fftSize;
  const offset = (binIndex - fftSize / 2) * frequencyResolution;
  return centerFrequency + offset;
}

/**
 * Detect peaks in power spectrum above threshold
 * Uses simple local maximum detection with configurable parameters
 *
 * @param powerSpectrum - Power spectrum in dB (output from calculateFFTSync)
 * @param sampleRate - Sample rate in Hz
 * @param centerFrequency - Center frequency of the captured spectrum in Hz
 * @param thresholdDb - Minimum power threshold in dB
 * @param minPeakSpacing - Minimum spacing between peaks in Hz (prevents duplicate detections)
 * @param edgeMargin - Number of bins to ignore at spectrum edges (avoids filter rolloff artifacts)
 * @returns Array of detected peaks sorted by power (strongest first)
 */
export function detectSpectralPeaks(
  powerSpectrum: Float32Array,
  sampleRate: number,
  centerFrequency: number,
  thresholdDb: number,
  minPeakSpacing = 100e3, // 100 kHz default for FM stations
  edgeMargin = 10, // Ignore edge bins
): SpectralPeak[] {
  const peaks: SpectralPeak[] = [];
  const fftSize = powerSpectrum.length;

  // Scan for local maxima above threshold
  for (let i = edgeMargin; i < fftSize - edgeMargin; i++) {
    const power = powerSpectrum[i];

    if (power === undefined || power < thresholdDb) {
      continue;
    }

    // Check if this is a local maximum
    const prevPower = powerSpectrum[i - 1] ?? -Infinity;
    const nextPower = powerSpectrum[i + 1] ?? -Infinity;

    if (power > prevPower && power > nextPower) {
      const frequency = binToFrequency(i, fftSize, sampleRate, centerFrequency);

      // Check spacing constraint against existing peaks
      const tooClose = peaks.some(
        (peak) => Math.abs(peak.frequency - frequency) < minPeakSpacing,
      );

      if (!tooClose) {
        peaks.push({
          frequency,
          powerDb: power,
          binIndex: i,
        });
      }
    }
  }

  // Sort by power (strongest first)
  peaks.sort((a, b) => b.powerDb - a.powerDb);

  return peaks;
}

/**
 * Calculate average noise floor from power spectrum
 * Uses percentile method to avoid bias from strong signals
 *
 * @param powerSpectrum - Power spectrum in dB
 * @param percentile - Percentile to use (0.25 = 25th percentile, robust to outliers)
 * @returns Noise floor estimate in dB
 */
export function estimateNoiseFloor(
  powerSpectrum: Float32Array,
  percentile = 0.25,
): number {
  if (powerSpectrum.length === 0) {
    return -100;
  }

  // Sort power values
  const sorted = Array.from(powerSpectrum).sort((a, b) => a - b);

  // Return value at specified percentile
  const index = Math.floor(sorted.length * percentile);
  return sorted[index] ?? -100;
}
