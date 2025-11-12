/**
 * ATSC Eye Diagram
 *
 * Displays eye diagram specifically for ATSC 8-VSB signals,
 * showing symbol quality and timing information by overlaying
 * multiple symbol periods.
 */

import React, { type ReactElement, useEffect, useMemo, useRef } from "react";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { performanceMonitor } from "../../utils/performanceMonitor";

export interface Sample {
  I: number;
  Q: number;
}

export interface ATSCEyeDiagramProps {
  /** Array of IQ samples (primarily uses I component for VSB) */
  samples: Sample[];
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Number of samples per symbol period */
  periodSamples?: number;
  /** Maximum number of symbol overlays to display */
  maxOverlays?: number;
  /** Whether to show 8-VSB level markers */
  showLevelMarkers?: boolean;
}

// 8-VSB symbol levels (normalized)
const VSB_LEVELS = [-7, -5, -3, -1, 1, 3, 5, 7];

/**
 * ATSC Eye Diagram Component
 *
 * Specialized eye diagram for 8-VSB modulation showing the
 * characteristic 8 discrete levels and symbol timing quality.
 */
export default function ATSCEyeDiagram({
  samples,
  width = 750,
  height = 300,
  periodSamples = 128,
  maxOverlays = 50,
  showLevelMarkers = true,
}: ATSCEyeDiagramProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const accessibleDescription = useMemo(() => {
    const n = samples.length;
    if (n === 0 || n < periodSamples) {
      return "No samples available for ATSC eye diagram";
    }

    const overlays = Math.min(
      maxOverlays,
      Math.floor(samples.length / periodSamples),
    );

    return `ATSC 8-VSB eye diagram showing ${overlays} overlaid symbol periods from ${n} samples. Each symbol period contains ${periodSamples} samples. The diagram reveals symbol timing quality and the characteristic 8 discrete amplitude levels of ATSC digital television.`;
  }, [samples.length, periodSamples, maxOverlays]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length < periodSamples) {
      return;
    }

    const markStart = "render-atsc-eye-diagram-start";
    performanceMonitor.mark(markStart);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      return;
    }

    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 30, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Determine amplitude range from I-component
    const iValues = samples.map((s) => s.I);
    let minI = Math.min(...iValues);
    let maxI = Math.max(...iValues);

    // Ensure range includes all VSB levels
    minI = Math.min(minI, -8);
    maxI = Math.max(maxI, 8);

    const ampSpan = Math.max(1e-6, maxI - minI);
    const ampPadding = ampSpan * 0.1;

    // Draw grid (subtle)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridCols = 8;
    for (let i = 1; i < gridCols; i++) {
      const x = margin.left + (i * chartWidth) / gridCols;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, height - margin.bottom);
      ctx.stroke();
    }

    // Draw VSB level markers
    if (showLevelMarkers) {
      ctx.strokeStyle = "rgba(255, 200, 100, 0.15)";
      ctx.setLineDash([2, 3]);
      for (const level of VSB_LEVELS) {
        const yNorm =
          (level - (minI - ampPadding)) / (ampSpan + 2 * ampPadding);
        const y = margin.top + (1 - yNorm) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();

        // Level label
        ctx.fillStyle = "rgba(255, 200, 100, 0.5)";
        ctx.font = "9px monospace";
        ctx.textAlign = "right";
        ctx.fillText(
          level > 0 ? `+${level}` : level.toString(),
          margin.left - 5,
          y + 3,
        );
      }
      ctx.setLineDash([]);
    }

    // Draw axes
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Y-axis
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    // X-axis
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Symbol Period", width / 2, height - 5);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Amplitude (8-VSB Levels)", 0, 0);
    ctx.restore();

    // Title
    ctx.font = "14px Arial";
    ctx.fillStyle = "rgba(200, 200, 200, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText("ATSC 8-VSB Eye Diagram", width / 2, margin.top - 10);

    // Draw overlays
    const overlays = Math.min(
      maxOverlays,
      Math.floor(samples.length / periodSamples),
    );

    for (let o = 0; o < overlays; o++) {
      const start = o * periodSamples;
      const end = Math.min(start + periodSamples, samples.length);

      ctx.beginPath();
      // Vary alpha for depth perception - earlier overlays more transparent
      const baseAlpha = 0.15;
      const alphaDecay = 0.3;
      const alpha = Math.max(
        baseAlpha,
        alphaDecay - (o / overlays) * alphaDecay,
      );
      ctx.strokeStyle = `rgba(79, 195, 247, ${alpha})`;
      ctx.lineWidth = 1.5 * dpr;

      for (let k = 0; k < periodSamples && start + k < end; k++) {
        const s = samples[start + k];
        if (!s) {
          continue;
        }
        const I = s.I;
        const x = margin.left + (k / (periodSamples - 1)) * chartWidth;
        const yNorm = (I - (minI - ampPadding)) / (ampSpan + 2 * ampPadding);
        const y = margin.top + (1 - yNorm) * chartHeight;

        if (k === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw sampling point marker (center of symbol)
    const samplingX = margin.left + chartWidth / 2;
    ctx.strokeStyle = "rgba(100, 255, 100, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(samplingX, margin.top);
    ctx.lineTo(samplingX, height - margin.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "rgba(100, 255, 100, 0.8)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Sample Point", samplingX, margin.top - 2);

    // Display overlay count
    ctx.fillStyle = "rgba(150, 150, 150, 0.7)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${overlays} overlays`, width - margin.right, margin.top + 15);

    renderTierManager.reportSuccess(RenderTier.Canvas2D);
    performanceMonitor.measure("render-atsc-eye-diagram", markStart);
  }, [samples, width, height, periodSamples, maxOverlays, showLevelMarkers]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={accessibleDescription}
        style={{ display: "block", borderRadius: 4 }}
      />
    </div>
  );
}
