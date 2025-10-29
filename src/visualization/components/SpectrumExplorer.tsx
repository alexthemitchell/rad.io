import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MarkerTable from "../../components/MarkerTable";
import { useRenderer } from "../../hooks/useRenderer";
import { useVisualizationInteraction } from "../../hooks/useVisualizationInteraction";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import {
  calculateSpectrogramRow,
  type Sample as DSPSample,
} from "../../utils/dsp";
import { performanceMonitor } from "../../utils/performanceMonitor";
import { WebGLSpectrum } from "../renderers/WebGLSpectrum";
import { WebGLWaterfall } from "../renderers/WebGLWaterfall";

type WindowType = "hann" | "blackman" | "rect";

export type SpectrumExplorerProps = {
  samples: DSPSample[];
  sampleRate: number; // Hz
  centerFrequency: number; // Hz
  fftSize: number;
  /** Number of frames to display in the waterfall */
  frames?: number; // default 48
  /** Overlap ratio between 0 and 0.9 (e.g., 0.5 = 50%) */
  overlap?: number;
  /** Callback when user double-clicks to tune to a frequency (Hz) */
  onTune?: (frequencyHz: number) => void;
  /** When false, disables waterfall rendering and related computations for performance */
  showWaterfall?: boolean;
  /** Optional list of detected signals to highlight (e.g., from scanner) */
  signals?: Array<{ freqHz: number; label?: string; strength?: number }>;
};

// Utilities: window functions
function computeWindowCoeffs(n: number, type: WindowType): Float32Array {
  const w = new Float32Array(n);
  if (type === "rect") {
    w.fill(1);
    return w;
  }
  if (type === "hann") {
    for (let i = 0; i < n; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    }
    return w;
  }
  // Blackman (classic)
  for (let i = 0; i < n; i++) {
    w[i] =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) +
      0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
  }
  return w;
}

// Map bin index (0..N-1, shifted) to absolute frequency in Hz
function binToFrequency(
  bin: number,
  size: number,
  fs: number,
  fCenter: number,
): number {
  const fRel = (bin - size / 2) * (fs / size);
  return fCenter + fRel;
}

// Simple peak search around an index
function findLocalPeak(
  mags: Float32Array,
  idx: number,
  window: number,
): number {
  let bestIdx = idx;
  let bestVal = mags[idx] ?? -Infinity;
  const start = Math.max(0, idx - window);
  const end = Math.min(mags.length - 1, idx + window);
  for (let i = start; i <= end; i++) {
    const v = mags[i] ?? -Infinity;
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return bestIdx;
}

type Marker = { id: string; freqHz: number; label?: string };

export default function SpectrumExplorer({
  samples,
  sampleRate,
  centerFrequency,
  fftSize,
  frames: _frames = 48,
  overlap = 0.5,
  onTune,
  showWaterfall = true,
  signals = [],
}: SpectrumExplorerProps): React.JSX.Element {
  // Controls
  const [windowType, setWindowType] = useState<WindowType>("hann");
  const [avgAlpha, setAvgAlpha] = useState<number>(0); // 0 = off, 0.1..0.9 typical
  const [peakHold, setPeakHold] = useState<boolean>(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showRBW, setShowRBW] = useState(true);

  // Hover/cursor readout state
  const [hoverInfo, setHoverInfo] = useState<{
    freqHz: number;
    powerDb: number;
    xCss: number;
  } | null>(null);

  // Waterfall display settings
  const [waterfallGain, _setWaterfallGain] = useState(1.0);
  const [waterfallOffset, _setWaterfallOffset] = useState(0.2);
  const [waterfallColormap, _setWaterfallColormap] =
    useState<"viridis" | "inferno">("viridis");

  // Refs for overlays
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef<number>(window.devicePixelRatio || 1);
  const avgRef = useRef<Float32Array | null>(null);
  const peakRef = useRef<Float32Array | null>(null);
  // Note: timestamp gating removed in favor of rAF-driven draw loop

  // Phase B: Resizable Spectrum/Waterfall split with persisted ratio
  const PERSIST_KEY = "viz.splitRatio";
  const WIDTH_KEY = "viz.containerWidth";
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(PERSIST_KEY);
      if (raw !== null) {
        const v = parseFloat(raw);
        if (Number.isFinite(v)) {
          return Math.min(0.9, Math.max(0.1, v));
        }
      }
    } catch {
      // ignore storage errors
    }
    return 0.45; // default: 45% spectrum, 55% waterfall
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(PERSIST_KEY, String(splitRatio));
    } catch {
      // ignore
    }
  }, [splitRatio]);
  const totalHeight = 580; // base height budget; container will stretch width
  const minPane = 120;
  const spectrumHeight = Math.max(
    minPane,
    Math.round(totalHeight * splitRatio),
  );
  const waterfallHeight = Math.max(minPane, totalHeight - spectrumHeight);
  const dragStateRef = useRef<{
    dragging: boolean;
    startY: number;
    startRatio: number;
  }>({
    dragging: false,
    startY: 0,
    startRatio: splitRatio,
  });
  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      const target = e.currentTarget;
      (target as HTMLElement).setPointerCapture(e.pointerId);
      dragStateRef.current = {
        dragging: true,
        startY: e.clientY,
        startRatio: splitRatio,
      };
    },
    [splitRatio],
  );
  const onDragMove = useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      if (!dragStateRef.current.dragging) {
        return;
      }
      const dy = e.clientY - dragStateRef.current.startY;
      const nextRatio = Math.min(
        0.9,
        Math.max(0.1, dragStateRef.current.startRatio + dy / totalHeight),
      );
      setSplitRatio(nextRatio);
    },
    [totalHeight],
  );
  const onDragEnd = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    const target = e.currentTarget;
    try {
      (target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragStateRef.current.dragging = false;
  }, []);
  const onHandleKey = useCallback(
    (e: React.KeyboardEvent<HTMLElement>): void => {
      const step = 0.02; // 2%
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSplitRatio((r) => Math.min(0.9, Math.max(0.1, r + step)));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSplitRatio((r) => Math.min(0.9, Math.max(0.1, r - step)));
      } else if (e.key.toLowerCase() === "g") {
        // Toggle grid
        e.preventDefault();
        setShowGrid((v) => !v);
      } else if (e.key.toLowerCase() === "r") {
        // Toggle RBW tag
        e.preventDefault();
        setShowRBW((v) => !v);
      } else if (e.key.toLowerCase() === "p") {
        // Toggle peak hold
        e.preventDefault();
        setPeakHold((v) => !v);
      }
    },
    [],
  );

  // Interaction handlers for the spectrum (pan/zoom)
  const {
    transform,
    handlers,
    canvasRef: interactionCanvasRef,
    resetTransform,
  } = useVisualizationInteraction({
    panSensitivity: 1,
    zoomSensitivity: 0.8,
    enableMultiTouch: false,
  });

  // Combined ref for spectrum canvas (interaction + local)
  const combinedOverlayRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      overlayCanvasRef.current = el;
      interactionCanvasRef(el);
    },
    [interactionCanvasRef],
  );

  // Compute latest magnitude frame from last fftSize samples with windowing
  const windowCoeffs = useMemo(
    () => computeWindowCoeffs(fftSize, windowType),
    [fftSize, windowType],
  );

  const latestMagnitudes = useMemo(() => {
    if (samples.length < fftSize) {
      return null;
    }
    const start = samples.length - fftSize;
    const windowed: DSPSample[] = Array.from({ length: fftSize }, (_, i) => {
      const s = samples[start + i];
      const w = windowCoeffs[i] ?? 1;
      return { I: (s?.I ?? 0) * w, Q: (s?.Q ?? 0) * w };
    });
    return calculateSpectrogramRow(windowed, fftSize);
  }, [samples, fftSize, windowCoeffs]);

  // Update average and peak hold
  useEffect(() => {
    if (!latestMagnitudes) {
      return;
    }
    if (avgAlpha > 0) {
      const a = avgAlpha;
      const inv = 1 - a;
      if (
        !avgRef.current ||
        avgRef.current.length !== latestMagnitudes.length
      ) {
        avgRef.current = new Float32Array(latestMagnitudes);
      } else {
        const prev = avgRef.current;
        const out = new Float32Array(latestMagnitudes.length);
        for (let i = 0; i < latestMagnitudes.length; i++) {
          const src = latestMagnitudes[i] ?? prev[i] ?? 0;
          out[i] = a * src + inv * (prev[i] ?? 0);
        }
        avgRef.current = out;
      }
    } else {
      avgRef.current = null;
    }

    if (peakHold) {
      if (
        !peakRef.current ||
        peakRef.current.length !== latestMagnitudes.length
      ) {
        peakRef.current = new Float32Array(latestMagnitudes);
      } else {
        const prev = peakRef.current;
        const out = new Float32Array(latestMagnitudes.length);
        for (let i = 0; i < latestMagnitudes.length; i++) {
          const v = latestMagnitudes[i] ?? prev[i] ?? -Infinity;
          out[i] = Math.max(prev[i] ?? v, v);
        }
        peakRef.current = out;
      }
    } else {
      peakRef.current = null;
    }
  }, [latestMagnitudes, avgAlpha, peakHold]);

  // Incremental waterfall feed: append only a small number of new frames per update
  // to avoid recomputing the entire window every render.
  const lastSpecIdxRef = useRef<number>(0);
  const [spectrogramFeed, setSpectrogramFeed] = useState<Float32Array[]>([]);
  useEffect(() => {
    if (!showWaterfall) {
      // When hidden, just reset index; avoid state churn
      lastSpecIdxRef.current = Math.max(0, samples.length - fftSize);
      return;
    }
    if (samples.length < fftSize) {
      // Not enough data yet; initialize index near head and wait
      lastSpecIdxRef.current = Math.max(0, samples.length - fftSize);
      return;
    }

    const hop = Math.max(
      1,
      Math.floor(fftSize * (1 - Math.max(0, Math.min(0.9, overlap)))),
    );

    // Initialize index near the tail on first run to avoid huge catch-up cost
    let idx = lastSpecIdxRef.current || Math.max(0, samples.length - fftSize);
    // Clamp if the samples array rolled over due to capping
    const maxStart = Math.max(0, samples.length - fftSize);
    if (idx > maxStart) {
      idx = maxStart;
    }
    const newRows: Float32Array[] = [];
    const maxFramesPerUpdate = 2; // careful balance between smoothness and CPU
    let produced = 0;

    while (idx + fftSize <= samples.length && produced < maxFramesPerUpdate) {
      // Window and compute a row
      const windowed: DSPSample[] = Array.from({ length: fftSize }, (_, i) => {
        const s = samples[idx + i];
        const w = windowCoeffs[i] ?? 1;
        return { I: (s?.I ?? 0) * w, Q: (s?.Q ?? 0) * w };
      });
      const row = calculateSpectrogramRow(windowed, fftSize);
      newRows.push(row);
      idx += hop;
      produced++;
    }

    lastSpecIdxRef.current = idx;
    if (newRows.length > 0) {
      setSpectrogramFeed(newRows);
    }
  }, [samples, fftSize, overlap, windowCoeffs, showWaterfall]);

  // Container width measurement for responsive Spectrogram
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const apply = (): void => {
      const w = Math.max(300, Math.floor(el.clientWidth));
      // setContainerWidth((prev) => (prev !== w ? w : prev)); // this state is not used, so we can remove it
      try {
        window.localStorage.setItem(WIDTH_KEY, String(w));
      } catch {
        /* ignore */
      }
    };
    apply();
    let ro: ResizeObserver | null = null;
    const hasWindow = typeof window !== "undefined";
    if (hasWindow && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => apply());
      ro.observe(el);
    } else if (hasWindow) {
      // Fallback: window resize
      window.addEventListener("resize", apply);
    }
    return (): void => {
      if (ro) {
        ro.disconnect();
      } else if (hasWindow) {
        window.removeEventListener("resize", apply);
      }
    };
  }, []);

  // --- WebGL Rendering ---
  const webglRendererRef = useRenderer(webglCanvasRef.current, WebGLSpectrum);
  const waterfallRendererRef = useRenderer(
    waterfallCanvasRef.current,
    WebGLWaterfall,
  );

  useEffect(() => {
    const renderer = webglRendererRef.current;
    const mags = latestMagnitudes;
    if (!renderer || !mags) {
      return;
    }

    performanceMonitor.mark("render-spectrum-webgl-start");
    const success = renderer.render({
      magnitudes: mags,
      freqMin: 0,
      freqMax: mags.length,
    });
    if (success) {
      renderTierManager.reportSuccess(RenderTier.WebGL2);
      performanceMonitor.measure(
        "render-spectrum-webgl",
        "render-spectrum-webgl-start",
      );
    }
  }, [latestMagnitudes, webglRendererRef]);

  useEffect(() => {
    const renderer = waterfallRendererRef.current;
    if (!renderer || spectrogramFeed.length === 0) {
      return;
    }
    performanceMonitor.mark("render-waterfall-webgl-start");
    renderer.render({
      spectrogram: spectrogramFeed,
      colormapName: waterfallColormap,
      gain: waterfallGain,
      offset: waterfallOffset,
    });
    performanceMonitor.measure(
      "render-waterfall-webgl",
      "render-waterfall-webgl-start",
    );
  }, [
    spectrogramFeed,
    waterfallRendererRef,
    waterfallColormap,
    waterfallGain,
    waterfallOffset,
  ]);

  // Draw overlays (grid, labels, markers) via requestAnimationFrame
  const lastCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const latestMagsRef = useRef<Float32Array | null>(null);
  useEffect(() => {
    latestMagsRef.current = latestMagnitudes;
  }, [latestMagnitudes]);

  useEffect(() => {
    let rafId = 0;

    const drawOverlays = (): void => {
      const canvas = overlayCanvasRef.current;
      const mags = latestMagsRef.current; // Use ref to get latest mags without re-triggering effect
      if (!canvas || !mags) {
        rafId = requestAnimationFrame(drawOverlays);
        return;
      }

      const dpr = dprRef.current;
      const width = canvas.clientWidth || 900;
      const height = canvas.clientHeight || 260;
      const sizeChanged =
        lastCanvasSizeRef.current.w !== width ||
        lastCanvasSizeRef.current.h !== height;
      if (sizeChanged) {
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        lastCanvasSizeRef.current = { w: width, h: height };
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafId = requestAnimationFrame(drawOverlays);
        return;
      }

      const markStart = "render-overlays-start";
      performanceMonitor.mark(markStart);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Chart area
      const margin = { top: 20, bottom: 22, left: 48, right: 16 };
      const cw = width - margin.left - margin.right;
      const ch = height - margin.top - margin.bottom;

      // Band plan overlays
      const bands: Array<{ lo: number; hi: number; label: string }> = [
        { lo: 88e6, hi: 108e6, label: "FM Broadcast" },
        { lo: 118e6, hi: 137e6, label: "Airband" },
        { lo: 144e6, hi: 148e6, label: "2m Amateur" },
        { lo: 420e6, hi: 450e6, label: "70cm Amateur" },
        { lo: 162.4e6, hi: 162.55e6, label: "NOAA WX" },
      ];
      const overlayStartHz = centerFrequency - sampleRate / 2;
      const overlayEndHz = centerFrequency + sampleRate / 2;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#4fc3f7";
      for (const b of bands) {
        const lo = Math.max(b.lo, overlayStartHz);
        const hi = Math.min(b.hi, overlayEndHz);
        if (hi <= lo) {
          continue;
        }
        const kLo =
          (lo - centerFrequency) / (sampleRate / fftSize) + fftSize / 2;
        const kHi =
          (hi - centerFrequency) / (sampleRate / fftSize) + fftSize / 2;
        const xLo =
          margin.left +
          Math.max(
            0,
            Math.min(
              cw,
              transform.scale * ((kLo / (mags.length - 1)) * cw) +
                transform.offsetX,
            ),
          );
        const xHi =
          margin.left +
          Math.max(
            0,
            Math.min(
              cw,
              transform.scale * ((kHi / (mags.length - 1)) * cw) +
                transform.offsetX,
            ),
          );
        const x = Math.min(xLo, xHi);
        const w = Math.abs(xHi - xLo);
        ctx.fillRect(x, margin.top, w, ch);
      }
      ctx.restore();

      // Compute dB range from magnitudes
      let dbMin = Infinity,
        dbMax = -Infinity;
      for (const v of mags) {
        if (Number.isFinite(v)) {
          if (v < dbMin) {
            dbMin = v;
          }
          if (v > dbMax) {
            dbMax = v;
          }
        }
      }
      if (!Number.isFinite(dbMin) || !Number.isFinite(dbMax) || dbMax <= dbMin) {
        dbMin = -120;
        dbMax = 0;
      }
      const effMin = dbMin + (dbMax - dbMin) * 0.05;
      const yForDb = (db: number): number =>
        margin.top + ch * (1 - (db - effMin) / Math.max(1e-9, dbMax - effMin));

      // Gridlines (dB)
      if (showGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        const dbStep = 10;
        for (
          let d = Math.ceil(effMin / dbStep) * dbStep;
          d <= dbMax;
          d += dbStep
        ) {
          const y = yForDb(d);
          ctx.beginPath();
          ctx.moveTo(margin.left, y);
          ctx.lineTo(margin.left + cw, y);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.fillText(`${d.toFixed(0)} dB`, 4, y - 2);
        }
      }

      // Frequency axis grid
      const spanHz: number = sampleRate;
      const rbw = sampleRate / fftSize;
      const niceStepHz = ((): number => {
        const steps = [1, 2, 5];
        const target = spanHz / 10;
        const pow = Math.pow(10, Math.floor(Math.log10(target)));
        for (const s of steps) {
          const v = s * pow;
          if (v >= target) {
            return v;
          }
        }
        return 10 * pow;
      })();

      const xForBin = (k: number): number => {
        const x0 = margin.left;
        const x1 = margin.left + cw;
        const nx = (k / (mags.length - 1)) * cw;
        const tx = transform.scale * nx + transform.offsetX;
        return Math.max(x0, Math.min(x1, x0 + tx));
      };

      // X-axis labels (frequency)
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "10px system-ui, sans-serif";
      const fStartHz = centerFrequency - sampleRate / 2;
      for (
        let f = Math.ceil(fStartHz / niceStepHz) * niceStepHz;
        f <= fStartHz + spanHz;
        f += niceStepHz
      ) {
        const k = (f - centerFrequency) / (sampleRate / fftSize) + fftSize / 2;
        const x = xForBin(k);
        ctx.fillRect(x, margin.top + ch, 1, 4);
        const label =
          f >= 1e6
            ? `${(f / 1e6).toFixed(3)} MHz`
            : `${Math.round(f / 1e3)} kHz`;
        ctx.fillText(label, x + 2, margin.top + ch + 12);
      }

      // RBW tag
      if (showRBW) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(`RBW ≈ ${(rbw / 1e3).toFixed(1)} kHz`, width - 120, 14);
      }

      // Markers
      ctx.strokeStyle = "rgba(255,80,80,0.9)";
      ctx.fillStyle = "rgba(255,80,80,0.9)";
      markers.forEach((m) => {
        const k =
          (m.freqHz - centerFrequency) / (sampleRate / fftSize) + fftSize / 2;
        const x = xForBin(k);
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + ch);
        ctx.stroke();
        const label = m.label ?? `${(m.freqHz / 1e6).toFixed(6)} MHz`;
        ctx.fillText(label, x + 4, margin.top + 14);
      });

      // Detected signals overlay
      if (signals.length > 0) {
        signals.forEach((s) => {
          const k =
            (s.freqHz - centerFrequency) / (sampleRate / fftSize) + fftSize / 2;
          const x = xForBin(k);
          ctx.save();
          ctx.shadowColor = "rgba(80,200,255,0.9)";
          ctx.shadowBlur = 12;
          ctx.strokeStyle = "rgba(80,200,255,0.9)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, margin.top);
          ctx.lineTo(x, margin.top + ch);
          ctx.stroke();
          ctx.restore();
          const strength = Math.max(0, Math.min(1, s.strength ?? 0.7));
          const radius = 3 + strength * 4;
          ctx.beginPath();
          ctx.fillStyle = "rgba(80,200,255,0.9)";
          ctx.arc(x, margin.top + 6, radius, 0, Math.PI * 2);
          ctx.fill();
          const slabel = s.label ?? `${(s.freqHz / 1e6).toFixed(3)} MHz`;
          ctx.fillStyle = "rgba(200,240,255,0.95)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.fillText(slabel, x + 6, margin.top + 10);
        });
      }

      // Crosshair and hover readout
      if (hoverInfo) {
        const xCSS = hoverInfo.xCss;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xCSS, margin.top);
        ctx.lineTo(xCSS, margin.top + ch);
        ctx.stroke();
        ctx.setLineDash([]);
        const label = `${(hoverInfo.freqHz / 1e6).toFixed(
          6,
        )} MHz  •  ${hoverInfo.powerDb.toFixed(1)} dB`;
        ctx.font = "11px system-ui, sans-serif";
        const tw = ctx.measureText(label).width + 10;
        const th = 18;
        const bx = Math.min(width - tw - 4, Math.max(4, xCSS + 8));
        const by = margin.top + 6;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(bx, by, tw, th);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(bx, by, tw, th);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(label, bx + 5, by + 12);
        ctx.restore();
      }

      performanceMonitor.measure("render-overlays", markStart);
      rafId = requestAnimationFrame(drawOverlays);
    };

    rafId = requestAnimationFrame(drawOverlays);
    return (): void => cancelAnimationFrame(rafId);
  }, [
    centerFrequency,
    fftSize,
    markers,
    signals,
    hoverInfo,
    showGrid,
    showRBW,
    sampleRate,
    transform,
  ]);

  // Click to add marker near local peak; double-click to tune
  const onSpectrumClick = useCallback(
    (ev: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = overlayCanvasRef.current;
      const mags = latestMagnitudes;
      if (!canvas || !mags) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const xCSS = ev.clientX - rect.left;
      const cw = (canvas.clientWidth || 900) - 48 - 16; // chart width (minus margins)
      const nx = Math.max(0, xCSS - 48); // subtract left margin
      // invert transform on X
      const xUnscaled =
        (nx - transform.offsetX) / Math.max(1e-6, transform.scale);
      const k = Math.max(
        0,
        Math.min(
          mags.length - 1,
          Math.round((xUnscaled / cw) * (mags.length - 1)),
        ),
      );
      const peakIdx = findLocalPeak(mags, k, 3);
      const freqHz = binToFrequency(
        peakIdx,
        mags.length,
        sampleRate,
        centerFrequency,
      );
      setMarkers((prev) =>
        prev.concat({ id: `${Date.now()}-${peakIdx}`, freqHz }),
      );
    },
    [latestMagnitudes, sampleRate, centerFrequency, transform],
  );

  const onSpectrumDoubleClick = useCallback(
    (ev: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = overlayCanvasRef.current;
      const mags = latestMagnitudes;
      if (!canvas || !mags) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const xCSS = ev.clientX - rect.left;
      const cw = (canvas.clientWidth || 900) - 48 - 16;
      const nx = Math.max(0, xCSS - 48);
      const xUnscaled =
        (nx - transform.offsetX) / Math.max(1e-6, transform.scale);
      const k = Math.max(
        0,
        Math.min(
          mags.length - 1,
          Math.round((xUnscaled / cw) * (mags.length - 1)),
        ),
      );
      const freqHz = binToFrequency(
        k,
        mags.length,
        sampleRate,
        centerFrequency,
      );
      onTune?.(freqHz);
    },
    [latestMagnitudes, sampleRate, centerFrequency, transform, onTune],
  );

  const onSpectrumMouseMove = useCallback(
    (ev: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = overlayCanvasRef.current;
      const mags = latestMagnitudes;
      if (!canvas || !mags) {
        setHoverInfo(null);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const xCSS = ev.clientX - rect.left;
      const cw = (canvas.clientWidth || 900) - 48 - 16;
      const nx = Math.max(0, xCSS - 48);
      const xUnscaled =
        (nx - transform.offsetX) / Math.max(1e-6, transform.scale);
      const k = Math.max(
        0,
        Math.min(
          mags.length - 1,
          Math.round((xUnscaled / cw) * (mags.length - 1)),
        ),
      );
      const freqHz = binToFrequency(
        k,
        mags.length,
        sampleRate,
        centerFrequency,
      );
      const powerDb = mags[k] ?? NaN;
      setHoverInfo({ freqHz, powerDb, xCss: xCSS });
    },
    [latestMagnitudes, sampleRate, centerFrequency, transform],
  );

  const onSpectrumMouseLeave = useCallback(() => setHoverInfo(null), []);

  // UI Controls row
  const Controls = (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <label>
        Window:
        <select
          value={windowType}
          onChange={(e) => setWindowType(e.target.value as WindowType)}
          style={{ marginLeft: 6 }}
        >
          <option value="hann">Hann</option>
          <option value="blackman">Blackman</option>
          <option value="rect">Rectangular</option>
        </select>
      </label>
      <label>
        Video Avg:
        <input
          type="range"
          min={0}
          max={0.95}
          step={0.05}
          value={avgAlpha}
          onChange={(e) => setAvgAlpha(parseFloat(e.target.value))}
          style={{ marginLeft: 6 }}
        />
        <span style={{ marginLeft: 6 }}>{Math.round(avgAlpha * 100)}%</span>
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={peakHold}
          onChange={(e) => setPeakHold(e.target.checked)}
        />
        Peak Hold
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(e) => setShowGrid(e.target.checked)}
        />
        Grid (G)
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={showRBW}
          onChange={(e) => setShowRBW(e.target.checked)}
        />
        RBW (R)
      </label>
      <button onClick={() => resetTransform()} aria-label="Reset spectrum view">
        Reset View
      </button>
      <button
        onClick={() => {
          const canvas = overlayCanvasRef.current;
          if (!canvas) {
            return;
          }
          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `spectrum_${Math.round(centerFrequency)}Hz.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }}
        aria-label="Save spectrum PNG"
      >
        Save PNG
      </button>
      {latestMagnitudes && (
        <span style={{ opacity: 0.8 }}>
          Bins: {latestMagnitudes.length} • RBW≈
          {(sampleRate / fftSize / 1e3).toFixed(1)} kHz
        </span>
      )}
    </div>
  );

  const WaterfallControls = showWaterfall ? (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        marginTop: 8,
      }}
    >
      <label>
        Colormap:
        <select
          value={waterfallColormap}
          onChange={(e) =>
            _setWaterfallColormap(e.target.value as "viridis" | "inferno")
          }
          style={{ marginLeft: 6 }}
        >
          <option value="viridis">Viridis</option>
          <option value="inferno">Inferno</option>
        </select>
      </label>
      <label>
        Gain:
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={waterfallGain}
          onChange={(e) => _setWaterfallGain(parseFloat(e.target.value))}
          style={{ marginLeft: 6 }}
        />
      </label>
      <label>
        Offset:
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={waterfallOffset}
          onChange={(e) => _setWaterfallOffset(parseFloat(e.target.value))}
          style={{ marginLeft: 6 }}
        />
      </label>
    </div>
  ) : null;

  return (
    <section aria-label="Spectrum Explorer">
      <h3 style={{ marginBottom: 6 }}>Spectrum Explorer</h3>
      {Controls}
      {WaterfallControls}
      {showWaterfall ? (
        <div
          ref={containerRef}
          style={{
            marginTop: 8,
            display: "grid",
            gridTemplateRows: `${spectrumHeight}px 8px ${waterfallHeight}px`,
            gap: 0,
          }}
        >
          <div style={{ position: "relative" }}>
            <canvas
              ref={webglCanvasRef}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            />
            <canvas
              ref={combinedOverlayRef}
              role="img"
              aria-label="Spectrum plot with interactive pan and zoom"
              tabIndex={0}
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                zIndex: 1,
                display: "block",
              }}
              {...handlers}
              onClick={onSpectrumClick}
              onDoubleClick={onSpectrumDoubleClick}
              onMouseMove={onSpectrumMouseMove}
              onMouseLeave={onSpectrumMouseLeave}
            />
          </div>
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onKeyDown={onHandleKey}
            style={{
              height: 8,
              cursor: "row-resize",
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
              border: "none",
              padding: 0,
              borderRadius: 2,
              margin: "4px 0",
              touchAction: "none", // Prevent scrolling on touch devices
            }}
            role="slider"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuemin={10}
            aria-valuemax={90}
            aria-valuenow={Math.round(splitRatio * 100)}
            aria-label={`Resize split between spectrum and waterfall. Current: ${Math.round(
              splitRatio * 100,
            )} percent spectrum.`}
          />
          <div style={{ position: "relative" }}>
            <canvas
              ref={waterfallCanvasRef}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", marginTop: 8, height: 260 }}>
          <canvas
            ref={webglCanvasRef}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
          <canvas
            ref={combinedOverlayRef}
            role="img"
            aria-label="Spectrum plot with interactive pan and zoom"
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              zIndex: 1,
            }}
            {...handlers}
            onClick={onSpectrumClick}
            onDoubleClick={onSpectrumDoubleClick}
            onMouseMove={onSpectrumMouseMove}
            onMouseLeave={onSpectrumMouseLeave}
          />
        </div>
      )}

      {markers.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <MarkerTable
            markers={markers.map((m) => ({ id: m.id, freqHz: m.freqHz }))}
            onRemove={(id: string) =>
              setMarkers((prev) => prev.filter((x) => x.id !== id))
            }
            onTune={onTune}
          />
        </div>
      )}
    </section>
  );
}
