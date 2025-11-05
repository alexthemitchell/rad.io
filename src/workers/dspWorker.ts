/// <reference lib="webworker" />

import { calculateFFTSync } from "../utils/dsp";
import type { IQSample } from "../models/SDRDevice";

interface WorkerPayload {
  // Interleaved I/Q samples: [I0, Q0, I1, Q1, ...]
  samplesBuffer: ArrayBuffer;
  fftSize: number;
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

    const magnitudes = calculateFFTSync(samples, fftSize);
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
