/**
 * DSP Worker Implementation
 * Implements ADR-0002: Web Worker DSP Architecture
 *
 * This worker handles intensive DSP operations to prevent blocking the main thread
 */

import type { DSPMessage, DSPResponse } from "./types";

// FFT context cache to reuse trig tables
const fftContexts = new Map<
  number,
  { cosTable: Float32Array; sinTable: Float32Array }
>();

function getTrigTables(size: number): {
  cosTable: Float32Array;
  sinTable: Float32Array;
} {
  const cached = fftContexts.get(size);
  if (cached) {
    return cached;
  }

  const cosTable = new Float32Array(size);
  const sinTable = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    const angle = (-2 * Math.PI * i) / size;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }

  const tables = { cosTable, sinTable };
  fftContexts.set(size, tables);
  return tables;
}

function computeFFT(samples: Float32Array, fftSize: number): Float32Array {
  const MIN_MAGNITUDE = 1e-10;
  const output = new Float32Array(fftSize);

  const { cosTable, sinTable } = getTrigTables(fftSize);

  // Perform DFT - operate directly on Float32Array (interleaved I,Q format)
  // Calculate sample count once (avoid repeated computation)
  const samplePairs = Math.floor(samples.length / 2);
  const sampleCount = Math.min(samplePairs, fftSize);

  for (let k = 0; k < fftSize; k++) {
    let realSum = 0;
    let imagSum = 0;

    for (let n = 0; n < sampleCount; n++) {
      // Access samples directly without intermediate allocation
      const I = samples[n * 2] ?? 0;
      const Q = samples[n * 2 + 1] ?? 0;

      const baseAngle = (k * n) % fftSize;
      const cos = cosTable[baseAngle] ?? 0;
      const sin = sinTable[baseAngle] ?? 0;

      realSum += I * cos - Q * sin;
      imagSum += I * sin + Q * cos;
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

  // FM demodulation gain factor based on sample rate
  const fmGain = sampleRate / (2 * Math.PI);

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
        if (diff > Math.PI) {
          diff -= 2 * Math.PI;
        }
        if (diff < -Math.PI) {
          diff += 2 * Math.PI;
        }

        output[i / 2] = diff * fmGain;
        prevPhase = phase;
      }
      break;
    }
    case "usb":
    case "lsb": {
      // For USB/LSB, simple envelope for now
      for (let i = 0; i < samples.length; i += 2) {
        const I = samples[i] ?? 0;
        const Q = samples[i + 1] ?? 0;
        output[i / 2] = Math.sqrt(I * I + Q * Q);
      }
      break;
    }
  }

  return output;
}

function applyFilter(
  samples: Float32Array,
  _filterType: string,
  cutoff: number,
  sampleRate: number,
): Float32Array {
  // Simple low-pass filter implementation
  const output = new Float32Array(samples.length);
  const alpha = cutoff / (cutoff + sampleRate);

  const firstSample = samples[0];
  output[0] = firstSample ?? 0;
  for (let i = 1; i < samples.length; i++) {
    const sample = samples[i];
    const prevSample = output[i - 1];
    if (sample !== undefined && prevSample !== undefined) {
      output[i] = alpha * sample + (1 - alpha) * prevSample;
    }
  }

  return output;
}

function detectSignals(
  samples: Float32Array,
  threshold: number,
): { peaks: Array<{ index: number; value: number }>; count: number } {
  // Signal detection: find peaks above threshold
  const peaks: Array<{ index: number; value: number }> = [];

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
self.onmessage = (event: MessageEvent<DSPMessage>): void => {
  const startTime = performance.now();
  const { id, type, samples, sampleRate, params } = event.data;

  let result:
    | Float32Array
    | { peaks: Array<{ index: number; value: number }>; count: number };
  const transferables: Transferable[] = [];

  try {
    switch (type) {
      case "fft": {
        const fftSizeParam = params["fftSize"];
        if (typeof fftSizeParam !== "number") {
          throw new Error("fftSize parameter must be a number");
        }
        result = computeFFT(samples, fftSizeParam);
        transferables.push(result.buffer);
        break;
      }
      case "demod": {
        const modeParam = params["mode"];
        if (
          typeof modeParam !== "string" ||
          !["am", "fm", "usb", "lsb"].includes(modeParam)
        ) {
          throw new Error("mode parameter must be one of: am, fm, usb, lsb");
        }
        result = demodulate(
          samples,
          modeParam as "am" | "fm" | "usb" | "lsb",
          sampleRate,
        );
        transferables.push(result.buffer);
        break;
      }
      case "filter": {
        const filterTypeParam = params["filterType"];
        const cutoffParam = params["cutoff"];
        if (typeof filterTypeParam !== "string") {
          throw new Error("filterType parameter must be a string");
        }
        if (typeof cutoffParam !== "number") {
          throw new Error("cutoff parameter must be a number");
        }
        result = applyFilter(samples, filterTypeParam, cutoffParam, sampleRate);
        transferables.push(result.buffer);
        break;
      }
      case "detect": {
        const thresholdParam = params["threshold"];
        if (typeof thresholdParam !== "number") {
          throw new Error("threshold parameter must be a number");
        }
        result = detectSignals(samples, thresholdParam);
        break;
      }
      default:
        throw new Error(`Unknown operation: ${String(type)}`);
    }

    const processingTime = performance.now() - startTime;

    const response: DSPResponse = {
      id,
      type,
      result,
      processingTime,
    };

    self.postMessage(response, { transfer: transferables });
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
