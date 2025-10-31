import { useState, useEffect, useCallback, useRef } from "react";
import { performanceMonitor } from "../utils/performanceMonitor";
import { dspWorkerPool } from "../workers/dspWorkerPool";
import type { ISDRDevice, IQSampleCallback } from "../models/SDRDevice";
import type { DspWorkerMessage } from "../workers/dspWorkerPool";
import { shouldUseMockSDR } from "../utils/e2e";
import type { IQSample } from "../models/SDRDevice";

interface UseDspOptions {
  fftSize: number;
  onNewFft: (fft: Float32Array) => void;
}

// Use the shared DspWorkerMessage type from the worker pool to keep MessageEvent generic consistent

export function useDsp(
  device: ISDRDevice | undefined,
  options: UseDspOptions,
): {
  magnitudes: Float32Array;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { fftSize, onNewFft } = options;
  const [magnitudes, setMagnitudes] = useState(new Float32Array(fftSize));
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simPhaseRef = useRef<number>(0);

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<DspWorkerMessage>) => {
      if (event.data.type === "fft") {
        // Reuse existing buffer instead of creating new one to prevent memory accumulation
        const payload = event.data.payload as ArrayBuffer;
        const newMagnitudes = new Float32Array(payload);

        // Reuse buffer to minimize allocations (copy data in-place)
        // IMPORTANT: Returns same reference to avoid allocations. setState will still trigger
        // re-renders, but consumers should rely on the onNewFft callback for immediate updates
        // rather than depending on React state changes, as the buffer contents change in-place.
        setMagnitudes((prevMagnitudes) => {
          // If size changed, need new buffer
          if (prevMagnitudes.length !== newMagnitudes.length) {
            return newMagnitudes;
          }
          // Copy into existing buffer, but return a new reference so React detects the change
          // (addresses PR feedback about state update detection)
          prevMagnitudes.set(newMagnitudes);
          return new Float32Array(prevMagnitudes);
        });

        // Mark a visualization data push for performance cadence metrics
        performanceMonitor.mark("viz-push");
        performanceMonitor.measure("viz-push", "viz-push");
        onNewFft(newMagnitudes);
      }
    },
    [onNewFft],
  );

  useEffect(() => {
    dspWorkerPool.addEventListener("message", handleWorkerMessage);
    return (): void => {
      dspWorkerPool.removeEventListener("message", handleWorkerMessage);
    };
  }, [handleWorkerMessage]);

  const start = useCallback(async () => {
    // Simulated streaming path for E2E/CI when mock SDR is requested
    if (!device && shouldUseMockSDR()) {
      // Avoid multiple timers
      if (simTimerRef.current) {
        return;
      }

      // Generate a simple composite tone in IQ domain and feed the DSP worker
      const generate = (): void => {
        const N = fftSize; // match current FFT size
        const samples: IQSample[] = new Array(N);
        const t0 = simPhaseRef.current;
        // Two tones inside band to give non-trivial spectrum
        const f1 = 0.07; // normalized frequency cycles/sample
        const f2 = 0.151;
        for (let i = 0; i < N; i++) {
          const t = t0 + i;
          const iSample = Math.sin(2 * Math.PI * (f1 * t));
          const qSample = Math.cos(2 * Math.PI * (f2 * t));
          samples[i] = { I: iSample, Q: qSample };
        }
        simPhaseRef.current = (t0 + N) % (1e9); // keep bounded
        dspWorkerPool.postMessage({
          type: "process",
          payload: {
            samples,
            fftSize,
          },
        });
      };

      // Target ~30–33Hz updates to reduce CPU load under automation
      simTimerRef.current = setInterval(generate, 33);
      // Kick immediately for faster first paint
      generate();
      return;
    }

    if (!device) {
      return;
    }

    const sampleCallback: IQSampleCallback = (raw) => {
      // Convert transport format (DataView) to IQSample[] using device's parser
      try {
        const iq = device.parseSamples(raw);
        dspWorkerPool.postMessage({
          type: "process",
          payload: {
            samples: iq,
            fftSize,
          },
        });
      } catch {
        // Swallow parsing errors to avoid breaking stream; logging optional
      }
    };

    await device.receive(sampleCallback);
  }, [device, fftSize]);

  const stop = useCallback(async () => {
    // Stop simulated stream if running
    if (!device && simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
      return;
    }
    if (!device) {
      return;
    }
    await device.stopRx();
  }, [device]);

  // Ensure simulated generator is torn down on unmount regardless of explicit stop
  useEffect(() => {
    return () => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, []);

  return { magnitudes, start, stop };
}
