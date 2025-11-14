import { useState, useEffect, useCallback, useRef } from "react";
import { shouldUseMockSDR } from "../utils/e2e";
import { performanceMonitor } from "../utils/performanceMonitor";
import { dspWorkerPool } from "../workers/dspWorkerPool";
import type { ISDRDevice, IQSampleCallback } from "../models/SDRDevice";
import type { DspWorkerMessage } from "../workers/dspWorkerPool";

interface UseDspOptions {
  fftSize: number;
  onNewFft: (fft: Float32Array) => void;
  /** Optional callback with raw parsed IQ samples for opportunistic decoders (RDS, etc.) */
  onIQSamples?: (samples: ReturnType<ISDRDevice["parseSamples"]>) => void;
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
  const { fftSize, onNewFft, onIQSamples } = options;
  const [magnitudes, setMagnitudes] = useState(new Float32Array(fftSize));
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simPhaseRef = useRef<number>(0);
  // Throttling for FFT processing to match display refresh rate (~60 FPS)
  const lastProcessTime = useRef<number>(0);
  const MIN_PROCESS_INTERVAL_MS = 16; // ~60 Hz maximum FFT processing rate
  const pendingSamplesBuffer = useRef<Float32Array | null>(null);

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<DspWorkerMessage>) => {
      if (event.data.type === "fft") {
        // Reuse existing buffer instead of creating new one to prevent memory accumulation
        const payload = event.data.payload as ArrayBuffer;
        const newMagnitudes = new Float32Array(payload);

        // Reuse buffer to minimize allocations (copy data in-place)
        // IMPORTANT: The same buffer reference is reused to prevent allocations.
        // We rely on onNewFft callback firing to notify consumers of updates.
        // React state update is triggered by returning prevMagnitudes even though it's
        // the same reference, because we increment a counter to force re-render detection.
        setMagnitudes((prevMagnitudes) => {
          // If size changed, need new buffer
          if (prevMagnitudes.length !== newMagnitudes.length) {
            return newMagnitudes;
          }
          // Copy into existing buffer in-place - no allocation!
          prevMagnitudes.set(newMagnitudes);
          // Return same buffer reference to avoid allocation
          // Note: PrimaryVisualization reads directly from the ref, not from React state,
          // so this pattern works. The state update here is just to maintain compatibility.
          return prevMagnitudes;
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
        const interleavedSamples = new Float32Array(N * 2);
        const t0 = simPhaseRef.current;
        // Two tones inside band to give non-trivial spectrum
        const f1 = 0.07; // normalized frequency cycles/sample
        const f2 = 0.151;
        for (let i = 0; i < N; i++) {
          const t = t0 + i;
          interleavedSamples[i * 2] = Math.sin(2 * Math.PI * (f1 * t));
          interleavedSamples[i * 2 + 1] = Math.cos(2 * Math.PI * (f2 * t));
        }
        simPhaseRef.current = (t0 + N) % 1e9; // keep bounded

        // Transfer the buffer to worker (zero-copy)
        const buffer = interleavedSamples.buffer;
        dspWorkerPool.postMessage(
          {
            type: "process",
            payload: {
              samplesBuffer: buffer,
              fftSize,
            },
          },
          [buffer],
        );
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
        // Provide raw IQ samples upstream if requested
        if (onIQSamples) {
          onIQSamples(iq);
        }

        // Convert IQSample[] to interleaved Float32Array for zero-copy transfer
        const interleavedSamples = new Float32Array(iq.length * 2);
        for (let i = 0; i < iq.length; i++) {
          interleavedSamples[i * 2] = iq[i]?.I ?? 0;
          interleavedSamples[i * 2 + 1] = iq[i]?.Q ?? 0;
        }

        // Throttle FFT processing to match display refresh rate
        const now = performance.now();
        const timeSinceLastProcess = now - lastProcessTime.current;

        if (timeSinceLastProcess < MIN_PROCESS_INTERVAL_MS) {
          // Store latest samples but don't process yet
          pendingSamplesBuffer.current = interleavedSamples;
          return;
        }

        // Process immediately if enough time has passed
        lastProcessTime.current = now;
        pendingSamplesBuffer.current = null;

        // Transfer the buffer to worker (zero-copy)
        const buffer = interleavedSamples.buffer;
        dspWorkerPool.postMessage(
          {
            type: "process",
            payload: {
              samplesBuffer: buffer,
              fftSize,
            },
          },
          [buffer],
        );
      } catch {
        // Swallow parsing errors to avoid breaking stream; logging optional
      }
    };
    await device.receive(sampleCallback);
  }, [device, fftSize, onIQSamples]);

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
    return (): void => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, []);

  return { magnitudes, start, stop };
}
