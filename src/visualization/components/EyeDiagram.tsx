import { useEffect, useMemo, useRef } from "react";
import type { Sample } from "../../utils/dsp";
import type { ReactElement } from "react";

export type EyeDiagramProps = {
  samples: Sample[];
  width?: number;
  height?: number;
  /** Number of samples per UI overlay window (prototype) */
  periodSamples?: number;
  /** Maximum number of overlays to draw */
  maxOverlays?: number;
};

/**
 * EyeDiagram (prototype)
 *
 * Overlays fixed-length windows of the I-component to produce an eye-like diagram.
 * This is a simplified visualization useful for quick qualitative timing/ISI checks.
 */
export default function EyeDiagram({
  samples,
  width = 750,
  height = 240,
  periodSamples = 128,
  maxOverlays = 64,
}: EyeDiagramProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const accessibleDescription = useMemo(() => {
    const n = samples.length;
    return n === 0
      ? "No samples available for eye diagram"
      : `Eye diagram prototype using ${n} samples overlaid in windows of ${periodSamples} samples.`;
  }, [samples.length, periodSamples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background grid (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = dpr;
    ctx.beginPath();
    const gridCols = 8;
    for (let i = 1; i < gridCols; i++) {
      const x = (i * canvas.width) / gridCols;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    const gridRows = 4;
    for (let j = 1; j < gridRows; j++) {
      const y = (j * canvas.height) / gridRows;
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    if (samples.length < periodSamples) {
      return;
    }

    // Draw overlays
    const overlays = Math.min(
      maxOverlays,
      Math.floor(samples.length / periodSamples),
    );

    // Determine amplitude range from I-component
    let minI = Infinity;
    let maxI = -Infinity;
    for (const s of samples) {
      const I = s.I;
      if (I < minI) {
        minI = I;
      }
      if (I > maxI) {
        maxI = I;
      }
    }
    const ampSpan = Math.max(1e-6, maxI - minI);

    for (let o = 0; o < overlays; o++) {
      const start = o * periodSamples;
      const end = Math.min(start + periodSamples, samples.length);
      ctx.beginPath();
      // Slightly vary hue/alpha for depth perception
      ctx.strokeStyle = `rgba(79, 195, 247, ${Math.max(0.08, 0.4 - o / (overlays * 2))})`;
      ctx.lineWidth = 1.25 * dpr;
      for (let k = 0; k < periodSamples && start + k < end; k++) {
        const s = samples[start + k];
        if (!s) continue;
        const I = s.I;
        const x = (k / (periodSamples - 1)) * canvas.width;
        const yNorm = (I - minI) / ampSpan; // 0..1
        const y = (1 - yNorm) * canvas.height; // invert so higher is up
        if (k === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }, [samples, width, height, periodSamples, maxOverlays]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={accessibleDescription}
      style={{ display: "block", width, height, borderRadius: 4 }}
    />
  );
}
