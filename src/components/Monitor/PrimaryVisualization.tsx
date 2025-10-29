import React, { useEffect, useRef, useMemo } from 'react';
import { performanceMonitor } from '../../utils/performanceMonitor';
import {
  WebGLSpectrum,
  WebGLWaterfall,
  type RenderTransform,
} from '../../visualization';
import type { WATERFALL_COLORMAPS } from '../../constants';
import type { VisualizationWorkerManager } from '../../workers/VisualizationWorkerManager';

interface PrimaryVisualizationProps {
  fftData: Float32Array;
  fftSize: number;
  sampleRate: number;
  centerFrequency: number;
  mode: 'fft' | 'waterfall' | 'spectrogram';
  colorMap?: keyof typeof WATERFALL_COLORMAPS;
  dbMin?: number;
  dbMax?: number;
  onTune: (frequency: number) => void;
}

const PrimaryVisualization: React.FC<PrimaryVisualizationProps> = ({
  fftData,
  fftSize,
  mode,
  colorMap = 'viridis',
  dbMin = -100,
  dbMax = 0,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumRendererRef = useRef<WebGLSpectrum | null>(null);
  const waterfallRendererRef = useRef<WebGLWaterfall | null>(null);
  const workerManagerRef = useRef<VisualizationWorkerManager | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Keep latest props in refs to avoid restarting RAF loop on every change
  const fftDataRef = useRef<Float32Array>(fftData);
  const modeRef = useRef<typeof mode>(mode);
  const dbMinRef = useRef<number>(dbMin);
  const dbMaxRef = useRef<number>(dbMax);
  const colorMapRef = useRef<keyof typeof WATERFALL_COLORMAPS>(colorMap);
  const fftSizeRef = useRef<number>(fftSize);

  useEffect((): void => {
    fftDataRef.current = fftData;
  }, [fftData]);
  useEffect((): void => {
    modeRef.current = mode;
  }, [mode]);
  useEffect((): void => {
    dbMinRef.current = dbMin;
  }, [dbMin]);
  useEffect((): void => {
    dbMaxRef.current = dbMax;
  }, [dbMax]);
  useEffect((): void => {
    colorMapRef.current = colorMap;
  }, [colorMap]);
  useEffect((): void => {
    fftSizeRef.current = fftSize;
  }, [fftSize]);

  const transform = useMemo(
    (): RenderTransform => ({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    }),
    [],
  );

  useEffect((): (() => void) => {
    if (spectrumCanvasRef.current) {
      const renderer = new WebGLSpectrum();
      void renderer.initialize(spectrumCanvasRef.current).then((success) => {
        if (success) {
          spectrumRendererRef.current = renderer;
        }
      });
    }
    return (): void => {
      spectrumRendererRef.current?.cleanup();
    };
  }, []);

  useEffect((): (() => void) => {
    const canvas = waterfallCanvasRef.current;
    if (!canvas) {
      return (): void => {
        // No cleanup needed
      };
    }

    // For now, use main-thread WebGL waterfall directly
    // Worker-based rendering has issues with canvas transfer in some environments
    const renderer = new WebGLWaterfall();
    void renderer.initialize(canvas).then((success) => {
      if (success) {
        waterfallRendererRef.current = renderer;
      }
    });

    return (): void => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      workerManagerRef.current?.cleanup();
      workerManagerRef.current = null;
      waterfallRendererRef.current?.cleanup();
      waterfallRendererRef.current = null;
    };
  }, []);

  useEffect((): (() => void) => {
    const render = (): void => {
      // Spectrum: render on main thread when available
      const spectrumReady = Boolean(spectrumRendererRef.current);
      const waterfallReady =
        Boolean(workerManagerRef.current?.isReady()) ||
        Boolean(waterfallRendererRef.current);
      if (!spectrumReady || !waterfallReady) {
        rafIdRef.current = requestAnimationFrame(render);
        return;
      }

      const m = modeRef.current;
      const data = fftDataRef.current;
      const size = fftSizeRef.current;
      const min = dbMinRef.current;
      const max = dbMaxRef.current;
      const cmap = colorMapRef.current;

      performanceMonitor.mark('render-start');

      if (m === 'fft' || m === 'spectrogram') {
        spectrumRendererRef.current?.render({
          magnitudes: data,
          freqMin: 0,
          freqMax: size,
          transform,
        });
      }

      if (m === 'waterfall' || m === 'spectrogram') {
        const range = Math.max(1e-6, max - min);
        // Prefer worker path; fallback to WebGL renderer if worker not ready
        if (workerManagerRef.current?.isReady()) {
          try {
            workerManagerRef.current.render({
              fftData: [data],
              transform,
            });
          } catch {
            // If render throws (e.g., not initialized), fall back
            waterfallRendererRef.current?.render({
              frames: [data],
              gain: 1 / range,
              offset: -min / range,
              colormapName: cmap,
            });
          }
        } else if (waterfallRendererRef.current) {
          waterfallRendererRef.current.render({
            frames: [data],
            gain: 1 / range,
            offset: -min / range,
            colormapName: cmap,
          });
        }
      }

      performanceMonitor.measure('rendering', 'render-start');
      rafIdRef.current = requestAnimationFrame(render);
    };

    rafIdRef.current = requestAnimationFrame(render);
    return (): void => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [transform]);

  return (
    <div>
      <canvas
        ref={spectrumCanvasRef}
        width="900"
        height="320"
        style={{
          display: mode === 'fft' || mode === 'spectrogram' ? 'block' : 'none',
        }}
        aria-label="Spectrum Analyzer"
      />
      <canvas
        ref={waterfallCanvasRef}
        width="900"
        height="320"
        style={{
          display:
            mode === 'waterfall' || mode === 'spectrogram' ? 'block' : 'none',
          marginTop: '8px',
        }}
        aria-label="Waterfall Display"
      />
    </div>
  );
};

export default PrimaryVisualization;
