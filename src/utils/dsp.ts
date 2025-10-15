import {
  calculateFFTWasm,
  calculateWaveformWasm,
  calculateSpectrogramWasm,
  isWasmAvailable,
} from './dspWasm';

export type Sample = {
  I: number;
  Q: number;
};

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
    iChannel[i] = samples[i]?.I || 0;
    qChannel[i] = samples[i]?.Q || 0;
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
    audioContext.startRendering().then(() => {
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
  // Try WASM first if available
  if (isWasmAvailable()) {
    const wasmResult = calculateFFTWasm(samples, fftSize);
    if (wasmResult) {
      return wasmResult;
    }
  }

  // Fallback to JavaScript DFT implementation
  const output = new Float32Array(fftSize);

  // Perform DFT (Discrete Fourier Transform)
  for (let k = 0; k < fftSize; k++) {
    let realSum = 0;
    let imagSum = 0;

    for (let n = 0; n < Math.min(samples.length, fftSize); n++) {
      const sample = samples[n];
      if (!sample) {
        continue;
      }

      const angle = (-2 * Math.PI * k * n) / fftSize;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Complex multiplication: (I + jQ) * (cos + j*sin)
      realSum += sample.I * cos - sample.Q * sin;
      imagSum += sample.I * sin + sample.Q * cos;
    }

    // Calculate magnitude
    const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);

    // Convert to dB: 20 * log10(magnitude)
    output[k] = magnitude > 0 ? 20 * Math.log10(magnitude) : -100;
  }

  // Shift FFT to center zero frequency
  const shifted = new Float32Array(fftSize);
  const half = Math.floor(fftSize / 2);
  shifted.set(output.slice(half), 0);
  shifted.set(output.slice(0, half), half);

  return shifted;
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
  // Try WASM first if available
  if (isWasmAvailable()) {
    const wasmResult = calculateSpectrogramWasm(samples, fftSize);
    if (wasmResult) {
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

  return spectrogramData;
}

/**
 * Convert raw IQ samples to Sample objects
 */
export function convertToSamples(rawSamples: [number, number][]): Sample[] {
  return rawSamples.map(([i, q]) => {
    if (i === undefined || q === undefined) {
      throw new Error("invalid sample");
    }
    return { I: i, Q: q };
  });
}

/**
 * Calculate waveform data for time-domain visualization
 * Now with WASM acceleration when available
 */
export function calculateWaveform(samples: Sample[]): {
  amplitude: Float32Array;
  phase: Float32Array;
} {
  // Try WASM first if available
  if (isWasmAvailable()) {
    const wasmResult = calculateWaveformWasm(samples);
    if (wasmResult) {
      return wasmResult;
    }
  }

  // Fallback to JavaScript implementation
  const amplitude = new Float32Array(samples.length);
  const phase = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample) {
      continue;
    }

    // Calculate amplitude (magnitude of complex number)
    amplitude[i] = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);

    // Calculate phase
    phase[i] = Math.atan2(sample.Q, sample.I);
  }

  return { amplitude, phase };
}
