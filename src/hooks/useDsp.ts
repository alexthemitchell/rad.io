import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';
import { dspWorkerPool } from '../workers/dspWorkerPool';
import type { ISDRDevice, IQSampleCallback } from '../models/SDRDevice';
import type { DspWorkerMessage } from '../workers/dspWorkerPool';

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

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<DspWorkerMessage>) => {
      if (event.data.type === 'fft') {
        // Reuse existing buffer instead of creating new one to prevent memory accumulation
        const payload = event.data.payload as ArrayBuffer;
        const newMagnitudes = new Float32Array(payload);
        
        // Reuse buffer to minimize allocations (copy data in-place)
        // IMPORTANT: Returns same reference to avoid allocations, which means React won't
        // detect state changes. Consumers MUST rely on the onNewFft callback for updates,
        // NOT on React state change detection for the magnitudes array.
        setMagnitudes(prevMagnitudes => {
          // If size changed, need new buffer
          if (prevMagnitudes.length !== newMagnitudes.length) {
            return newMagnitudes;
          }
          // Reuse existing buffer by copying data, return same reference to avoid allocations
          prevMagnitudes.set(newMagnitudes);
          return prevMagnitudes;
        });
        
        // Mark a visualization data push for performance cadence metrics
        performanceMonitor.mark('viz-push');
        performanceMonitor.measure('viz-push', 'viz-push');
        onNewFft(newMagnitudes);
      }
    },
    [onNewFft],
  );

  useEffect(() => {
    dspWorkerPool.addEventListener('message', handleWorkerMessage);
    return (): void => {
      dspWorkerPool.removeEventListener('message', handleWorkerMessage);
    };
  }, [handleWorkerMessage]);

  const start = useCallback(async () => {
    if (!device) {
      return;
    }

    const sampleCallback: IQSampleCallback = (raw) => {
      // Convert transport format (DataView) to IQSample[] using device's parser
      try {
        const iq = device.parseSamples(raw);
        if (Array.isArray(iq)) {
          dspWorkerPool.postMessage({
            type: 'process',
            payload: {
              samples: iq,
              fftSize,
            },
          });
        }
      } catch {
        // Swallow parsing errors to avoid breaking stream; logging optional
      }
    };

    await device.receive(sampleCallback);
  }, [device, fftSize]);

  const stop = useCallback(async () => {
    if (!device) {
      return;
    }
    await device.stopRx();
  }, [device]);

  return { magnitudes, start, stop };
}
