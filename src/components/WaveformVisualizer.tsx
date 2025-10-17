import { useEffect, useRef, useMemo } from "react";
import type { ReactElement } from "react";
import { calculateWaveform, Sample } from "../utils/dsp";
import { useVisualizationInteraction } from "../hooks/useVisualizationInteraction";

type WaveformVisualizerProps = {
  samples: Sample[];
  width?: number;
  height?: number;
};

export default function WaveformVisualizer({
  samples,
  width = 750,
  height = 300,
}: WaveformVisualizerProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const transferredRef = useRef<boolean>(false);

  // Add interaction handlers for pan, zoom, and gestures
  const { transform, handlers, resetTransform } = useVisualizationInteraction();

  // Generate accessible text description of the waveform data
  const accessibleDescription = useMemo((): string => {
    if (samples.length === 0) {
      return "No waveform data available";
    }

    const waveformData = calculateWaveform(samples);
    const amplitude = waveformData.amplitude;
    if (amplitude.length === 0) {
      return "Waveform calculation failed";
    }

    const maxAmplitude = Math.max(...Array.from(amplitude));
    const minAmplitude = Math.min(...Array.from(amplitude));
    const avgAmplitude =
      Array.from(amplitude).reduce((a, b) => a + b, 0) / amplitude.length;

    return `Amplitude waveform showing ${samples.length} time-domain samples. Signal amplitude ranges from ${minAmplitude.toFixed(3)} to ${maxAmplitude.toFixed(3)} with average ${avgAmplitude.toFixed(3)}. The waveform represents signal strength variation over time.`;
  }, [samples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) {
      return;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const supportsOffscreen =
      typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";
    const shouldUseWorker = supportsOffscreen;

    if (shouldUseWorker) {
      if (!workerRef.current) {
        try {
          // Use webpack's worker-loader syntax for production builds
          const worker = new Worker(
            new URL("../workers/visualization.worker.ts", import.meta.url),
          );
          workerRef.current = worker;
        } catch (e) {
          console.error("Could not create visualization worker", e);
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
                vizType: "waveform",
                width,
                height,
                dpr,
              },
              [offscreen],
            );
          }
        } else {
          const dpr = window.devicePixelRatio || 1;
          workerRef.current.postMessage({ type: "resize", width, height, dpr });
        }

        if (transferredRef.current) {
          workerRef.current.postMessage({
            type: "render",
            data: { samples, transform },
          });
          return;
        }
      }
    }

    // Fallback: render on main thread (existing implementation)
    if (transferredRef.current) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      return;
    }

    // Set up high DPI canvas
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

    const margin = { top: 60, bottom: 60, left: 70, right: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate waveform data
    const { amplitude } = calculateWaveform(samples);

    // Calculate statistics for adaptive scaling
    const maxAmplitude = Math.max(...Array.from(amplitude));
    const minAmplitude = Math.min(...Array.from(amplitude));
    const amplitudeRange = maxAmplitude - minAmplitude || 1;
    // const avgAmplitude =
    //   Array.from(amplitude).reduce((a, b) => a + b, 0) / amplitude.length;

    // Add padding to range
    const padding = amplitudeRange * 0.1;
    const displayMin = minAmplitude - padding;
    const displayMax = maxAmplitude + padding;
    const displayRange = displayMax - displayMin;

    // Draw a simplified waveform for fallback (keeps responsive)
    ctx.strokeStyle = "rgba(100,220,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const maxPoints = Math.max(100, Math.round(chartWidth * 2));
    const step = Math.max(1, Math.floor(amplitude.length / maxPoints));
    for (let i = 0; i < amplitude.length; i += step) {
      const x = margin.left + (i / amplitude.length) * chartWidth;
      const amp = amplitude[i]!;
      const y =
        margin.top +
        chartHeight -
        ((amp - displayMin) / displayRange) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Restore context state after transform
    ctx.restore();
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
