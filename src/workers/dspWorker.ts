/// <reference lib="webworker" />

import { calculateFFTSync } from "../utils/dsp";
import type { IQSample } from "../models/SDRDevice";

interface WorkerPayload {
  // Interleaved I/Q samples: [I0, Q0, I1, Q1, ...]
  samplesBuffer: ArrayBuffer;
  fftSize: number;
}

// Persistent IIR DC blocker state for continuous filtering across blocks
// This maintains filter history to provide smooth DC removal without creating notches
const dcBlockerState = {
  prevInputI: 0,
  prevInputQ: 0,
  prevOutputI: 0,
  prevOutputQ: 0,
};

/**
 * Apply IIR DC Blocker with high-pass characteristic
 * Uses first-order IIR filter: y[n] = x[n] - x[n-1] + α*y[n-1]
 * With α = 0.995, cutoff frequency ≈ 16 Hz @ 2 MSPS (very gentle, only removes true DC)
 *
 * This approach is superior to mean subtraction because:
 * - Maintains state across FFT blocks for consistent filtering
 * - Only attenuates very low frequencies (< 20 Hz)
 * - Doesn't create notches or distortion at center frequency
 * - Standard practice in SDR receivers (GNU Radio, SDR++, etc.)
 */
function applyDCBlocker(samples: IQSample[]): IQSample[] {
  const alpha = 0.995; // Very high value = very low cutoff frequency
  const output: IQSample[] = [];

  let { prevInputI, prevInputQ, prevOutputI, prevOutputQ } = dcBlockerState;

  for (const sample of samples) {
    // High-pass IIR filter formula
    const outputI = sample.I - prevInputI + alpha * prevOutputI;
    const outputQ = sample.Q - prevInputQ + alpha * prevOutputQ;

    output.push({ I: outputI, Q: outputQ });

    prevInputI = sample.I;
    prevInputQ = sample.Q;
    prevOutputI = outputI;
    prevOutputQ = outputQ;
  }

  // Persist state for next block
  dcBlockerState.prevInputI = prevInputI;
  dcBlockerState.prevInputQ = prevInputQ;
  dcBlockerState.prevOutputI = prevOutputI;
  dcBlockerState.prevOutputQ = prevOutputQ;

  return output;
}

self.onmessage = (
  event: MessageEvent<{ type: string; payload: WorkerPayload }>,
): void => {
  const { type, payload } = event.data;

  if (type === "process") {
    const { samplesBuffer, fftSize } = payload;

    // Convert interleaved Float32Array back to IQSample[] for calculateFFTSync
    const interleavedSamples = new Float32Array(samplesBuffer);
    const sampleCount = interleavedSamples.length / 2;
    const samples: IQSample[] = Array.from({ length: sampleCount }, (_, i) => ({
      I: interleavedSamples[i * 2] ?? 0,
      Q: interleavedSamples[i * 2 + 1] ?? 0,
    }));

    // Apply IIR DC blocker to remove DC offset smoothly without creating notches
    const correctedSamples = applyDCBlocker(samples);

    const magnitudes = calculateFFTSync(correctedSamples, fftSize);
    // Transfer the underlying ArrayBuffer to avoid cloning
    const buffer = magnitudes.buffer;

    try {
      self.postMessage(
        {
          type: "fft",
          payload: buffer,
        },
        [buffer],
      );
    } catch (_) {
      // Fallback without transfer if environment doesn't support it
      self.postMessage({
        type: "fft",
        payload: buffer,
      });
    }
  }
};

export {};
