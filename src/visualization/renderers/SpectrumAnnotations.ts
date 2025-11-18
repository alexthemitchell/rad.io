/**
 * Spectrum Annotations Renderer
 * Renders signal annotations (boxes, labels, tooltips) on top of spectrum visualization
 */

import { getCachedRDSData } from "../../store/rdsCache";
import { formatFrequency } from "../../utils";
import {
  DEFAULT_MARGIN,
  WATERFALL_MARGIN,
  determineGridSpacing,
} from "../grid";
import type { RenderTransform } from "./types";
import type { DetectedSignal } from "../../hooks/useSignalDetection";

// Constants for annotation rendering
const MIN_BANDWIDTH_PX = 2; // Minimum bandwidth in pixels to show bandwidth box
const LABEL_PADDING_PX = 4; // Padding around label text background
const MIN_HIT_AREA_HZ = 50e3; // Minimum hit area for signal detection (50 kHz)
// Keep recently-seen signals visible for a short period even if they are marked inactive
const RECENTLY_VISIBLE_MS = 5_000; // 5 seconds
// VFO cursor fallback color (approximation of oklch(78% 0.14 195deg) in RGBA)
const VFO_CURSOR_FALLBACK_COLOR = "rgba(100, 200, 255, 0.9)";

const DEFAULT_SIGNAL_BANDWIDTHS = new Map<string, number>([
  ["wideband-fm", 200_000],
  ["narrowband-fm", 12_500],
  ["am", 10_000],
  ["digital", 5_000],
  ["pulsed", 50_000],
  ["unknown", 50_000],
]);

/**
 * Helper to determine whether a signal should be shown in annotations.
 * Exported for unit testing and reuse.
 */
export function isSignalVisibleForAnnotation(
  signal: DetectedSignal | null | undefined,
  freqMin: number,
  freqMax: number,
  now = Date.now(),
): boolean {
  if (!signal) return false;
  if (signal.frequency < freqMin || signal.frequency > freqMax) return false;
  if (signal.isActive) return true;
  if (
    typeof signal.lastSeen === "number" &&
    now - signal.lastSeen < RECENTLY_VISIBLE_MS
  )
    return true;
  return false;
}

function resolveSignalBandwidthHz(
  signal: DetectedSignal | undefined | null,
): number {
  const candidate = signal?.bandwidth;
  if (
    typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate > 0
  ) {
    return candidate;
  }
  const fallback = signal?.type
    ? (DEFAULT_SIGNAL_BANDWIDTHS.get(signal.type) ?? MIN_HIT_AREA_HZ)
    : MIN_HIT_AREA_HZ;
  return Math.max(fallback, MIN_HIT_AREA_HZ);
}

/**
 * Configuration for annotation rendering
 */
export interface AnnotationConfig {
  /** Whether to show annotations */
  enabled: boolean;
  /** Whether to show signal labels */
  showLabels: boolean;
  /** Whether to show bandwidth boxes */
  showBandwidth: boolean;
  /** Font size for labels in pixels */
  fontSize: number;
}

/**
 * Annotation renderer for spectrum visualizations
 * Uses 2D canvas overlay on top of WebGL spectrum
 *
 * Note: Each instance should be bound to a single canvas. If you need to render
 * to multiple canvases, create separate instances to avoid dimension tracking conflicts.
 */
export class SpectrumAnnotations {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private hoveredSignal: DetectedSignal | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  /**
   * Initialize the annotation renderer
   * @param canvas Canvas element for annotations
   * @returns True if initialization succeeded
   */
  public initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 1;

    return this.ctx !== null;
  }

  /**
   * Set the currently hovered signal
   * @param signal Signal being hovered, or null if none
   */
  public setHoveredSignal(signal: DetectedSignal | null): void {
    this.hoveredSignal = signal;
  }

  /**
   * Render annotations for detected signals
   * @param signals Array of detected signals to annotate
   * @param sampleRate Sample rate in Hz
   * @param centerFrequency Center frequency in Hz
   * @param config Annotation configuration
   * @returns True if rendering succeeded
   */
  public render(
    signals: DetectedSignal[],
    sampleRate: number,
    centerFrequency: number,
    config: AnnotationConfig,
  ): boolean {
    if (!this.canvas || !this.ctx || !config.enabled) {
      return false;
    }

    const ctx = this.ctx;

    // Update canvas size only when dimensions change
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.lastWidth = width;
      this.lastHeight = height;
    }

    // Save context state and scale for device pixel ratio
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Match CanvasSpectrum's internal chart margins for perfect overlay alignment
    const margin = DEFAULT_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    if (chartWidth <= 0 || chartHeight <= 0) {
      ctx.restore();
      return false;
    }

    // Calculate frequency range
    const freqMin = centerFrequency - sampleRate / 2;
    const freqMax = centerFrequency + sampleRate / 2;

    // Filter signals that are within the visible range
    const visibleSignals = signals.filter((signal) =>
      isSignalVisibleForAnnotation(signal, freqMin, freqMax),
    );

    // Clip to chart area to avoid drawing over axes/legends
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, chartWidth, chartHeight);
    if (typeof ctx.clip === "function") {
      ctx.clip();
    }

    // Draw frequency gridlines first (behind signal annotations)
    this.renderFrequencyGridlines(
      width,
      height,
      freqMin,
      freqMax,
      centerFrequency,
      sampleRate,
    );

    // Render each signal annotation (spanning full chart height)
    for (const signal of visibleSignals) {
      this.renderSignalAnnotation(
        signal,
        width,
        height,
        freqMin,
        freqMax,
        config,
      );
    }

    ctx.restore(); // clip

    // Restore context state
    ctx.restore();

    return true;
  }

  /**
   * Public helper to explicitly render only gridlines. This keeps gridlines
   * available even if full annotations are disabled by the caller.
   */
  public renderGridlines(
    width: number,
    height: number,
    freqMin: number,
    freqMax: number,
    centerFrequency: number,
    sampleRate: number,
    options?: {
      margin?: { top: number; bottom: number; left: number; right: number };
      drawLabels?: boolean;
      lineColor?: string;
      labelColor?: string;
      lineDash?: number[];
      labelBaseline?: "top" | "bottom";
      labelOffsetPx?: number;
    },
  ): boolean {
    if (!this.canvas || !this.ctx) return false;
    this.renderFrequencyGridlines(
      width,
      height,
      freqMin,
      freqMax,
      centerFrequency,
      sampleRate,
      options,
    );
    return true;
  }

  /**
   * Render annotations over the waterfall (frequency on horizontal axis)
   * Draws opaque vertical boxes spanning the full height at each signal band.
   */
  public renderWaterfall(
    signals: DetectedSignal[],
    sampleRate: number,
    centerFrequency: number,
    config: AnnotationConfig,
    transform?: RenderTransform,
  ): boolean {
    if (!this.canvas || !this.ctx || !config.enabled) {
      return false;
    }

    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.lastWidth = width;
      this.lastHeight = height;
    }

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, width, height);

    // Apply pan/zoom transform identical to CanvasWaterfall so overlays track view
    if (transform) {
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
    }

    // Match CanvasWaterfall's internal chart margins for perfect overlay alignment
    const margin = WATERFALL_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    if (chartWidth <= 0 || chartHeight <= 0) {
      ctx.restore();
      return false;
    }

    // Frequency range based on center/sampleRate
    const freqMin = centerFrequency - sampleRate / 2;
    const freqMax = centerFrequency + sampleRate / 2;
    const freqRange = Math.max(1, freqMax - freqMin);

    // Only draw active or recently-seen signals within range
    const visibleSignals = signals.filter((s) =>
      isSignalVisibleForAnnotation(s, freqMin, freqMax),
    );

    this.renderFrequencyGridlines(
      width,
      height,
      freqMin,
      freqMax,
      centerFrequency,
      sampleRate,
      {
        margin,
        drawLabels: false,
        lineColor: "rgba(255, 255, 255, 0.12)",
      },
    );

    // Clip to chart area to avoid drawing over axes/legends
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, chartWidth, chartHeight);
    if (typeof ctx.clip === "function") {
      ctx.clip();
    }

    for (const signal of visibleSignals) {
      const color = this.getSignalColor(signal.type);
      const fill = this.getWaterfallFillColor(color);

      // Map frequency to horizontal position (higher freq towards right)
      const xNorm = (signal.frequency - freqMin) / freqRange;
      const xCenter = margin.left + xNorm * chartWidth;

      const bandwidthHz = resolveSignalBandwidthHz(signal);
      const bandNorm = bandwidthHz / freqRange;
      const bandPx = Math.max(2, Math.floor(bandNorm * chartWidth));

      const x = Math.max(
        margin.left,
        Math.min(xCenter - bandPx / 2, margin.left + chartWidth - bandPx),
      );

      // Semi-transparent vertical band spanning full height to show underlying data
      ctx.fillStyle = fill;
      ctx.fillRect(x, margin.top, bandPx, chartHeight);

      // Border for separation with reduced opacity
      ctx.strokeStyle = color.replace("rgb(", "rgba(").replace(")", ", 0.4)");
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, margin.top, bandPx, chartHeight);

      // Center frequency line (vertical) as dashed with moderate opacity
      ctx.strokeStyle = color.replace("rgb(", "rgba(").replace(")", ", 0.7)");
      ctx.lineWidth = 2;
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([8, 4]);
      }
      ctx.beginPath();
      ctx.moveTo(xCenter, margin.top);
      ctx.lineTo(xCenter, margin.top + chartHeight);
      ctx.stroke();
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([]);
      }
    }

    ctx.restore(); // clip

    ctx.restore();
    return true;
  }

  /**
   * Render VFO (Variable Frequency Oscillator) cursor on spectrum
   * Draws a vertical line at the current tuned frequency
   * @param vfoFrequency VFO frequency in Hz
   * @param sampleRate Sample rate in Hz
   * @param centerFrequency Center frequency in Hz
   * @returns True if rendering succeeded
   */
  public renderVFOCursor(
    vfoFrequency: number,
    sampleRate: number,
    centerFrequency: number,
  ): boolean {
    if (!this.canvas || !this.ctx) {
      return false;
    }

    // Validate inputs for NaN/invalid values
    if (
      !Number.isFinite(vfoFrequency) ||
      !Number.isFinite(sampleRate) ||
      !Number.isFinite(centerFrequency)
    ) {
      return true; // Not an error, just invalid
    }

    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    // Use canvas dimensions if getBoundingClientRect returns 0 (e.g., in tests)
    const width = rect.width > 0 ? rect.width : this.canvas.width;
    const height = rect.height > 0 ? rect.height : this.canvas.height;

    // Update canvas size with DPR scaling if dimensions changed
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.lastWidth = width;
      this.lastHeight = height;
    }

    // Save context state and scale for device pixel ratio
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Match CanvasSpectrum's internal chart margins for perfect overlay alignment
    const margin = DEFAULT_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    if (chartWidth <= 0 || chartHeight <= 0) {
      ctx.restore();
      return false;
    }

    // Calculate frequency range
    const freqMin = centerFrequency - sampleRate / 2;
    const freqMax = centerFrequency + sampleRate / 2;

    // Check if VFO frequency is within visible range
    if (vfoFrequency < freqMin || vfoFrequency > freqMax) {
      ctx.restore();
      return true; // Not an error, just not visible
    }

    // Calculate x position of VFO cursor
    const freqRange = Math.max(1, freqMax - freqMin);
    const xNorm = (vfoFrequency - freqMin) / freqRange;
    const x = margin.left + xNorm * chartWidth;

    // Clip to chart area
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, chartWidth, chartHeight);
    if (typeof ctx.clip === "function") {
      ctx.clip();
    }

    // Use CSS variable for accent color with fallback
    const accentColor =
      getComputedStyle(this.canvas).getPropertyValue("--rad-accent") ||
      "oklch(78% 0.14 195deg)"; // Fallback to cyan from tokens.css

    // Convert oklch to rgba for canvas
    // Note: This is an approximation. oklch(78% 0.14 195deg) ≈ rgba(100, 200, 255, 0.9)
    const cursorColor = accentColor.trim().startsWith("oklch(")
      ? VFO_CURSOR_FALLBACK_COLOR
      : accentColor;

    // Draw VFO cursor line with glow effect
    ctx.shadowColor = cursorColor;
    ctx.shadowBlur = 4;
    ctx.strokeStyle = cursorColor;
    ctx.lineWidth = 2.5;
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + chartHeight);
    ctx.stroke();

    ctx.restore(); // clip
    ctx.restore(); // dpr scale

    return true;
  }

  // Build a semi-transparent fill for waterfall overlays that shows underlying data
  // while still indicating signal presence. Uses low alpha for transparency.
  private getWaterfallFillColor(baseRgb: string): string {
    const rgb = this.parseRgb(baseRgb);
    if (!rgb) return "rgba(255,255,255,0.2)";
    const mix = (c: number): number => Math.round(c * 0.5 + 255 * 0.5);
    const r = mix(rgb.r);
    const g = mix(rgb.g);
    const b = mix(rgb.b);
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  }

  private parseRgb(s: string): { r: number; g: number; b: number } | null {
    const m = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/u.exec(s);
    if (!m) return null;
    const r = Math.max(0, Math.min(255, Number(m[1])));
    const g = Math.max(0, Math.min(255, Number(m[2])));
    const b = Math.max(0, Math.min(255, Number(m[3])));
    return { r, g, b };
  }

  /**
   * Render frequency gridlines with labels
   * @private
   */
  private renderFrequencyGridlines(
    width: number,
    height: number,
    freqMin: number,
    freqMax: number,
    centerFrequency: number,
    sampleRate: number,
    options?: {
      margin?: { top: number; bottom: number; left: number; right: number };
      drawLabels?: boolean;
      labelBaseline?: "top" | "bottom";
      labelColor?: string;
      lineColor?: string;
      lineDash?: number[];
      labelOffsetPx?: number;
      centerLineColor?: string;
    },
  ): void {
    if (!this.ctx) {
      return;
    }

    const ctx = this.ctx;
    const margin = options?.margin ?? DEFAULT_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    if (chartWidth <= 0 || chartHeight <= 0) {
      return;
    }

    const bandwidth = Math.max(1, Math.min(sampleRate, freqMax - freqMin));
    const { spacing, formatter } = determineGridSpacing(bandwidth, chartWidth);
    const firstGridFreq = Math.ceil(freqMin / spacing) * spacing;
    const lineColor = options?.lineColor ?? "rgba(255, 255, 255, 0.16)";
    const labelColor = options?.labelColor ?? "rgba(255, 255, 255, 0.7)";
    const labelBaseline = options?.labelBaseline ?? "bottom";
    const labelOffset = options?.labelOffsetPx ?? 6;
    const drawLabels = options?.drawLabels ?? true;

    // Precompute frequencies to draw to allow reuse for labels and center skipping
    const gridFrequencies: number[] = [];
    for (let freq = firstGridFreq; freq <= freqMax; freq += spacing) {
      gridFrequencies.push(freq);
      // Guard against runaway loops for extremely small spacing
      if (gridFrequencies.length > 512) {
        break;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, chartWidth, chartHeight);
    if (typeof ctx.clip === "function") {
      ctx.clip();
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    if (options?.lineDash) {
      if (typeof ctx.setLineDash === "function")
        ctx.setLineDash(options.lineDash);
    } else {
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([6, 10]);
    }

    for (const freq of gridFrequencies) {
      const xNorm = (freq - freqMin) / bandwidth;
      const x = margin.left + xNorm * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }
    ctx.restore();

    if (drawLabels) {
      ctx.save();
      ctx.fillStyle = labelColor;
      ctx.font =
        "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = labelBaseline === "top" ? "bottom" : "top";
      const labelY =
        labelBaseline === "top"
          ? margin.top - labelOffset
          : margin.top + chartHeight + labelOffset;

      for (const freq of gridFrequencies) {
        if (Math.abs(freq - centerFrequency) < spacing * 0.25) {
          continue; // Center label is rendered separately with emphasis
        }
        const xNorm = (freq - freqMin) / bandwidth;
        const x = margin.left + xNorm * chartWidth;
        ctx.fillText(formatter(freq), x, labelY);
      }
      ctx.restore();
    }

    const centerX =
      margin.left + ((centerFrequency - freqMin) / bandwidth) * chartWidth;
    if (Number.isFinite(centerX)) {
      ctx.save();
      ctx.strokeStyle = options?.centerLineColor ?? "rgba(100, 200, 255, 0.5)";
      ctx.lineWidth = 2;
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX, margin.top);
      ctx.lineTo(centerX, margin.top + chartHeight);
      ctx.stroke();
      ctx.restore();

      if (drawLabels) {
        ctx.save();
        ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
        ctx.font =
          "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = labelBaseline === "top" ? "bottom" : "top";
        const labelY =
          labelBaseline === "top"
            ? margin.top - (labelOffset + 2)
            : margin.top + chartHeight + labelOffset;
        ctx.fillText(formatFrequency(centerFrequency), centerX, labelY);
        ctx.restore();
      }
    }
  }

  // Grid spacing and label formatting are provided by shared visualization/grid module

  /**
   * Render annotation for a single signal
   */
  private renderSignalAnnotation(
    signal: DetectedSignal,
    width: number,
    height: number,
    freqMin: number,
    freqMax: number,
    config: AnnotationConfig,
  ): void {
    if (!this.ctx) {
      return;
    }

    const ctx = this.ctx;
    // Use epsilon comparison for floating-point frequency values
    const FREQUENCY_EPSILON = 1000; // 1 kHz tolerance for frequency comparison
    const isHovered =
      this.hoveredSignal !== null &&
      Math.abs(this.hoveredSignal.frequency - signal.frequency) <
        FREQUENCY_EPSILON;

    // Match CanvasSpectrum's margins for coordinate mapping
    const margin = DEFAULT_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate x position from frequency within chart area
    const freqRange = Math.max(1, freqMax - freqMin);
    const xNorm = (signal.frequency - freqMin) / freqRange;
    const x = margin.left + xNorm * chartWidth;

    // Calculate bandwidth box width
    const bandwidthHz = resolveSignalBandwidthHz(signal);
    const bandwidthNorm = bandwidthHz / freqRange;
    const bandwidthPx = Math.max(0, bandwidthNorm * chartWidth);

    // Get base color for signal type (RGB) and derive semi-transparent variants.
    const color = this.getSignalColor(signal.type); // Always returns base RGB format
    // Fill: low alpha so spectrum data is readable through overlay.
    const fillAlpha = isHovered ? 0.25 : 0.18; // hover slightly stronger
    const boxFillColor = color
      .replace("rgb(", "rgba(")
      .replace(")", `, ${fillAlpha})`);
    // Border: visible but not overpowering
    const borderAlpha = isHovered ? 0.55 : 0.35;

    // Draw bandwidth visualization if enabled
    if (config.showBandwidth && bandwidthPx > MIN_BANDWIDTH_PX) {
      const boxX = Math.max(
        margin.left,
        Math.min(x - bandwidthPx / 2, margin.left + chartWidth - bandwidthPx),
      );
      const boxY = margin.top;
      const boxHeight = chartHeight;

      // Opaque filled region
      ctx.fillStyle = boxFillColor;
      ctx.fillRect(boxX, boxY, bandwidthPx, boxHeight);

      // Border (opaque with minor alpha adjustment)
      ctx.strokeStyle = color
        .replace("rgb(", "rgba(")
        .replace(")", `, ${borderAlpha})`);
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeRect(boxX, boxY, bandwidthPx, boxHeight);
    }

    // Draw center frequency line as dashed with moderate opacity (spec ~0.7-0.85)
    ctx.strokeStyle = color
      .replace("rgb(", "rgba(")
      .replace(")", `, ${isHovered ? 0.85 : 0.75})`);
    ctx.lineWidth = isHovered ? 2.5 : 2;
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + chartHeight);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);

    // Draw label if enabled
    if (config.showLabels) {
      this.renderLabel(signal, x, height, config, isHovered);
    }
  }

  /**
   * Render label for a signal
   */
  private renderLabel(
    signal: DetectedSignal,
    x: number,
    height: number,
    config: AnnotationConfig,
    isHovered: boolean,
  ): void {
    if (!this.ctx) {
      return;
    }

    const ctx = this.ctx;
    const isWidebandFM = signal.type === "wideband-fm";
    // Larger font for FM broadcast stations
    const baseFontSize = isWidebandFM ? config.fontSize + 2 : config.fontSize;
    const fontSize = isHovered ? baseFontSize + 2 : baseFontSize;

    // Format frequency consistently across UI
    const freqLabel = formatFrequency(signal.frequency);
    const typeLabel = this.getTypeLabel(signal.type);

    const bandwidthHz = resolveSignalBandwidthHz(signal);
    const bandwidthLabel =
      bandwidthHz >= 1e6
        ? `${(bandwidthHz / 1e6).toFixed(2)} MHz`
        : `${Math.round(bandwidthHz / 1e3)} kHz`;

    // Build label text - include RDS Program Service (PS) name if available.
    // RT (Radio Text) is shown only when hovered to avoid labels being too tall.
    let labelText: string;
    let rdsPS = "";
    const liveRDS = signal.rdsData ?? getCachedRDSData(signal.frequency);
    if (liveRDS) {
      const ps = liveRDS.ps;
      if (typeof ps === "string" && ps.trim().length > 0) {
        rdsPS = ps.trim();
      }
    }

    if (rdsPS.length > 0) {
      // Show RDS Program Service name (PS) for FM stations with RDS and bandwidth for engineering context
      labelText = `📻 ${freqLabel} - ${rdsPS} (BW ${bandwidthLabel})`;
    } else {
      // Standard label without RDS
      labelText = `${freqLabel} ${typeLabel} (BW ${bandwidthLabel})`;
    }

    // Setup text style with semi-bold weight for better readability
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw label background
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.5; // Slightly taller for better padding
    let labelY = height * 0.04; // Move slightly higher

    // Background with padding and subtle border for better contrast
    const bgPadding = LABEL_PADDING_PX + 2;
    ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.90)" : "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(
      x - textWidth / 2 - bgPadding,
      labelY - textHeight / 2 - bgPadding,
      textWidth + bgPadding * 2,
      textHeight + bgPadding * 2,
    );

    // Draw subtle border around label
    ctx.strokeStyle = isWidebandFM
      ? "rgba(76, 175, 80, 0.6)"
      : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x - textWidth / 2 - bgPadding,
      labelY - textHeight / 2 - bgPadding,
      textWidth + bgPadding * 2,
      textHeight + bgPadding * 2,
    );

    // Draw text with better contrast
    ctx.fillStyle = isHovered ? "#ffffff" : "#f0f0f0";
    ctx.fillText(labelText, x, labelY);

    // If RDS Radio Text (RT) is available and hovered, show it below
    let rdsRT = "";
    if (isHovered) {
      const liveRDSHover = signal.rdsData ?? getCachedRDSData(signal.frequency);
      if (liveRDSHover) {
        const rt = liveRDSHover.rt;
        if (typeof rt === "string" && rt.trim().length > 0) {
          rdsRT = rt.trim();
        }
      }
    }

    if (rdsRT.length > 0) {
      const rtFontSize = fontSize * 0.85; // Slightly smaller for radio text
      ctx.font = `400 ${rtFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

      const rtMetrics = ctx.measureText(rdsRT);
      const rtWidth = rtMetrics.width;
      const rtHeight = rtFontSize * 1.5;

      // Position below main label
      labelY += textHeight + bgPadding + 4;

      // Draw RT background
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(
        x - rtWidth / 2 - bgPadding,
        labelY - rtHeight / 2 - bgPadding,
        rtWidth + bgPadding * 2,
        rtHeight + bgPadding * 2,
      );

      // Draw RT border
      ctx.strokeStyle = "rgba(76, 175, 80, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        x - rtWidth / 2 - bgPadding,
        labelY - rtHeight / 2 - bgPadding,
        rtWidth + bgPadding * 2,
        rtHeight + bgPadding * 2,
      );

      // Draw RT text
      ctx.fillStyle = "#d0d0d0";
      ctx.fillText(rdsRT, x, labelY);
    }
  }

  /**
   * Get color for signal type (always returns RGB format)
   */
  private getSignalColor(type: string): string {
    /* eslint-disable @typescript-eslint/naming-convention */
    const colors: Record<string, string> = {
      "wideband-fm": "rgb(76, 175, 80)", // Green
      "narrowband-fm": "rgb(33, 150, 243)", // Blue
      am: "rgb(255, 152, 0)", // Orange
      digital: "rgb(156, 39, 176)", // Purple
      pulsed: "rgb(244, 143, 177)", // Pink
      unknown: "rgb(158, 158, 158)", // Gray
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const defaultColor = "rgb(158, 158, 158)"; // Gray fallback
    return colors[type] ?? defaultColor;
  }

  /**
   * Get display label for signal type
   */
  private getTypeLabel(type: string): string {
    /* eslint-disable @typescript-eslint/naming-convention */
    const labels: Record<string, string> = {
      "wideband-fm": "FM Broadcast",
      "narrowband-fm": "NFM",
      am: "AM",
      digital: "Digital",
      pulsed: "Pulsed",
      unknown: "Signal",
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    return labels[type] ?? "Signal";
  }

  /**
   * Find signal at given canvas coordinates
   * @param x Canvas x coordinate
   * @param _y Canvas y coordinate (reserved for future amplitude-based filtering)
   * @param signals Array of detected signals
   * @param sampleRate Sample rate in Hz
   * @param centerFrequency Center frequency in Hz
   * @returns Signal at coordinates, or null if none
   */
  public findSignalAt(
    x: number,
    _y: number,
    signals: DetectedSignal[],
    sampleRate: number,
    centerFrequency: number,
  ): DetectedSignal | null {
    if (!this.canvas) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;

    // Match CanvasSpectrum margins to compute chart area mapping
    const margin = DEFAULT_MARGIN;
    const chartWidth = width - margin.left - margin.right;
    if (chartWidth <= 0) {
      return null;
    }

    // Calculate frequency at x position
    const freqMin = centerFrequency - sampleRate / 2;
    const freqMax = centerFrequency + sampleRate / 2;
    const freqRange = Math.max(1, freqMax - freqMin);
    // Clamp to chart region before mapping
    const clampedX = Math.max(
      margin.left,
      Math.min(x, margin.left + chartWidth),
    );
    const xNorm = (clampedX - margin.left) / chartWidth;
    const freqAtX = freqMin + xNorm * freqRange;

    // Find closest signal within reasonable distance
    let closestSignal: DetectedSignal | null = null;
    let closestDistance = Infinity;

    for (const signal of signals) {
      if (!signal.isActive) {
        continue;
      }

      // Check if within signal bandwidth
      const halfBandwidth = resolveSignalBandwidthHz(signal) / 2;
      const distance = Math.abs(signal.frequency - freqAtX);

      // Signal is "hit" if within bandwidth or close to center line
      const hitDistance = Math.max(halfBandwidth, MIN_HIT_AREA_HZ);
      if (distance < hitDistance && distance < closestDistance) {
        closestDistance = distance;
        closestSignal = signal;
      }
    }

    return closestSignal;
  }

  /**
   * Clear the canvas
   * Useful for removing rendered content when features are disabled
   */
  public clear(): void {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : this.canvas.width;
    const height = rect.height > 0 ? rect.height : this.canvas.height;

    // Update canvas size with DPR scaling if dimensions changed
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.lastWidth = width;
      this.lastHeight = height;
    }

    // Clear with DPR scaling
    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.restore();
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.canvas = null;
    this.ctx = null;
    this.hoveredSignal = null;
  }

  /**
   * Check if renderer is ready
   */
  public isReady(): boolean {
    return this.ctx !== null;
  }
}
