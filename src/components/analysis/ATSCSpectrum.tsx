/**
 * ATSC Spectrum Analyzer with Pilot Tone Marker
 *
 * Displays spectrum view of ATSC signal with marker showing the
 * pilot tone at 309.44 kHz offset from the lower band edge.
 */

import { type ReactElement, useEffect, useMemo, useRef } from "react";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { performanceMonitor } from "../../utils/performanceMonitor";

// ATSC pilot frequency offset (309.44 kHz from lower edge)
const PILOT_FREQUENCY = 309440;

// Channel bandwidth (6 MHz)
const CHANNEL_BANDWIDTH = 6000000;

export interface ATSCSpectrumProps {
  /** FFT magnitude data (power spectrum) */
  fftData: Float32Array;
  /** Center frequency in Hz */
  centerFrequency: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Whether to show pilot tone marker */
  showPilotMarker?: boolean;
  /** Whether to show channel bandwidth limits */
  showBandwidthMarkers?: boolean;
}

/**
 * ATSC Spectrum Analyzer Component
 *
 * Visualizes the frequency spectrum of an ATSC signal with special
 * markers for the pilot tone and channel bandwidth.
 */
export default function ATSCSpectrum({
  fftData,
  centerFrequency,
  sampleRate,
  width = 800,
  height = 300,
  showPilotMarker = true,
  showBandwidthMarkers = true,
}: ATSCSpectrumProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate pilot tone position
  const pilotFrequency = useMemo(() => {
    // Pilot is at 309.44 kHz from lower band edge
    // Lower edge is at centerFrequency - bandwidth/2
    const lowerEdge = centerFrequency - CHANNEL_BANDWIDTH / 2;
    return lowerEdge + PILOT_FREQUENCY;
  }, [centerFrequency]);

  // Generate accessible description
  const accessibleDescription = useMemo((): string => {
    if (fftData.length === 0) {
      return "No spectrum data available";
    }

    const maxPower = Math.max(...Array.from(fftData));
    const avgPower =
      Array.from(fftData).reduce((sum, val) => sum + val, 0) / fftData.length;

    return `ATSC Spectrum display showing ${fftData.length} frequency bins. Center frequency: ${(centerFrequency / 1e6).toFixed(2)} MHz. Sample rate: ${(sampleRate / 1e6).toFixed(2)} MHz. Maximum power: ${maxPower.toFixed(1)} dB. Average power: ${avgPower.toFixed(1)} dB. Pilot tone at ${(pilotFrequency / 1e6).toFixed(3)} MHz.`;
  }, [fftData, centerFrequency, sampleRate, pilotFrequency]);

  useEffect((): void => {
    const canvas = canvasRef.current;
    if (!canvas || fftData.length === 0) {
      return;
    }

    const markStart = "render-atsc-spectrum-start";
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

    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find min/max power for scaling
    const minPower = Math.min(...Array.from(fftData), -100);
    const maxPower = Math.max(...Array.from(fftData), -20);
    const powerRange = maxPower - minPower;

    // Helper: convert frequency to x-coordinate
    const freqToX = (freq: number): number => {
      const relativeFreq = freq - centerFrequency;
      const normalizedFreq = (relativeFreq + sampleRate / 2) / sampleRate;
      return margin.left + normalizedFreq * chartWidth;
    };

    // Helper: convert power to y-coordinate
    const powerToY = (power: number): number => {
      const normalizedPower = (power - minPower) / powerRange;
      return margin.top + chartHeight - normalizedPower * chartHeight;
    };

    // Draw channel bandwidth markers
    if (showBandwidthMarkers) {
      const lowerEdge = centerFrequency - CHANNEL_BANDWIDTH / 2;
      const upperEdge = centerFrequency + CHANNEL_BANDWIDTH / 2;

      ctx.strokeStyle = "rgba(100, 200, 100, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      // Lower edge
      const xLower = freqToX(lowerEdge);
      ctx.beginPath();
      ctx.moveTo(xLower, margin.top);
      ctx.lineTo(xLower, height - margin.bottom);
      ctx.stroke();

      // Upper edge
      const xUpper = freqToX(upperEdge);
      ctx.beginPath();
      ctx.moveTo(xUpper, margin.top);
      ctx.lineTo(xUpper, height - margin.bottom);
      ctx.stroke();

      ctx.setLineDash([]);

      // Labels
      ctx.fillStyle = "rgba(100, 200, 100, 0.8)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("6 MHz BW", (xLower + xUpper) / 2, margin.top - 5);
    }

    // Draw pilot tone marker
    if (showPilotMarker) {
      const xPilot = freqToX(pilotFrequency);

      ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(xPilot, margin.top);
      ctx.lineTo(xPilot, height - margin.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pilot marker label
      ctx.fillStyle = "rgba(255, 100, 100, 1)";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Pilot", xPilot + 5, margin.top + 15);
      ctx.fillText("309.44 kHz", xPilot + 5, margin.top + 28);
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

    // Draw power scale (Y-axis labels)
    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    const numYTicks = 5;
    for (let i = 0; i <= numYTicks; i++) {
      const power = minPower + (powerRange * i) / numYTicks;
      const y = powerToY(power);
      ctx.fillText(`${power.toFixed(0)} dB`, margin.left - 5, y + 3);

      // Grid line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
    }

    // Draw frequency scale (X-axis labels)
    ctx.textAlign = "center";
    const numXTicks = 5;
    for (let i = 0; i <= numXTicks; i++) {
      const freq =
        centerFrequency - sampleRate / 2 + (sampleRate * i) / numXTicks;
      const x = freqToX(freq);
      ctx.fillText((freq / 1e6).toFixed(2), x, height - margin.bottom + 15);
    }

    // Axis labels
    ctx.font = "12px Arial";
    ctx.fillText("Frequency (MHz)", width / 2, height - 5);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Power (dB)", 0, 0);
    ctx.restore();

    // Draw spectrum
    ctx.beginPath();
    ctx.strokeStyle = "rgba(80, 200, 255, 0.9)";
    ctx.lineWidth = 1.5;

    for (let i = 0; i < fftData.length; i++) {
      const freq =
        centerFrequency - sampleRate / 2 + (sampleRate * i) / fftData.length;
      const x = freqToX(freq);
      const power = i < fftData.length ? (fftData[i] ?? minPower) : minPower;
      const y = powerToY(power);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.closePath();
    ctx.fillStyle = "rgba(80, 200, 255, 0.1)";
    ctx.fill();

    renderTierManager.reportSuccess(RenderTier.Canvas2D);
    performanceMonitor.measure("render-atsc-spectrum", markStart);
  }, [
    fftData,
    centerFrequency,
    sampleRate,
    width,
    height,
    showPilotMarker,
    showBandwidthMarkers,
    pilotFrequency,
  ]);

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
