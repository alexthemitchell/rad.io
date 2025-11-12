/**
 * Equalizer Tap Visualizer
 *
 * Displays the adaptive equalizer coefficients used for multipath
 * correction in ATSC reception. The tap visualization shows which
 * delays have significant multipath components.
 */

import { type ReactElement, useEffect, useMemo, useRef } from "react";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { performanceMonitor } from "../../utils/performanceMonitor";

export interface EqualizerVisualizerProps {
  /** Equalizer tap coefficients */
  taps: Float32Array;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Symbol rate in Hz (for time scale) */
  symbolRate?: number;
  /** Whether to show time axis labels */
  showTimeAxis?: boolean;
}

/**
 * Equalizer Visualizer Component
 *
 * Renders a bar chart of equalizer tap coefficients, showing the
 * adaptive filter response used to combat multipath interference.
 */
export default function EqualizerVisualizer({
  taps,
  width = 600,
  height = 250,
  symbolRate = 10.76e6,
  showTimeAxis = true,
}: EqualizerVisualizerProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate accessible description
  const accessibleDescription = useMemo((): string => {
    if (taps.length === 0) {
      return "No equalizer tap data";
    }

    const maxTapValue = Math.max(...Array.from(taps).map(Math.abs));
    const centerTap = taps[Math.floor(taps.length / 2)] ?? 0;
    const numSignificantTaps = Array.from(taps).filter(
      (t) => Math.abs(t) > maxTapValue * 0.1,
    ).length;

    return `Equalizer tap coefficients showing ${taps.length} taps. Center tap: ${centerTap.toFixed(3)}. Maximum tap magnitude: ${maxTapValue.toFixed(3)}. ${numSignificantTaps} taps have significant values, indicating multipath components at various delays.`;
  }, [taps]);

  useEffect((): void => {
    const canvas = canvasRef.current;
    if (!canvas || taps.length === 0) {
      return;
    }

    const markStart = "render-equalizer-viz-start";
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

    const margin = showTimeAxis
      ? { top: 20, right: 20, bottom: 40, left: 50 }
      : { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find max absolute value for scaling
    const maxAbsValue = Math.max(...Array.from(taps).map(Math.abs), 0.1);

    // Center tap index
    const centerIndex = Math.floor(taps.length / 2);

    // Helper: tap index to x-coordinate
    const indexToX = (index: number): number => {
      return margin.left + (index / (taps.length - 1)) * chartWidth;
    };

    // Helper: tap value to y-coordinate
    const valueToY = (value: number): number => {
      const centerY = margin.top + chartHeight / 2;
      const scale = chartHeight / 2 / maxAbsValue;
      return centerY - value * scale;
    };

    // Draw zero line
    ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zeroY = valueToY(0);
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(width - margin.right, zeroY);
    ctx.stroke();

    // Draw center tap marker
    const centerX = indexToX(centerIndex);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, margin.top);
    ctx.lineTo(centerX, height - margin.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

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

    // Y-axis labels (tap values)
    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    const yTicks = [
      -maxAbsValue,
      -maxAbsValue / 2,
      0,
      maxAbsValue / 2,
      maxAbsValue,
    ];
    for (const tickValue of yTicks) {
      const y = valueToY(tickValue);
      ctx.fillText(tickValue.toFixed(2), margin.left - 5, y + 3);
    }

    // X-axis labels
    ctx.textAlign = "center";
    if (showTimeAxis) {
      // Show time delay in microseconds
      const symbolPeriod = 1 / symbolRate; // seconds per symbol
      const numXTicks = 5;
      for (let i = 0; i <= numXTicks; i++) {
        const index = Math.floor((taps.length * i) / numXTicks);
        const delay = (index - centerIndex) * symbolPeriod * 1e6; // microseconds
        const x = indexToX(index);
        ctx.fillText(`${delay.toFixed(2)} μs`, x, height - margin.bottom + 15);
      }

      // X-axis title
      ctx.font = "12px Arial";
      ctx.fillText("Delay (microseconds)", width / 2, height - 5);
    } else {
      // Show tap indices
      const numXTicks = Math.min(taps.length, 9);
      for (let i = 0; i <= numXTicks; i++) {
        const index = Math.floor((taps.length * i) / numXTicks);
        const x = indexToX(index);
        ctx.fillText(index.toString(), x, height - margin.bottom + 15);
      }

      ctx.font = "12px Arial";
      ctx.fillText("Tap Index", width / 2, height - 5);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Tap Coefficient", 0, 0);
    ctx.restore();

    // Draw tap bars
    const barWidth = Math.max(1, chartWidth / taps.length - 1);
    for (let i = 0; i < taps.length; i++) {
      const tapValue = taps[i] ?? 0;
      const x = indexToX(i);
      const y = valueToY(tapValue);

      // Color based on magnitude and position
      let color: string;
      if (i === centerIndex) {
        // Center tap - primary signal
        color = "rgba(100, 255, 100, 0.9)";
      } else if (Math.abs(tapValue) > maxAbsValue * 0.1) {
        // Significant tap - multipath echo
        color = "rgba(255, 150, 100, 0.9)";
      } else {
        // Small tap - noise
        color = "rgba(80, 150, 255, 0.5)";
      }

      ctx.fillStyle = color;
      if (tapValue >= 0) {
        ctx.fillRect(x - barWidth / 2, y, barWidth, zeroY - y);
      } else {
        ctx.fillRect(x - barWidth / 2, zeroY, barWidth, y - zeroY);
      }
    }

    // Draw legend
    const legendX = width - margin.right - 120;
    const legendY = margin.top + 10;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(100, 255, 100, 0.9)";
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.fillText("Main Signal", legendX + 18, legendY + 9);

    ctx.fillStyle = "rgba(255, 150, 100, 0.9)";
    ctx.fillRect(legendX, legendY + 18, 12, 12);
    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.fillText("Multipath Echo", legendX + 18, legendY + 27);

    renderTierManager.reportSuccess(RenderTier.Canvas2D);
    performanceMonitor.measure("render-equalizer-viz", markStart);
  }, [taps, width, height, symbolRate, showTimeAxis]);

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
