import { useEffect, useRef, useMemo } from "react";
import type { ReactElement } from "react";
import { performanceMonitor } from "../utils/performanceMonitor";
import { useVisualizationInteraction } from "../hooks/useVisualizationInteraction";

type SpectrogramProps = {
  fftData: Float32Array[];
  width?: number;
  height?: number;
  freqMin?: number;
  freqMax?: number;
};

export default function Spectrogram({
  fftData,
  width = 750,
  height = 800,
  freqMin = 1000,
  freqMax = 1100,
}: SpectrogramProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const transferredRef = useRef<boolean>(false);

  // Add interaction handlers for pan, zoom, and gestures
  const { transform, handlers, resetTransform } = useVisualizationInteraction();

  // Generate accessible text description of the spectrogram data
  const accessibleDescription = useMemo((): string => {
    if (fftData.length === 0) {
      return "No spectrogram data available";
    }

    const numFrames = fftData.length;
    const binCount = freqMax - freqMin;

    // Find peak power and its frequency
    let maxPower = -Infinity;
    let maxPowerBin = 0;
    fftData.forEach((row) => {
      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (isFinite(value) && value > maxPower) {
          maxPower = value;
          maxPowerBin = bin;
        }
      }
    });

    return `Spectrogram showing ${numFrames} time frames across ${binCount} frequency bins (${freqMin} to ${freqMax}). Peak power of ${maxPower.toFixed(2)} dB detected at frequency bin ${maxPowerBin}. Colors represent signal strength from low (dark) to high (bright).`;
  }, [fftData, freqMin, freqMax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fftData.length === 0) {
      return;
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const markStart = "render-spectrogram-start";
    performanceMonitor.mark(markStart);

    const supportsOffscreen =
      typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";
    if (supportsOffscreen) {
      if (!workerRef.current) {
        try {
          // dynamic worker via eval to avoid Jest parse of import.meta
          const worker = (0, eval)(
            `new Worker(new URL("../workers/visualization.worker.ts", import.meta.url))`,
          );
          workerRef.current = worker;
          const w = workerRef.current;
          if (w) {
            w.onmessage = (ev): void => {
              const d = ev.data as unknown as {
                type?: string;
                viz?: string;
                renderTimeMs?: number;
              };
              if (d?.type === "metrics") {
                console.warn(
                  `[viz worker] ${d.viz} render ${d.renderTimeMs?.toFixed(2)}ms`,
                );
              }
            };
          }
        } catch {
          workerRef.current = null;
        }
      }

      if (workerRef.current) {
        if (!transferredRef.current) {
          const canTransfer =
            typeof (
              canvas as HTMLCanvasElement & {
                transferControlToOffscreen?: () => OffscreenCanvas;
              }
            ).transferControlToOffscreen === "function";
          if (canTransfer) {
            const offscreen = (
              canvas as HTMLCanvasElement & {
                transferControlToOffscreen: () => OffscreenCanvas;
              }
            ).transferControlToOffscreen();
            transferredRef.current = true;
            workerRef.current.postMessage(
              {
                type: "init",
                canvas: offscreen,
                vizType: "spectrogram",
                width,
                height,
                freqMin,
                freqMax,
              },
              [offscreen],
            );
          }
        } else {
          workerRef.current.postMessage({ type: "resize", width, height });
        }

        if (transferredRef.current) {
          workerRef.current.postMessage({
            type: "render",
            data: { fftData, freqMin, freqMax, transform },
          });
          return;
        }
      }
    }

    // Fallback: original rendering on main thread
    if (transferredRef.current) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      return;
    }

    // Set up high DPI canvas for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Apply user interaction transform (pan and zoom)
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    // Professional dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 70, bottom: 70, left: 80, right: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate dimensions
    const numFrames = fftData.length;
    // const fftSize = fftData[0]?.length || 1024; // not used directly in fallback rendering
    const frameWidth = Math.max(1, chartWidth / numFrames);
    const binHeight = chartHeight / (freqMax - freqMin);

    // Find global min/max for dynamic range optimization
    let globalMin = Infinity;
    let globalMax = -Infinity;

    fftData.forEach((row) => {
      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (isFinite(value)) {
          globalMin = Math.min(globalMin, value);
          globalMax = Math.max(globalMax, value);
        }
      }
    });

    // Apply dynamic range compression for better visualization
    const range = globalMax - globalMin;
    const effectiveMin = globalMin + range * 0.05; // 5% threshold
    const effectiveMax = globalMax;

    // Render spectrogram bins
    fftData.forEach((row, frameIdx) => {
      const x = margin.left + frameIdx * frameWidth;

      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (!isFinite(value)) {
          continue;
        }

        // Normalize with dynamic range compression
        const normalized =
          (value - effectiveMin) / (effectiveMax - effectiveMin);

        // Simple viridis-like color
        const t = Math.max(0, Math.min(1, normalized));
        const r = Math.round(68 + 185 * t);
        const g = Math.round(1 + 220 * t);
        const b = Math.round(84 - 50 * t);

        const y = margin.top + chartHeight - (bin - freqMin) * binHeight;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y - binHeight, frameWidth + 0.5, binHeight + 0.5);
      }
    });

    // Restore context state after transform
    ctx.restore();

    performanceMonitor.measure("render-spectrogram", markStart);
  }, [fftData, width, height, freqMin, freqMax, transform]);

  // Cleanup worker on unmount
  useEffect((): (() => void) => {
    return () => {
      if (workerRef.current) {
        try {
          workerRef.current.postMessage({ type: "dispose" });
        } catch (e) {
          console.warn("dispose postMessage failed", e);
        }
        try {
          workerRef.current.terminate();
        } catch (e) {
          console.warn("worker terminate failed", e);
        }
        workerRef.current = null;
      }
      transferredRef.current = false;
    };
  }, []);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "8px",
          touchAction: "none", // Prevent default touch behaviors
          cursor: "grab",
        }}
        role="img"
        aria-label={accessibleDescription}
        tabIndex={0}
        {...handlers}
      />
      {(transform.scale !== 1 ||
        transform.offsetX !== 0 ||
        transform.offsetY !== 0) && (
        <button
          onClick={resetTransform}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "6px 12px",
            background: "rgba(90, 163, 232, 0.9)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold",
            zIndex: 10,
          }}
          title="Reset view (or press 0)"
          aria-label="Reset visualization view"
        >
          Reset View
        </button>
      )}
    </div>
  );
}
