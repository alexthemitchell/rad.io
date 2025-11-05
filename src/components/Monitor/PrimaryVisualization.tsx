import React, { useEffect, useRef, useMemo, useState } from "react";
import { performanceMonitor } from "../../utils/performanceMonitor";
import { WebGLSpectrum, WebGLWaterfall } from "../../visualization";
import { SpectrumAnnotations } from "../../visualization/renderers/SpectrumAnnotations";
import { SignalTooltip } from "../SignalTooltip";
import type { WATERFALL_COLORMAPS } from "../../constants";
import type { DetectedSignal } from "../../hooks/useSignalDetection";
import type { RenderTransform } from "../../visualization";
import type { VisualizationWorkerManager } from "../../workers/VisualizationWorkerManager";

interface PrimaryVisualizationProps {
  fftData: Float32Array;
  fftSize: number;
  sampleRate: number;
  centerFrequency: number;
  mode: "fft" | "waterfall" | "spectrogram";
  colorMap?: keyof typeof WATERFALL_COLORMAPS;
  dbMin?: number;
  dbMax?: number;
  onTune: (frequency: number) => void;
  /** Detected signals to annotate */
  signals?: DetectedSignal[];
  /** Whether to show signal annotations */
  showAnnotations?: boolean;
}

const PrimaryVisualization: React.FC<PrimaryVisualizationProps> = ({
  fftData,
  fftSize,
  sampleRate,
  centerFrequency,
  mode,
  colorMap = "viridis",
  dbMin,
  dbMax,
  onTune,
  signals = [],
  showAnnotations = true,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationsCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumRendererRef = useRef<WebGLSpectrum | null>(null);
  const waterfallRendererRef = useRef<WebGLWaterfall | null>(null);
  const annotationsRendererRef = useRef<SpectrumAnnotations | null>(null);
  const workerManagerRef = useRef<VisualizationWorkerManager | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Reusable single-element array to avoid allocating [data] on every frame
  const waterfallFrameArrayRef = useRef<Float32Array[]>([new Float32Array(0)]);

  // Tooltip state
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredSignal, setHoveredSignal] = useState<DetectedSignal | null>(
    null,
  );

  // Throttle state for mouse move handler
  const lastMouseMoveTime = useRef<number>(0);
  const MOUSE_MOVE_THROTTLE_MS = 50; // 20 updates per second (20 Hz) for mouse move updates

  // Keep latest props in refs to avoid restarting RAF loop on every change
  // Note: fftData is a stable reference whose contents are updated in-place by useDsp for performance.
  // We intentionally read directly from the prop inside the RAF loop to always use the freshest data
  // without depending on React state/reference changes.
  const fftDataRef = useRef<Float32Array>(fftData);
  const modeRef = useRef<typeof mode>(mode);
  const dbMinRef = useRef<number | undefined>(dbMin);
  const dbMaxRef = useRef<number | undefined>(dbMax);
  const colorMapRef = useRef<keyof typeof WATERFALL_COLORMAPS>(colorMap);
  const fftSizeRef = useRef<number>(fftSize);
  const sampleRateRef = useRef<number>(sampleRate);
  const centerFrequencyRef = useRef<number>(centerFrequency);
  const signalsRef = useRef<DetectedSignal[]>(signals);
  const showAnnotationsRef = useRef<boolean>(showAnnotations);

  // Keep refs in sync
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
  useEffect((): void => {
    sampleRateRef.current = sampleRate;
  }, [sampleRate]);
  useEffect((): void => {
    centerFrequencyRef.current = centerFrequency;
  }, [centerFrequency]);
  useEffect((): void => {
    signalsRef.current = signals;
  }, [signals]);
  useEffect((): void => {
    showAnnotationsRef.current = showAnnotations;
  }, [showAnnotations]);

  const transform = useMemo(
    (): RenderTransform => ({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    }),
    [],
  );

  // Initialize spectrum renderer
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

  // Initialize waterfall renderer
  useEffect(() => {
    const canvas = waterfallCanvasRef.current;
    if (!canvas) {
      return;
    }

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

  // Initialize annotations renderer
  useEffect(() => {
    if (annotationsCanvasRef.current) {
      const renderer = new SpectrumAnnotations();
      const success = renderer.initialize(annotationsCanvasRef.current);
      if (success) {
        annotationsRendererRef.current = renderer;
      }
    }

    return (): void => {
      annotationsRendererRef.current?.cleanup();
      annotationsRendererRef.current = null;
    };
  }, []);

  // Main render loop
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
      // Determine normalization range: manual dB floor/ceil if provided, otherwise auto from current row
      let min = dbMinRef.current;
      let max = dbMaxRef.current;
      if (min === undefined || max === undefined) {
        // Compute min/max from current data
        let rowMin = Infinity;
        let rowMax = -Infinity;
        for (let i = 0; i < size; i++) {
          const v = data[i];
          if (v === undefined || !isFinite(v)) continue;
          if (v < rowMin) rowMin = v;
          if (v > rowMax) rowMax = v;
        }
        min ??= rowMin;
        max ??= rowMax;
      }
      // Fallback if no finite values
      if (!isFinite(min) || !isFinite(max)) {
        min = 0;
        max = 1;
      }
      const cmap = colorMapRef.current;

      performanceMonitor.mark("render-start");

      // Render spectrum
      if (m === "fft" || m === "spectrogram") {
        spectrumRendererRef.current?.render({
          magnitudes: data,
          freqMin: 0,
          freqMax: size,
          transform,
        });

        // Render annotations on spectrum
        if (
          showAnnotationsRef.current &&
          annotationsRendererRef.current?.isReady()
        ) {
          annotationsRendererRef.current.render(
            signalsRef.current,
            sampleRateRef.current,
            centerFrequencyRef.current,
            {
              enabled: true,
              showLabels: true,
              showBandwidth: true,
              fontSize: 12,
            },
          );
        }
      }

      // Render waterfall
      if (m === "waterfall" || m === "spectrogram") {
        const range = Math.max(1e-6, max - min);
        if (workerManagerRef.current?.isReady()) {
          try {
            // Reuse array ref to avoid allocation
            waterfallFrameArrayRef.current[0] = data;
            workerManagerRef.current.render({
              fftData: waterfallFrameArrayRef.current,
              transform,
            });
          } catch {
            waterfallRendererRef.current?.render({
              frames: waterfallFrameArrayRef.current,
              gain: 1 / range,
              offset: -min / range,
              colormapName: cmap,
            });
          }
        } else if (waterfallRendererRef.current) {
          waterfallFrameArrayRef.current[0] = data;
          waterfallRendererRef.current.render({
            frames: waterfallFrameArrayRef.current,
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

  // Handle mouse move for tooltip (throttled)
  const handleMouseMove = (evt: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!annotationsRendererRef.current || !showAnnotations) {
      setTooltipVisible(false);
      return;
    }

    // Throttle mouse move updates to reduce computation
    const now = Date.now();
    if (now - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE_MS) {
      return;
    }
    lastMouseMoveTime.current = now;

    const canvas = evt.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    // Find signal at mouse position
    const signal = annotationsRendererRef.current.findSignalAt(
      x,
      y,
      signals,
      sampleRate,
      centerFrequency,
    );

    if (signal) {
      setHoveredSignal(signal);
      setTooltipPosition({ x: evt.clientX, y: evt.clientY });
      setTooltipVisible(true);
      annotationsRendererRef.current.setHoveredSignal(signal);
    } else {
      setHoveredSignal(null);
      setTooltipVisible(false);
      annotationsRendererRef.current.setHoveredSignal(null);
    }
  };

  // Handle mouse leave
  const handleMouseLeave = (): void => {
    setTooltipVisible(false);
    setHoveredSignal(null);
    annotationsRendererRef.current?.setHoveredSignal(null);
  };

  // Handle canvas click
  const handleCanvasClick = (
    evt: React.MouseEvent<HTMLCanvasElement>,
  ): void => {
    // If clicking on a signal, tune to it
    if (hoveredSignal) {
      onTune(hoveredSignal.frequency);
      return;
    }

    // Otherwise, tune to frequency at click position
    if (!sampleRate || !centerFrequency) {
      return;
    }
    const canvas = evt.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const frac = Math.min(1, Math.max(0, x / rect.width));
    const span = sampleRate;
    const tuned = centerFrequency - span / 2 + frac * span;
    onTune(tuned);
  };

  return (
    <div style={{ position: "relative" }}>
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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {showAnnotations && (mode === "fft" || mode === "spectrogram") && (
        <canvas
          ref={annotationsCanvasRef}
          width="900"
          height="320"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
          role="img"
          aria-label="Signal Annotations"
        />
      )}
      <canvas
        ref={waterfallCanvasRef}
        width="900"
        height="320"
        style={{
          display:
            mode === "waterfall" || mode === "spectrogram" ? "block" : "none",
          marginTop: mode === "spectrogram" ? "8px" : "0",
        }}
        role="img"
        aria-label="Waterfall Display"
        onClick={handleCanvasClick}
      />
      <SignalTooltip
        signal={hoveredSignal}
        x={tooltipPosition.x}
        y={tooltipPosition.y}
        visible={tooltipVisible}
      />
    </div>
  );
};

export default PrimaryVisualization;
