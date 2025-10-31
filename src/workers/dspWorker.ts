/// <reference lib="webworker" />

import { calculateFFTSync } from "../utils/dsp";
import type { IQSample } from "../models/SDRDevice";

interface WorkerPayload {
  samples: IQSample[];
  fftSize: number;
}

self.onmessage = (
  event: MessageEvent<{ type: string; payload: WorkerPayload }>,
): void => {
  const { type, payload } = event.data;

  if (type === "process") {
    const { samples, fftSize } = payload;
    const magnitudes = calculateFFTSync(samples, fftSize);
    self.postMessage({
      type: "fft",
      payload: magnitudes,
    });
  }
};

export {};
