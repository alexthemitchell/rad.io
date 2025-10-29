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
        const newMagnitudes = new Float32Array(event.data.payload as ArrayBuffer);
        setMagnitudes(newMagnitudes);
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

    const sampleCallback: IQSampleCallback = (samples) => {
      dspWorkerPool.postMessage({
        type: 'process',
        payload: {
          samples,
          fftSize,
        },
      });
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
