import { useEffect, useRef } from "react";

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
}: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fftData.length === 0) {
      return;
    }

    const supportsOffscreen =
      typeof (window as any).OffscreenCanvas === "function" &&
      typeof Worker !== "undefined";
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
            w.onmessage = (ev) => {
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
        } catch (e) {
          workerRef.current = null;
        }
      }

      const offscreen = (canvas as any).transferControlToOffscreen?.();
      if (offscreen && workerRef.current) {
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
        workerRef.current.postMessage({
          type: "render",
          data: { fftData, freqMin, freqMax },
        });
        return;
      }
    }

    // Fallback: original rendering on main thread
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

    // Professional dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 70, bottom: 70, left: 80, right: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate dimensions
    const numFrames = fftData.length;
    const fftSize = fftData[0]?.length || 1024;
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
  }, [fftData, width, height, freqMin, freqMax]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
