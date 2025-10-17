import { useEffect, useRef, useMemo } from "react";
import type { ReactElement } from "react";
import { performanceMonitor } from "../utils/performanceMonitor";
import { useVisualizationInteraction } from "../hooks/useVisualizationInteraction";

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

  // Add interaction handlers for pan, zoom, and gestures
  const { transform, handlers, resetTransform } = useVisualizationInteraction();

  // Generate accessible text description of the constellation data
  const accessibleDescription = useMemo((): string => {
    if (samples.length === 0) {
      return "No IQ constellation data available";
    }

    const iValues = samples.map((s) => s.I);
    const qValues = samples.map((s) => s.Q);
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

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const markStart = "render-iq-constellation-start";
    performanceMonitor.mark(markStart);

    const supportsOffscreen =
      typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";

    if (supportsOffscreen) {
      // Create worker if needed
      if (!workerRef.current) {
        try {
          // Use webpack's worker-loader syntax for production builds
          // For tests, this will be mocked
          const worker = new Worker(
            new URL("../workers/visualization.worker.ts", import.meta.url)
          );
          workerRef.current = worker as unknown as Worker;
        } catch (e1) {
          console.error('[IQConstellation] Worker creation failed:', e1);
          workerRef.current = null;
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
            // Set canvas dimensions BEFORE transferring to OffscreenCanvas
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            
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
                dpr,
              },
              [offscreen],
            );
          }
        } else {
          // Notify worker about size changes
          const dpr = window.devicePixelRatio || 1;
          workerRef.current.postMessage({ type: "resize", width, height, dpr });
        }

        if (transferredRef.current) {
          workerRef.current.postMessage({
            type: "render",
            data: { samples, transform },
          });
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

    // Apply user interaction transform (pan and zoom)
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

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

    // Restore context state after transform
    ctx.restore();

    performanceMonitor.measure("render-iq-constellation", markStart);
  }, [samples, width, height, transform]);

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
