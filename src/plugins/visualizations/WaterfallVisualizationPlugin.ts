/**
 * Waterfall Visualization Plugin Example
 *
 * Example implementation of a waterfall/spectrogram visualization plugin.
 * This demonstrates how to create a visualization plugin.
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  VisualizationPlugin,
  VisualizationCapabilities,
  PluginConfigSchema,
  PluginMetadata,
} from "../../types/plugin";
import type { DataSource } from "../../visualization/interfaces";

/**
 * Waterfall Visualization Plugin
 */
export class WaterfallVisualizationPlugin
  extends BasePlugin
  implements VisualizationPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.VISUALIZATION };
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private fftSize: number;
  private history: Float32Array[];
  private maxHistory: number;

  constructor() {
    const metadata: PluginMetadata = {
      id: "waterfall-visualization",
      name: "Waterfall Display",
      version: "1.0.0",
      author: "rad.io",
      description:
        "Waterfall/spectrogram visualization showing frequency vs time",
      type: PluginType.VISUALIZATION,
    };

    super(metadata);

    this.canvas = null;
    this.ctx = null;
    this.fftSize = 1024;
    this.history = [];
    this.maxHistory = 256;
  }

  protected onInitialize(): void {
    // Initialize visualization state
    this.history = [];
  }

  protected async onActivate(): Promise<void> {
    // Start visualization updates
  }

  protected async onDeactivate(): Promise<void> {
    // Stop visualization updates
  }

  protected onDispose(): void {
    // Clean up resources
    this.canvas = null;
    this.ctx = null;
    this.history = [];
  }

  /**
   * Render visualization to canvas
   */
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    if (!this.ctx) {
      throw new Error("Failed to get canvas 2D context");
    }

    // Start streaming from data source
    void dataSource.startStreaming((samples) => {
      this.update(samples);
    });
  }

  /**
   * Update visualization with new data
   */
  update(samples: IQSample[]): void {
    if (!this.ctx || !this.canvas) {
      return;
    }

    // Calculate FFT (simplified - in real implementation use proper FFT)
    const fft = this.calculateFFT(samples);

    // Add to history
    this.history.push(fft);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Render the waterfall
    this.renderWaterfall();
  }

  /**
   * Resize visualization
   */
  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // Update max history based on height
    this.maxHistory = Math.min(height, 512);
  }

  /**
   * Get visualization capabilities
   */
  getCapabilities(): VisualizationCapabilities {
    return {
      supportsRealtime: true,
      supportsOffline: true,
      supportsWebGL: false,
      minUpdateRate: 1,
      maxUpdateRate: 60,
      preferredAspectRatio: 4 / 3,
    };
  }

  /**
   * Take a snapshot of the current visualization
   */
  takeSnapshot(): string {
    if (!this.canvas) {
      throw new Error("Canvas not initialized");
    }

    return this.canvas.toDataURL("image/png");
  }

  /**
   * Calculate FFT (simplified implementation)
   */
  private calculateFFT(samples: IQSample[]): Float32Array {
    const fft = new Float32Array(this.fftSize);

    // Simple magnitude calculation (not a real FFT)
    const step = Math.max(1, Math.floor(samples.length / this.fftSize));

    for (let i = 0; i < this.fftSize; i++) {
      const idx = i * step;
      if (idx < samples.length) {
        const sample = samples[idx];
        if (!sample) {
          continue;
        }
        const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
        fft[i] = 20 * Math.log10(magnitude + 1e-10);
      }
    }

    return fft;
  }

  /**
   * Render waterfall display
   */
  private renderWaterfall(): void {
    if (!this.ctx || !this.canvas) {
      return;
    }

    const { width, height } = this.canvas;
    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;

    // Render history rows
    const rowHeight = Math.max(1, height / this.history.length);

    for (let y = 0; y < this.history.length; y++) {
      const fft = this.history[y];
      if (!fft) {
        continue;
      }
      const rowY = Math.floor(y * rowHeight);

      for (let x = 0; x < width; x++) {
        const fftIndex = Math.floor((x / width) * fft.length);
        const value = fft[fftIndex];
        if (value === undefined) {
          continue;
        }

        // Map dB value to color (simple grayscale)
        const normalized = Math.max(0, Math.min(1, (value + 100) / 100));
        const color = Math.floor(normalized * 255);

        const pixelIndex = (rowY * width + x) * 4;
        data[pixelIndex] = color; // R
        data[pixelIndex + 1] = color; // G
        data[pixelIndex + 2] = color; // B
        data[pixelIndex + 3] = 255; // A
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Get plugin configuration schema
   */
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        fftSize: {
          type: "number" as const,
          description: "FFT size for frequency resolution",
          enum: [256, 512, 1024, 2048, 4096],
          default: 1024,
        },
        maxHistory: {
          type: "number" as const,
          description: "Maximum number of history rows",
          minimum: 64,
          maximum: 1024,
          default: 256,
        },
      },
    };
  }

  /**
   * Handle configuration updates
   */
  protected override onConfigUpdate(config: Record<string, unknown>): void {
    if (typeof config["fftSize"] === "number") {
      this.fftSize = config["fftSize"];
    }
    if (typeof config["maxHistory"] === "number") {
      this.maxHistory = config["maxHistory"];
    }
  }
}
