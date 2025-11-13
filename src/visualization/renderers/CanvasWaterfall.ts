/**
 * Canvas2D renderer for waterfall display (time-frequency heatmap)
 * Uses Viridis colormap for power-to-color mapping
 */

import { WATERFALL_MARGIN } from "../grid";
import type { Renderer, WaterfallData } from "./types";

// Viridis colormap control points (11 stops)
const VIRIDIS_STOPS: ReadonlyArray<readonly [number, number, number]> = [
  [68, 1, 84],
  [72, 35, 116],
  [64, 67, 135],
  [52, 94, 141],
  [41, 120, 142],
  [32, 144, 140],
  [34, 167, 132],
  [68, 190, 112],
  [121, 209, 81],
  [189, 223, 38],
  [253, 231, 37],
];

export class CanvasWaterfall implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private colorLUT: Uint8Array | null = null;

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
    this.buildColorLUT();
    return await Promise.resolve(true);
  }

  isReady(): boolean {
    return this.ctx !== null;
  }

  render(data: WaterfallData): boolean {
    if (!this.ctx || !this.canvas || !this.colorLUT) {
      return false;
    }

    const { frames, freqMin, freqMax, transform } = data;

    if (frames.length === 0) {
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
    // Avoid subpixel smoothing artifacts when drawing many small rects
    // which can manifest as vertical/horizontal lines between tiles.
    ctx.imageSmoothingEnabled = false;

    // Apply transform if provided
    if (transform) {
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
    }

    // Clear background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Chart margins
    const margin = WATERFALL_MARGIN;
    const chartWidth = this.width - margin.left - margin.right;
    const chartHeight = this.height - margin.top - margin.bottom;

    const numFrames = frames.length;
    const binCount = freqMax - freqMin;

    if (numFrames === 0 || binCount <= 0) {
      ctx.restore();
      return false;
    }

    // Precompute integer-aligned pixel edges to prevent gaps/overdraw.
    // This eliminates aliasing lines that appear with fractional sizes.
    const xEdges: number[] = Array.from(
      { length: numFrames + 1 },
      (_, i) => margin.left + Math.floor((i * chartWidth) / numFrames),
    );

    const binSpan = binCount; // number of bins to draw
    // Build from top to bottom; bin index 0 sits at the bottom by design below,
    // so compute edges in chart space then invert when drawing.
    const yEdges: number[] = Array.from(
      { length: binSpan + 1 },
      (_, j) => margin.top + Math.floor((j * chartHeight) / binSpan),
    );

    // Find global min/max for normalization
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (const frame of frames) {
      for (let bin = freqMin; bin < freqMax && bin < frame.length; bin++) {
        const value = frame[bin];
        if (value !== undefined && isFinite(value)) {
          globalMin = Math.min(globalMin, value);
          globalMax = Math.max(globalMax, value);
        }
      }
    }

    if (!isFinite(globalMin) || !isFinite(globalMax)) {
      ctx.restore();
      return false;
    }

    // Apply 5% dynamic range compression
    const range = globalMax - globalMin;
    const effectiveMin = globalMin + range * 0.05;
    const effectiveRange = Math.max(1e-9, globalMax - effectiveMin);

    // Render each frame as vertical strips
    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      const frame = frames[frameIdx];
      if (!frame) {
        continue;
      }
      const x0 =
        xEdges[frameIdx] ??
        margin.left + Math.floor((frameIdx * chartWidth) / numFrames);
      const x1 =
        xEdges[frameIdx + 1] ??
        margin.left + Math.floor(((frameIdx + 1) * chartWidth) / numFrames);
      const w = Math.max(1, x1 - x0);

      for (let bin = freqMin; bin < freqMax && bin < frame.length; bin++) {
        const value = frame[bin];
        if (value === undefined || !isFinite(value)) {
          continue;
        }

        // Normalize to [0, 1]
        const normalized = (value - effectiveMin) / effectiveRange;
        const t = Math.max(0, Math.min(1, normalized));

        // Map to color using LUT (guaranteed non-null after initialization)
        const colorIdx = Math.floor(t * 255) * 3;
        const lut = this.colorLUT;
        const r = lut[colorIdx] ?? 0;
        const g = lut[colorIdx + 1] ?? 0;
        const b = lut[colorIdx + 2] ?? 0;

        // Draw pixel aligned to integer pixel grid.
        const j = bin - freqMin; // 0..binSpan-1 (bottom to top mapping)
        // Convert to top-origin coordinates: higher bins are nearer the top.
        const yTop =
          yEdges[binSpan - (j + 1)] ??
          margin.top +
            Math.floor(((binSpan - (j + 1)) * chartHeight) / binSpan);
        const yBottom =
          yEdges[binSpan - j] ??
          margin.top + Math.floor(((binSpan - j) * chartHeight) / binSpan);
        const h = Math.max(1, yBottom - yTop);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x0, yTop, w, h);
      }
    }

    // Draw axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(margin.left, margin.top, chartWidth, chartHeight);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      `Waterfall (${numFrames} frames, bins ${freqMin}-${freqMax})`,
      this.width / 2,
      10,
    );

    // Draw colorbar legend
    this.drawColorbar(ctx, margin, chartHeight);

    ctx.restore();
    return true;
  }

  cleanup(): void {
    this.canvas = null;
    this.ctx = null;
    this.colorLUT = null;
  }

  private buildColorLUT(): void {
    // Build 256-entry RGB lookup table via linear interpolation
    const lut = new Uint8Array(256 * 3);
    const numStops = VIRIDIS_STOPS.length;

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const segment = t * (numStops - 1);
      const idx = Math.floor(segment);
      const frac = segment - idx;

      const c0 = VIRIDIS_STOPS[idx] ?? [0, 0, 0];
      const c1 = VIRIDIS_STOPS[Math.min(idx + 1, numStops - 1)] ?? [0, 0, 0];

      lut[i * 3 + 0] = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
      lut[i * 3 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
      lut[i * 3 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
    }

    this.colorLUT = lut;
  }

  private drawColorbar(
    ctx: CanvasRenderingContext2D,
    margin: { top: number; bottom: number; left: number; right: number },
    chartHeight: number,
  ): void {
    if (!this.colorLUT) {
      return;
    }

    const barWidth = 20;
    const barHeight = chartHeight;
    const barX = this.width - margin.right + 40;
    const barY = margin.top;

    // Draw gradient bar
    const gradient = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
    for (let i = 0; i < 256; i += 32) {
      const r = this.colorLUT[i * 3] ?? 0;
      const g = this.colorLUT[i * 3 + 1] ?? 0;
      const b = this.colorLUT[i * 3 + 2] ?? 0;
      gradient.addColorStop(1 - i / 255, `rgb(${r}, ${g}, ${b})`);
    }

    // eslint-disable-next-line no-param-reassign
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw border
    // eslint-disable-next-line no-param-reassign
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    // eslint-disable-next-line no-param-reassign
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Labels
    // eslint-disable-next-line no-param-reassign
    ctx.font = "10px monospace";
    // eslint-disable-next-line no-param-reassign
    ctx.textAlign = "left";
    // eslint-disable-next-line no-param-reassign
    ctx.textBaseline = "middle";
    ctx.fillText("High", barX + barWidth + 5, barY);
    ctx.fillText("Low", barX + barWidth + 5, barY + barHeight);
  }
}
