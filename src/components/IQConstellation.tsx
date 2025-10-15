import { useEffect, useRef, useMemo } from "react";
import type { ReactElement } from "react";

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
}: IQConstellationProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  // Track whether this canvas element has been transferred to OffscreenCanvas
  const transferredRef = useRef<boolean>(false);

  // Generate accessible text description of the constellation data
  const accessibleDescription = useMemo((): string => {
    if (samples.length === 0) {
      return "No IQ constellation data available";
    }
    
    const iValues = samples.map(s => s.I);
    const qValues = samples.map(s => s.Q);
    const iMin = Math.min(...iValues);
    const iMax = Math.max(...iValues);
    const qMin = Math.min(...qValues);
    const qMax = Math.max(...qValues);
    const iRange = (iMax - iMin).toFixed(3);
    const qRange = (qMax - qMin).toFixed(3);
    
    return `IQ Constellation diagram showing ${samples.length} signal samples. In-phase (I) component ranges from ${iMin.toFixed(3)} to ${iMax.toFixed(3)} with range ${iRange}. Quadrature (Q) component ranges from ${qMin.toFixed(3)} to ${qMax.toFixed(3)} with range ${qRange}. The pattern represents the modulation scheme and signal quality.`;
  }, [samples]);

  useEffect((): void => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) {
      return;
    }

    const supportsOffscreen =
      typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";

    if (supportsOffscreen) {
      // Create worker if needed
      if (!workerRef.current) {
        try {
          // dynamic URL for worker via eval to avoid Jest import.meta parse issues
          const worker = (0, eval)(
            `new Worker(new URL("../workers/visualization.worker.ts", import.meta.url))`,
          );
          workerRef.current = worker as unknown as Worker;
        } catch {
          // Fallback: minimal no-op worker via blob
          try {
            const workerCode = `self.onmessage = function(){};`;
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
          workerRef.current.onmessage = (ev): void => {
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

      if (workerRef.current) {
        // Only transfer once; never call getContext on a transferred canvas
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
                vizType: "constellation",
                width,
                height,
              },
              [offscreen],
            );
          }
        } else {
          // Notify worker about size changes
          workerRef.current.postMessage({ type: "resize", width, height });
        }

        if (transferredRef.current) {
          workerRef.current.postMessage({ type: "render", data: { samples } });
          return; // Important: don't attempt main-thread rendering after transfer
        }
      }
      // If worker couldn't be created or transfer failed, fall through to main-thread render
    }

    // Fallback: render on main thread
    // Never attempt to getContext if the canvas was transferred
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

    // --- original rendering logic (kept minimal here) ---
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);
    // draw simple points for fallback (keeps UI responsive)
    const margin = { top: 60, bottom: 70, left: 80, right: 60 } as const;
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
    const scaleI = (i: number): number =>
      margin.left +
      ((i - (iMin - iPadding)) / (iMax - iMin + 2 * iPadding)) * chartWidth;
    const scaleQ = (q: number): number =>
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

  return <canvas 
    ref={canvasRef} 
    style={{ borderRadius: "8px" }}
    role="img"
    aria-label={accessibleDescription}
    tabIndex={0}
  />;
}
