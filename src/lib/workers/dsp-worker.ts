/**
 * DSP Worker Implementation
 * Implements ADR-0002: Web Worker DSP Architecture
 * 
 * This worker handles intensive DSP operations to prevent blocking the main thread
 */

import { DSPMessage, DSPResponse } from "./types";

// Import DSP functions (will be available in worker context)
// We'll use a manual DFT implementation since we can't easily use OfflineAudioContext in workers

interface Sample {
  I: number;
  Q: number;
}

// FFT context cache to reuse trig tables
const fftContexts = new Map<number, { cosTable: Float32Array; sinTable: Float32Array }>();

function getTrigTables(size: number): { cosTable: Float32Array; sinTable: Float32Array } {
  if (!fftContexts.has(size)) {
    const cosTable = new Float32Array(size);
    const sinTable = new Float32Array(size);
    
    for (let i = 0; i < size; i++) {
      const angle = (-2 * Math.PI * i) / size;
      cosTable[i] = Math.cos(angle);
      sinTable[i] = Math.sin(angle);
    }
    
    fftContexts.set(size, { cosTable, sinTable });
  }
  
  return fftContexts.get(size)!;
}

function computeFFT(samples: Float32Array, fftSize: number): Float32Array {
  const MIN_MAGNITUDE = 1e-10;
  const output = new Float32Array(fftSize);
  
  // Convert Float32Array to IQ samples (assume interleaved I,Q format)
  const iqSamples: Sample[] = [];
  for (let i = 0; i < samples.length; i += 2) {
    iqSamples.push({
      I: samples[i] ?? 0,
      Q: samples[i + 1] ?? 0,
    });
  }
  
  const { cosTable, sinTable } = getTrigTables(fftSize);
  
  // Perform DFT
  for (let k = 0; k < fftSize; k++) {
    let realSum = 0;
    let imagSum = 0;
    
    for (let n = 0; n < Math.min(iqSamples.length, fftSize); n++) {
      const sample = iqSamples[n];
      if (!sample) continue;
      
      const baseAngle = (k * n) % fftSize;
      const cos = cosTable[baseAngle] ?? 0;
      const sin = sinTable[baseAngle] ?? 0;
      
      realSum += sample.I * cos - sample.Q * sin;
      imagSum += sample.I * sin + sample.Q * cos;
    }
    
    const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);
    output[k] = 20 * Math.log10(Math.max(magnitude, MIN_MAGNITUDE));
  }
  
  // Shift FFT to center zero frequency
  const shifted = new Float32Array(fftSize);
  const half = Math.floor(fftSize / 2);
  shifted.set(output.slice(half), 0);
  shifted.set(output.slice(0, half), half);
  
  return shifted;
}

function demodulate(
  samples: Float32Array,
  mode: "am" | "fm" | "usb" | "lsb",
  sampleRate: number,
): Float32Array {
  // Basic demodulation implementation
  const output = new Float32Array(samples.length / 2);
  
  switch (mode) {
    case "am": {
      // AM demodulation: calculate envelope
      for (let i = 0; i < samples.length; i += 2) {
        const I = samples[i] ?? 0;
        const Q = samples[i + 1] ?? 0;
        output[i / 2] = Math.sqrt(I * I + Q * Q);
      }
      break;
    }
    case "fm": {
      // FM demodulation: phase difference
      let prevPhase = 0;
      for (let i = 0; i < samples.length; i += 2) {
        const I = samples[i] ?? 0;
        const Q = samples[i + 1] ?? 0;
        const phase = Math.atan2(Q, I);
        let diff = phase - prevPhase;
        
        // Unwrap phase
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        
        output[i / 2] = diff;
        prevPhase = phase;
      }
      break;
    }
    default:
      // For USB/LSB, simple envelope for now
      for (let i = 0; i < samples.length; i += 2) {
        const I = samples[i] ?? 0;
        const Q = samples[i + 1] ?? 0;
        output[i / 2] = Math.sqrt(I * I + Q * Q);
      }
  }
  
  return output;
}

function applyFilter(
  samples: Float32Array,
  filterType: string,
  cutoff: number,
  sampleRate: number,
): Float32Array {
  // Simple low-pass filter implementation
  const output = new Float32Array(samples.length);
  const alpha = cutoff / (cutoff + sampleRate);
  
  output[0] = samples[0] ?? 0;
  for (let i = 1; i < samples.length; i++) {
    output[i] = alpha * (samples[i] ?? 0) + (1 - alpha) * output[i - 1];
  }
  
  return output;
}

function detectSignals(samples: Float32Array, threshold: number): object {
  // Signal detection: find peaks above threshold
  const peaks: { index: number; value: number }[] = [];
  
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1] ?? 0;
    const curr = samples[i] ?? 0;
    const next = samples[i + 1] ?? 0;
    
    if (curr > threshold && curr > prev && curr > next) {
      peaks.push({ index: i, value: curr });
    }
  }
  
  return { peaks, count: peaks.length };
}

// Worker message handler
self.onmessage = (event: MessageEvent<DSPMessage>) => {
  const startTime = performance.now();
  const { id, type, samples, sampleRate, params } = event.data;
  
  let result: Float32Array | object;
  let transferables: Transferable[] = [];
  
  try {
    switch (type) {
      case "fft":
        result = computeFFT(samples, params.fftSize as number);
        transferables = [result.buffer];
        break;
      case "demod":
        result = demodulate(samples, params.mode as "am" | "fm" | "usb" | "lsb", sampleRate);
        transferables = [result.buffer];
        break;
      case "filter":
        result = applyFilter(
          samples,
          params.filterType as string,
          params.cutoff as number,
          sampleRate,
        );
        transferables = [result.buffer];
        break;
      case "detect":
        result = detectSignals(samples, params.threshold as number);
        break;
      default:
        throw new Error(`Unknown operation: ${type}`);
    }
    
    const processingTime = performance.now() - startTime;
    
    const response: DSPResponse = {
      id,
      type,
      result,
      processingTime,
    };
    
    self.postMessage(response, transferables);
  } catch (error) {
    const response: DSPResponse = {
      id,
      type: "error",
      result: {},
      processingTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    
    self.postMessage(response);
  }
};
