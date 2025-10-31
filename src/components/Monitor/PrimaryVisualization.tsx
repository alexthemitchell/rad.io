import React, { useEffect, useRef, useMemo } from "react";
import { performanceMonitor } from "../../utils/performanceMonitor";
import { WebGLSpectrum, WebGLWaterfall } from "../../visualization";
import type { WATERFALL_COLORMAPS } from "../../constants";
import type { RenderTransform } from "../../visualization";
import type { VisualizationWorkerManager } from "../../workers/VisualizationWorkerManager";

interface PrimaryVisualizationProps {
  fftData: Float32Array;
  fftSize: number;
  // TODO(rad.io): sampleRate not yet used in this refactored version, will be needed for frequency axis labels
  sampleRate: number;
  // TODO(rad.io): centerFrequency not yet used in this refactored version, will be needed for frequency axis labels
  centerFrequency: number;
  mode: "fft" | "waterfall" | "spectrogram";
  colorMap?: keyof typeof WATERFALL_COLORMAPS;
  dbMin?: number;
  dbMax?: number;
  // TODO(rad.io): onTune callback not yet implemented in this refactored version, will enable click-to-tune
  onTune: (frequency: number) => void;
}

const PrimaryVisualization: React.FC<PrimaryVisualizationProps> = ({
  fftData,
  fftSize,
  sampleRate: _sampleRate,
  centerFrequency: _centerFrequency,
  mode,
  colorMap = "viridis",
  dbMin = -100,
  dbMax = 0,
  onTune: _onTune,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumRendererRef = useRef<WebGLSpectrum | null>(null);
  const waterfallRendererRef = useRef<WebGLWaterfall | null>(null);
  const workerManagerRef = useRef<VisualizationWorkerManager | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Keep latest props in refs to avoid restarting RAF loop on every change
  // Note: fftData is a stable reference whose contents are updated in-place by useDsp for performance.
  // We intentionally read directly from the prop inside the RAF loop to always use the freshest data
  // without depending on React state/reference changes.
  const fftDataRef = useRef<Float32Array>(fftData);
  const modeRef = useRef<typeof mode>(mode);
  const dbMinRef = useRef<number>(dbMin);
  const dbMaxRef = useRef<number>(dbMax);
  const colorMapRef = useRef<keyof typeof WATERFALL_COLORMAPS>(colorMap);
  const fftSizeRef = useRef<number>(fftSize);

  // Keep ref in sync on initial mount; subsequent in-place mutations do not require updates here.
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

  useEffect(() => {
    const canvas = waterfallCanvasRef.current;
    if (!canvas) {
      return;
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
      // Read directly from prop: the underlying Float32Array is mutated in-place by the DSP pipeline
      // so this always reflects the latest magnitudes without reallocations.
      // Use ref to avoid adding fftData as an effect dependency; the underlying buffer is mutated in place
      const data = fftDataRef.current;
      const size = fftSizeRef.current;
      const min = dbMinRef.current;
      const max = dbMaxRef.current;
      const cmap = colorMapRef.current;

      performanceMonitor.mark("render-start");

      if (m === "fft" || m === "spectrogram") {
        spectrumRendererRef.current?.render({
          magnitudes: data,
          freqMin: 0,
          freqMax: size,
          transform,
        });
      }

      if (m === "waterfall" || m === "spectrogram") {
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

      performanceMonitor.measure("rendering", "render-start");
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

  const handleCanvasClick = (evt: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!_sampleRate || !_centerFrequency) {
      return;
    }
    const canvas = evt.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const frac = Math.min(1, Math.max(0, x / rect.width));
    const span = _sampleRate; // Hz across the view
    const tuned = _centerFrequency - span / 2 + frac * span;
    _onTune(tuned);
  };

  return (
    <div>
      <canvas
        ref={spectrumCanvasRef}
        width="900"
        height="320"
        style={{
          display: mode === "fft" || mode === "spectrogram" ? "block" : "none",
        }}
        role="img"
        aria-label="Spectrum Analyzer"
        onClick={handleCanvasClick}
      />
      <canvas
        ref={waterfallCanvasRef}
        width="900"
        height="320"
        style={{
          display:
            mode === "waterfall" || mode === "spectrogram" ? "block" : "none",
          marginTop: "8px",
        }}
        role="img"
        aria-label="Waterfall Display"
        onClick={handleCanvasClick}
      />
    </div>
  );
};

export default PrimaryVisualization;
