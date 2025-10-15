import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { calculateWaveform, Sample } from "../utils/dsp";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) {
      return;
    }
    const supportsOffscreen =
      typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";
    const shouldUseWorker = supportsOffscreen;

    if (shouldUseWorker) {
      if (!workerRef.current) {
        try {
          // dynamic worker via eval to avoid Jest parse of import.meta
          const worker = (0, eval)(
            `new Worker(new URL("../workers/visualization.worker.ts", import.meta.url))`,
          );
          workerRef.current = worker;
        } catch {
          try {
            const workerCode = `self.onmessage = function(){};`;
            const blob = new Blob([workerCode], {
              type: "application/javascript",
            });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            workerRef.current = worker;
          } catch (e2) {
            console.error("Could not create visualization worker", e2);
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
                vizType: "waveform",
                width,
                height,
              },
              [offscreen],
            );
          }
        } else {
          workerRef.current.postMessage({ type: "resize", width, height });
        }

        if (transferredRef.current) {
          workerRef.current.postMessage({ type: "render", data: { samples } });
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

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
