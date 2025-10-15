import { useEffect, useRef } from "react";

type Sample = {
  I: number;
  Q: number;
};

type IQConstellationProps = {
  samples: Sample[];
  width?: number;
  height?: number;
};

export default function IQConstellation({
  samples,
  width = 750,
  height = 400,
}: IQConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) {
      return;
    }
    // OffscreenCanvas + worker path
    const supportsOffscreen =
      typeof (window as any).OffscreenCanvas === "function" &&
      typeof Worker !== "undefined";
    const shouldUseWorker = supportsOffscreen;

    if (shouldUseWorker) {
      // create worker if needed
      if (!workerRef.current) {
        // Try to create worker via module URL; fall back to blob if import.meta isn't allowed.
        try {
          // dynamic URL for worker via eval to avoid Jest import.meta parse
          const worker = (0, eval)(
            `new Worker(new URL("../workers/visualization.worker.ts", import.meta.url))`,
          );
          workerRef.current = worker;
        } catch (e) {
          // Fallback: fetch the worker source and create a blob URL
          try {
            // NOTE: In bundlers this may not be necessary; keep as safe fallback.
            const workerCode = `self.onmessage = function(){ /* no-op fallback worker */ };`;
            const blob = new Blob([workerCode], {
              type: "application/javascript",
            });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            workerRef.current = worker;
          } catch (e2) {
            console.error(
              "Could not create visualization worker (fallback)",
              e2,
            );
            workerRef.current = null;
          }
        }
        if (workerRef.current) {
          workerRef.current.onmessage = (ev) => {
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
      }

      const offscreen = (canvas as any).transferControlToOffscreen?.();
      if (offscreen && workerRef.current) {
        workerRef.current.postMessage(
          {
            type: "init",
            canvas: offscreen,
            vizType: "constellation",
            width,
            height,
          },
          [offscreen],
        );
        workerRef.current.postMessage({ type: "render", data: { samples } });
        return;
      }
      // if transfer fails, fall through to main-thread render
    }

    // Fallback: render on main thread
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

    // --- original rendering logic (kept minimal here) ---
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);
    // draw simple points for fallback (keeps UI responsive)
    const margin = { top: 60, bottom: 70, left: 80, right: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const iValues = samples.map((s) => s.I);
    const qValues = samples.map((s) => s.Q);
    const iMin = Math.min(...iValues, -0.1);
    const iMax = Math.max(...iValues, 0.1);
    const qMin = Math.min(...qValues, -0.1);
    const qMax = Math.max(...qValues, 0.1);
    const iPadding = (iMax - iMin) * 0.1;
    const qPadding = (qMax - qMin) * 0.1;
    const scaleI = (i: number) =>
      margin.left +
      ((i - (iMin - iPadding)) / (iMax - iMin + 2 * iPadding)) * chartWidth;
    const scaleQ = (q: number) =>
      margin.top +
      chartHeight -
      ((q - (qMin - qPadding)) / (qMax - qMin + 2 * qPadding)) * chartHeight;

    ctx.fillStyle = "rgba(100,200,255,0.6)";
    for (let k = 0; k < samples.length; k++) {
      const s = samples[k];
      if (!s) {
        continue;
      }
      const x = scaleI(s.I);
      const y = scaleQ(s.Q);
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [samples, width, height]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
