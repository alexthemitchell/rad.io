import React, { useEffect, useRef, useMemo, useState } from "react";
import { performanceMonitor } from "../../utils/performanceMonitor";
import { WebGLSpectrum, WebGLWaterfall } from "../../visualization";
import { WATERFALL_MARGIN } from "../../visualization/grid";
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
  /** Whether to show frequency gridlines independent from annotations */
  showGridlines?: boolean;
  showGridLabels?: boolean;
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
  showGridlines = true,
  showGridLabels = true,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationsCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallAnnotationsCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumRendererRef = useRef<WebGLSpectrum | null>(null);
  const waterfallRendererRef = useRef<WebGLWaterfall | null>(null);
  const annotationsRendererRef = useRef<SpectrumAnnotations | null>(null);
  const waterfallAnnotationsRendererRef = useRef<SpectrumAnnotations | null>(
    null,
  );
  const workerManagerRef = useRef<VisualizationWorkerManager | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Reusable single-element array to avoid allocating [data] on every frame
  const waterfallFrameArrayRef = useRef<Float32Array[]>([new Float32Array(0)]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas dimensions state
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 900,
    height: 320,
  });

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
  const showGridlinesRef = useRef<boolean>(showGridlines);
  const showGridLabelsRef = useRef<boolean>(showGridLabels);
  const lastAnnotationRenderTime = useRef<number>(0);
  // Slightly slower annotation cadence to reduce flicker; spectrum vs waterfall staggered
  const ANNOTATION_RENDER_INTERVAL_MS = 150; // 6-7 FPS for labels is sufficient
  const lastWaterfallAnnotationRenderTime = useRef<number>(0);
  const WATERFALL_ANNOTATION_RENDER_INTERVAL_MS = 200; // Waterfall overlays update a bit less frequently

  // Performance optimization: track last rendered data to skip unnecessary renders
  const lastRenderedDataHash = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);
  const MIN_FRAME_INTERVAL_MS = 16; // ~60 FPS cap
  const needsRenderRef = useRef<boolean>(false);

  // Memoize signals to only update when signal frequencies or active states change significantly
  const memoizedSignals = useMemo(() => {
    // Create a stable representation based only on frequency, active state, and power (rounded)
    return signals.map((s) => ({
      ...s,
      power: Math.round(s.power * 2) / 2, // Round to nearest 0.5 dB
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    signals.length,
    // Only recompute if the list of active signal frequencies changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    signals.map((s) => `${s.frequency}_${s.isActive}`).join(","),
  ]);

  // Compute a simple hash of FFT data for change detection
  // Uses sum of first, middle, and last 10 values to avoid full array scan
  const computeDataHash = (data: Float32Array): number => {
    const len = data.length;
    if (len === 0) return 0;

    let sum = 0;
    // Sample first 10
    const end1 = Math.min(10, len);
    for (let i = 0; i < end1; i++) {
      sum += data[i] ?? 0;
    }
    // Sample middle 10
    const mid = Math.floor(len / 2);
    const start2 = Math.max(0, mid - 5);
    const end2 = Math.min(len, mid + 5);
    for (let i = start2; i < end2; i++) {
      sum += data[i] ?? 0;
    }
    // Sample last 10
    const start3 = Math.max(0, len - 10);
    for (let i = start3; i < len; i++) {
      sum += data[i] ?? 0;
    }
    return sum;
  };

  // Keep refs in sync and flag for render when data changes
  useEffect((): void => {
    fftDataRef.current = fftData;
    const newHash = computeDataHash(fftData);
    if (newHash !== lastRenderedDataHash.current) {
      needsRenderRef.current = true;
    }
  }, [fftData]);
  useEffect((): void => {
    modeRef.current = mode;
    needsRenderRef.current = true;
  }, [mode]);
  useEffect((): void => {
    dbMinRef.current = dbMin;
    needsRenderRef.current = true;
  }, [dbMin]);
  useEffect((): void => {
    dbMaxRef.current = dbMax;
    needsRenderRef.current = true;
  }, [dbMax]);
  useEffect((): void => {
    colorMapRef.current = colorMap;
    needsRenderRef.current = true;
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
    signalsRef.current = memoizedSignals;
  }, [memoizedSignals]);
  useEffect((): void => {
    showAnnotationsRef.current = showAnnotations;
  }, [showAnnotations]);
  useEffect((): void => {
    showGridlinesRef.current = showGridlines;
  }, [showGridlines]);
  useEffect((): void => {
    showGridLabelsRef.current = showGridLabels;
  }, [showGridLabels]);

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

  // Initialize waterfall annotations renderer
  useEffect(() => {
    if (waterfallAnnotationsCanvasRef.current) {
      const renderer = new SpectrumAnnotations();
      const success = renderer.initialize(
        waterfallAnnotationsCanvasRef.current,
      );
      if (success) {
        waterfallAnnotationsRendererRef.current = renderer;
      }
    }

    return (): void => {
      waterfallAnnotationsRendererRef.current?.cleanup();
      waterfallAnnotationsRendererRef.current = null;
    };
  }, []);

  // Setup ResizeObserver to handle responsive canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateCanvasSize = (): void => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      // Maintain 2.8125:1 aspect ratio (900:320) or use a minimum height
      const height = Math.max(320, Math.floor(width / 2.8125));

      setCanvasDimensions({ width, height });
    };

    // Initial size
    updateCanvasSize();

    // Watch for resize events
    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });

    observer.observe(container);
    resizeObserverRef.current = observer;
    // Fallback for environments where ResizeObserver may not fire reliably
    // (e.g., certain headless or test environments). Also ensures immediate
    // layout update when the window is resized via programmatic calls.
    const onWindowResize = (): void => updateCanvasSize();
    window.addEventListener("resize", onWindowResize);

    return (): void => {
      observer.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  // Update canvas internal dimensions when size changes
  useEffect(() => {
    const { width, height } = canvasDimensions;

    // Update spectrum canvas
    if (spectrumCanvasRef.current) {
      spectrumCanvasRef.current.width = width;
      spectrumCanvasRef.current.height = height;
      spectrumCanvasRef.current.style.width = `${width}px`;
      spectrumCanvasRef.current.style.height = `${height}px`;
      // Do not reinitialize; WebGLSpectrum adapts viewport per frame
    }

    // Update waterfall canvas
    if (waterfallCanvasRef.current) {
      waterfallCanvasRef.current.width = width;
      waterfallCanvasRef.current.height = height;
      waterfallCanvasRef.current.style.width = `${width}px`;
      waterfallCanvasRef.current.style.height = `${height}px`;
      // Preserve existing WebGLWaterfall texture history; no reinit
      // If using worker renderer in future, propagate resize:
      if (workerManagerRef.current?.isReady()) {
        const dpr = window.devicePixelRatio || 1;
        workerManagerRef.current.resize({ width, height, dpr });
      }
    }

    // Update annotations canvas
    if (annotationsCanvasRef.current) {
      annotationsCanvasRef.current.width = width;
      annotationsCanvasRef.current.height = height;
      annotationsCanvasRef.current.style.width = `${width}px`;
      annotationsCanvasRef.current.style.height = `${height}px`;
      // Keep existing annotations renderer; it draws relative to canvas size
    }

    // Update waterfall annotations canvas
    if (waterfallAnnotationsCanvasRef.current) {
      waterfallAnnotationsCanvasRef.current.width = width;
      waterfallAnnotationsCanvasRef.current.height = height;
      waterfallAnnotationsCanvasRef.current.style.width = `${width}px`;
      waterfallAnnotationsCanvasRef.current.style.height = `${height}px`;
    }
  }, [canvasDimensions]);

  // Main render loop
  useEffect((): (() => void) => {
    const render = (): void => {
      // Check if we need to render (data changed or settings changed)
      const now = performance.now();
      const timeSinceLastRender = now - lastRenderTime.current;

      // Skip render if:
      // 1. No data/settings changes have occurred
      // 2. Not enough time has passed since last render (frame skip for performance)
      if (
        !needsRenderRef.current &&
        timeSinceLastRender < MIN_FRAME_INTERVAL_MS
      ) {
        rafIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Spectrum: render on main thread when available
      const spectrumReady = Boolean(spectrumRendererRef.current);
      const waterfallReady =
        Boolean(workerManagerRef.current?.isReady()) ||
        Boolean(waterfallRendererRef.current);
      // Only bail out if neither renderer is ready. Previously we required both
      // to be ready which prevented rendering of spectrum-only configurations
      // and caused canvas visual style widths to remain stale on resize.
      if (!spectrumReady && !waterfallReady) {
        rafIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Clear the render flag since we're about to render
      needsRenderRef.current = false;
      lastRenderTime.current = now;

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
        // Ensure gridlines are rendered even when annotations are hidden
        if (
          showGridlinesRef.current &&
          annotationsRendererRef.current?.isReady()
        ) {
          annotationsRendererRef.current.renderGridlines(
            canvasDimensions.width,
            canvasDimensions.height,
            centerFrequencyRef.current - sampleRateRef.current / 2,
            centerFrequencyRef.current + sampleRateRef.current / 2,
            centerFrequencyRef.current,
            sampleRateRef.current,
            {
              drawLabels: showGridLabelsRef.current,
            },
          );
        }

        // Render annotations on spectrum (throttled to reduce visual jumpiness)
        const now = Date.now();
        const timeSinceLastRender = now - lastAnnotationRenderTime.current;
        if (
          showAnnotationsRef.current &&
          annotationsRendererRef.current?.isReady() &&
          timeSinceLastRender >= ANNOTATION_RENDER_INTERVAL_MS
        ) {
          annotationsRendererRef.current.render(
            signalsRef.current,
            sampleRateRef.current,
            centerFrequencyRef.current,
            {
              enabled: true,
              showLabels: true,
              showBandwidth: true,
              fontSize: 14, // Increased for better readability
            },
          );
          lastAnnotationRenderTime.current = now;
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

        // Render annotations over waterfall (opaque horizontal bands) using dedicated overlay canvas
        const now = Date.now();
        const sinceLast = now - lastWaterfallAnnotationRenderTime.current;
        if (
          showAnnotationsRef.current &&
          waterfallAnnotationsRendererRef.current?.isReady() &&
          sinceLast >= WATERFALL_ANNOTATION_RENDER_INTERVAL_MS
        ) {
          waterfallAnnotationsRendererRef.current.renderWaterfall(
            signalsRef.current,
            sampleRateRef.current,
            centerFrequencyRef.current,
            {
              enabled: true,
              showLabels: false,
              showBandwidth: true,
              fontSize: 14,
            },
            transform,
          );
          lastWaterfallAnnotationRenderTime.current = now;
        } else if (
          !showAnnotationsRef.current &&
          waterfallAnnotationsCanvasRef.current
        ) {
          // Clear stale overlay when annotations are hidden
          const ctx = waterfallAnnotationsCanvasRef.current.getContext("2d");
          if (ctx) {
            ctx.clearRect(
              0,
              0,
              waterfallAnnotationsCanvasRef.current.width,
              waterfallAnnotationsCanvasRef.current.height,
            );
          }
        }
        // For waterfall, we still want gridlines visible if the caller enables them
        if (
          showGridlinesRef.current &&
          waterfallAnnotationsRendererRef.current?.isReady()
        ) {
          waterfallAnnotationsRendererRef.current.renderGridlines(
            canvasDimensions.width,
            canvasDimensions.height,
            centerFrequencyRef.current - sampleRateRef.current / 2,
            centerFrequencyRef.current + sampleRateRef.current / 2,
            centerFrequencyRef.current,
            sampleRateRef.current,
            {
              margin: WATERFALL_MARGIN,
              drawLabels: showGridLabelsRef.current,
              lineColor: "rgba(255,255,255,0.10)",
            },
          );
        }
      }

      // Update hash to reflect what we just rendered
      lastRenderedDataHash.current = computeDataHash(data);

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
  }, [transform, canvasDimensions.width, canvasDimensions.height]);

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
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <canvas
        ref={spectrumCanvasRef}
        style={{
          display: mode === "fft" || mode === "spectrogram" ? "block" : "none",
          width: "100%",
          height: `${canvasDimensions.height}px`,
        }}
        role="img"
        aria-label="Spectrum Analyzer"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      <canvas
        ref={annotationsCanvasRef}
        style={{
          display:
            (showAnnotations || showGridlines) &&
            (mode === "fft" || mode === "spectrogram")
              ? "block"
              : "none",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: `${canvasDimensions.height}px`,
          pointerEvents: "none",
        }}
        role="img"
        aria-label="Signal Annotations"
      />
      <canvas
        ref={waterfallCanvasRef}
        style={{
          display:
            mode === "waterfall" || mode === "spectrogram" ? "block" : "none",
          marginTop: mode === "spectrogram" ? "8px" : "0",
          width: "100%",
          height: `${canvasDimensions.height}px`,
        }}
        role="img"
        aria-label="Waterfall Display"
        onClick={handleCanvasClick}
      />
      <canvas
        ref={waterfallAnnotationsCanvasRef}
        style={{
          display:
            (showAnnotations || showGridlines) &&
            (mode === "waterfall" || mode === "spectrogram")
              ? "block"
              : "none",
          position: "absolute",
          top:
            mode === "spectrogram" ? `${canvasDimensions.height + 8}px` : "0", // stack below spectrum when spectrogram
          left: 0,
          width: "100%",
          height: `${canvasDimensions.height}px`,
          pointerEvents: "none",
        }}
        role="img"
        aria-label="Waterfall Signal Annotations"
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
