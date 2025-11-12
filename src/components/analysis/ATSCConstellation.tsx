/**
 * ATSC 8-VSB Constellation Diagram
 *
 * Displays constellation points for ATSC 8-VSB signals showing the 8 discrete
 * amplitude levels (-7, -5, -3, -1, +1, +3, +5, +7) used in digital television.
 */

import React, { type ReactElement, useEffect, useMemo, useRef } from "react";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { performanceMonitor } from "../../utils/performanceMonitor";

// 8-VSB symbol levels (normalized)
const VSB_LEVELS = [-7, -5, -3, -1, 1, 3, 5, 7];

// Default margin for chart rendering
const DEFAULT_MARGIN = { top: 20, right: 20, bottom: 30, left: 40 };

export interface Sample {
  I: number;
  Q: number;
}

export interface ATSCConstellationProps {
  /** Array of IQ samples to display */
  samples: Sample[];
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Whether to continue rendering when component is not visible */
  continueInBackground?: boolean;
  /** Whether to show reference grid for 8-VSB levels */
  showReferenceGrid?: boolean;
}

/**
 * ATSC 8-VSB Constellation Diagram Component
 *
 * Renders a constellation diagram specifically designed for ATSC 8-VSB signals,
 * showing symbol distribution across the 8 discrete amplitude levels.
 * Includes reference markers for ideal symbol positions.
 */
export default function ATSCConstellation({
  samples,
  width = 750,
  height = 400,
  continueInBackground = false,
  showReferenceGrid = true,
}: ATSCConstellationProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate accessible description
  const accessibleDescription = useMemo((): string => {
    if (samples.length === 0) {
      return "No ATSC 8-VSB constellation data";
    }

    const iValues = samples.map((s) => s.I);
    const iMin = Math.min(...iValues);
    const iMax = Math.max(...iValues);
    const iRange = (iMax - iMin).toFixed(3);

    return `ATSC 8-VSB Constellation diagram showing ${samples.length} symbols. In-phase component ranges from ${iMin.toFixed(3)} to ${iMax.toFixed(3)} with range ${iRange}. The 8 discrete levels represent the digital television signal modulation.`;
  }, [samples]);

  useEffect((): void => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) {
      return;
    }

    const markStart = "render-atsc-constellation-start";
    performanceMonitor.mark(markStart);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) {
      return;
    }

    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = DEFAULT_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Extract I values and determine range
    const iValues = samples.map((s) => s.I);
    const iMin = Math.min(...iValues, -8);
    const iMax = Math.max(...iValues, 8);
    const iPadding = (iMax - iMin) * 0.1;

    // Y-axis: small Q range centered at 0 (VSB is primarily I-component)
    const qMin = -1;
    const qMax = 1;

    // Scaling functions
    const scaleI = (i: number): number =>
      margin.left +
      ((i - (iMin - iPadding)) / (iMax - iMin + 2 * iPadding)) * chartWidth;
    const scaleQ = (q: number): number =>
      margin.top + chartHeight - ((q - qMin) / (qMax - qMin)) * chartHeight;

    // Draw reference grid for 8-VSB levels
    if (showReferenceGrid) {
      ctx.strokeStyle = "rgba(100, 150, 200, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      for (const level of VSB_LEVELS) {
        const x = scaleI(level);
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, height - margin.bottom);
        ctx.stroke();

        // Label the level
        ctx.fillStyle = "rgba(150, 180, 220, 0.6)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(level.toString(), x, height - margin.bottom + 15);
      }
      ctx.setLineDash([]);
    }

    // Draw horizontal centerline (Q=0)
    ctx.strokeStyle = "rgba(150, 150, 150, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, scaleQ(0));
    ctx.lineTo(width - margin.right, scaleQ(0));
    ctx.stroke();

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
    ctx.fillText("I (In-phase)", width / 2, height - 5);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Q (Quadrature)", 0, 0);
    ctx.restore();

    // Density-based coloring for better visualization
    const gridSize = 0.5;
    const densityMap = new Map<string, number>();
    for (const s of samples) {
      const gi = Math.round(s.I / gridSize) * gridSize;
      const gq = Math.round(s.Q / gridSize) * gridSize;
      const key = `${gi.toFixed(2)},${gq.toFixed(2)}`;
      densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
    }
    const maxDensity = Math.max(...Array.from(densityMap.values()), 1);

    // Draw constellation points
    for (const s of samples) {
      const x = scaleI(s.I);
      const y = scaleQ(s.Q);

      const gi = Math.round(s.I / gridSize) * gridSize;
      const gq = Math.round(s.Q / gridSize) * gridSize;
      const key = `${gi.toFixed(2)},${gq.toFixed(2)}`;
      const dens = (densityMap.get(key) ?? 1) / maxDensity;
      const alpha = Math.min(1, 0.3 + dens * 0.7);

      ctx.fillStyle = `rgba(80, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw reference markers for ideal VSB levels
    if (showReferenceGrid) {
      ctx.fillStyle = "rgba(255, 100, 100, 0.5)";
      for (const level of VSB_LEVELS) {
        const x = scaleI(level);
        const y = scaleQ(0);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 150, 150, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    renderTierManager.reportSuccess(RenderTier.Canvas2D);
    performanceMonitor.measure("render-atsc-constellation", markStart);
  }, [samples, width, height, showReferenceGrid, continueInBackground]);

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
