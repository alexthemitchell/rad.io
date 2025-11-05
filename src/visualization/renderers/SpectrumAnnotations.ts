/**
 * Spectrum Annotations Renderer
 * Renders signal annotations (boxes, labels, tooltips) on top of spectrum visualization
 */

import type { DetectedSignal } from "../../hooks/useSignalDetection";

// Constants for annotation rendering
const MIN_BANDWIDTH_PX = 2; // Minimum bandwidth in pixels to show bandwidth box
const LABEL_PADDING_PX = 4; // Padding around label text background
const MIN_HIT_AREA_HZ = 50e3; // Minimum hit area for signal detection (50 kHz)

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

    // Calculate frequency range
    const freqMin = centerFrequency - sampleRate / 2;
    const freqMax = centerFrequency + sampleRate / 2;

    // Filter signals that are within the visible range
    const visibleSignals = signals.filter((signal) => {
      return (
        signal.frequency >= freqMin &&
        signal.frequency <= freqMax &&
        signal.isActive
      );
    });

    // Render each signal annotation
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

    // Restore context state
    ctx.restore();

    return true;
  }

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

    // Calculate x position from frequency
    const freqRange = freqMax - freqMin;
    const xNorm = (signal.frequency - freqMin) / freqRange;
    const x = xNorm * width;

    // Calculate bandwidth box width
    const bandwidthNorm = signal.bandwidth / freqRange;
    const bandwidthPx = bandwidthNorm * width;

    // Get color for signal type
    const color = this.getSignalColor(signal.type); // Always returns base RGB format
    const alpha = isHovered ? 0.4 : 0.25;

    // Draw bandwidth box if enabled
    if (config.showBandwidth && bandwidthPx > MIN_BANDWIDTH_PX) {
      // Convert RGB to RGBA by replacing 'rgb' with 'rgba' and adding alpha
      ctx.fillStyle = color
        .replace("rgb(", "rgba(")
        .replace(")", `, ${alpha})`);
      const boxX = x - bandwidthPx / 2;
      const boxY = height * 0.1; // Start 10% from top
      const boxHeight = height * 0.8; // Use 80% of height
      ctx.fillRect(boxX, boxY, bandwidthPx, boxHeight);

      // Draw border - use full opacity for border
      ctx.strokeStyle = isHovered
        ? color.replace("rgb(", "rgba(").replace(")", ", 1)")
        : color;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.strokeRect(boxX, boxY, bandwidthPx, boxHeight);
    }

    // Draw center line
    ctx.strokeStyle = color;
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.setLineDash(isHovered ? [] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.1);
    ctx.lineTo(x, height * 0.9);
    ctx.stroke();
    ctx.setLineDash([]);

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
    const fontSize = isHovered ? config.fontSize + 2 : config.fontSize;

    // Format frequency in MHz
    const freqMHz = (signal.frequency / 1e6).toFixed(3);
    const typeLabel = this.getTypeLabel(signal.type);

    // Create label text
    const labelText = `${freqMHz} MHz ${typeLabel}`;

    // Setup text style
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw label background
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.4;
    const labelY = height * 0.05; // 5% from top

    // Background with padding
    const bgPadding = LABEL_PADDING_PX;
    ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(
      x - textWidth / 2 - bgPadding,
      labelY - textHeight / 2 - bgPadding,
      textWidth + bgPadding * 2,
      textHeight + bgPadding * 2,
    );

    // Draw text
    ctx.fillStyle = isHovered ? "#ffffff" : "#e0e0e0";
    ctx.fillText(labelText, x, labelY);
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
      unknown: "rgb(158, 158, 158)", // Gray
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    return colors[type] ?? colors["unknown"];
  }

  /**
   * Get display label for signal type
   */
  private getTypeLabel(type: string): string {
    /* eslint-disable @typescript-eslint/naming-convention */
    const labels: Record<string, string> = {
      "wideband-fm": "WFM",
      "narrowband-fm": "NFM",
      am: "AM",
      digital: "Digital",
      unknown: "?",
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    return labels[type] ?? "?";
  }

  /**
   * Find signal at given canvas coordinates
   * @param x Canvas x coordinate
   * @param y Canvas y coordinate
   * @param signals Array of detected signals
   * @param sampleRate Sample rate in Hz
   * @param centerFrequency Center frequency in Hz
   * @returns Signal at coordinates, or null if none
   */
  public findSignalAt(
    x: number,
    y: number,
    signals: DetectedSignal[],
    sampleRate: number,
    centerFrequency: number,
  ): DetectedSignal | null {
    if (!this.canvas) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;

    // Calculate frequency at x position
    const freqMin = centerFrequency - sampleRate / 2;
    const freqMax = centerFrequency + sampleRate / 2;
    const freqRange = freqMax - freqMin;
    const xNorm = x / width;
    const freqAtX = freqMin + xNorm * freqRange;

    // Find closest signal within reasonable distance
    let closestSignal: DetectedSignal | null = null;
    let closestDistance = Infinity;

    for (const signal of signals) {
      if (!signal.isActive) {
        continue;
      }

      // Check if within signal bandwidth
      const halfBandwidth = signal.bandwidth / 2;
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
