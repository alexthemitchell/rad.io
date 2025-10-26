/**
 * Canvas2D renderer for spectrum display (frequency line chart)
 */

import type { Renderer, SpectrumData } from "./types";

export class CanvasSpectrum implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    if (!this.ctx) {
      return false;
    }

    this.dpr = window.devicePixelRatio || 1;
    return await Promise.resolve(true);
  }

  isReady(): boolean {
    return this.ctx !== null;
  }

  render(data: SpectrumData): boolean {
    if (!this.ctx || !this.canvas) {
      return false;
    }

    const { magnitudes, freqMin, freqMax, transform } = data;

    if (magnitudes.length === 0) {
      return false;
    }

    // Update canvas size
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Apply transform if provided
    if (transform) {
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
    }

    // Clear background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Chart margins
    const margin = { top: 60, bottom: 60, left: 80, right: 40 };
    const chartWidth = this.width - margin.left - margin.right;
    const chartHeight = this.height - margin.top - margin.bottom;

    // Calculate data range
    const binCount = freqMax - freqMin;
    let minMag = Infinity;
    let maxMag = -Infinity;

    for (let i = freqMin; i < freqMax && i < magnitudes.length; i++) {
      const mag = magnitudes[i];
      if (mag !== undefined && isFinite(mag)) {
        minMag = Math.min(minMag, mag);
        maxMag = Math.max(maxMag, mag);
      }
    }

    if (!isFinite(minMag) || !isFinite(maxMag)) {
      ctx.restore();
      return false;
    }

    const magRange = maxMag - minMag;
    const effectiveMin = minMag;

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // Horizontal grid lines (magnitude)
    for (let i = 0; i <= 10; i++) {
      const y = margin.top + (chartHeight * i) / 10;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines (frequency)
    for (let i = 0; i <= 10; i++) {
      const x = margin.left + (chartWidth * i) / 10;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Draw spectrum line with gradient
    ctx.beginPath();
    let firstPoint = true;

    for (let i = freqMin; i < freqMax && i < magnitudes.length; i++) {
      const mag = magnitudes[i];
      if (mag === undefined || !isFinite(mag)) {
        continue;
      }

      const x =
        margin.left + ((i - freqMin) / binCount) * chartWidth;
      const normalized = (mag - effectiveMin) / Math.max(1e-9, magRange);
      const y = margin.top + chartHeight - normalized * chartHeight;

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Stroke with gradient effect
    ctx.strokeStyle = "rgba(100, 220, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill area under curve with gradient
    if (!firstPoint) {
      ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
      ctx.lineTo(margin.left, margin.top + chartHeight);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(
        0,
        margin.top,
        0,
        margin.top + chartHeight,
      );
      gradient.addColorStop(0, "rgba(100, 220, 255, 0.3)");
      gradient.addColorStop(1, "rgba(100, 220, 255, 0.05)");
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // Y-axis labels (magnitude in dB)
    for (let i = 0; i <= 10; i++) {
      const mag = effectiveMin + (magRange * i) / 10;
      const y = margin.top + chartHeight - (chartHeight * i) / 10;
      ctx.fillText(`${mag.toFixed(0)} dB`, margin.left - 10, y);
    }

    // X-axis labels (frequency bins)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 10; i++) {
      const bin = freqMin + Math.round((binCount * i) / 10);
      const x = margin.left + (chartWidth * i) / 10;
      ctx.fillText(`${bin}`, x, margin.top + chartHeight + 10);
    }

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      `Spectrum (bins ${freqMin}-${freqMax})`,
      this.width / 2,
      10,
    );

    ctx.restore();
    return true;
  }

  cleanup(): void {
    this.canvas = null;
    this.ctx = null;
  }
}
