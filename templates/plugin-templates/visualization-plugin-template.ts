/**
 * Template Visualization Plugin
 *
 * TODO: Replace the following:
 * - "TemplateVisualization" → "YourVisualization"
 * - "template-visualization" → "your-visualization"
 * - "Template Visualization" → "Your Visualization"
 * - "Your Name" → your actual name
 * - Implement your visualization rendering
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  VisualizationPlugin,
  VisualizationCapabilities,
  PluginMetadata,
  PluginConfigSchema,
} from "../../types/plugin";
import type { DataSource } from "../../visualization/interfaces";

export class TemplateVisualizationPlugin
  extends BasePlugin
  implements VisualizationPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.VISUALIZATION };

  // Canvas and rendering
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // TODO: Add WebGL support if needed
  // private gl: WebGLRenderingContext | null = null;

  // Data
  private samples: IQSample[] = [];

  // TODO: Add visualization-specific state
  // private colorScheme: string = "default";
  // private scale: number = 1.0;

  // Animation
  private animationId: number | null = null;

  constructor() {
    const metadata: PluginMetadata = {
      id: "template-visualization",
      name: "Template Visualization",
      version: "1.0.0",
      author: "Your Name",
      description: "TODO: Describe your visualization",
      type: PluginType.VISUALIZATION,
      homepage: "https://github.com/yourusername/rad.io-template-viz",
    };

    super(metadata);

    // TODO: Initialize visualization state
  }

  // Lifecycle hooks

  protected onInitialize(): void {
    // TODO: Initialize visualization state
    this.samples = [];
    console.log(`${this.metadata.name} initialized`);
  }

  protected async onActivate(): Promise<void> {
    // TODO: Start rendering if canvas is ready
    if (this.canvas) {
      this.startRenderLoop();
    }
    console.log(`${this.metadata.name} activated`);
  }

  protected async onDeactivate(): Promise<void> {
    // TODO: Stop rendering
    this.stopRenderLoop();
    console.log(`${this.metadata.name} deactivated`);
  }

  protected onDispose(): void {
    // TODO: Clean up all resources
    this.stopRenderLoop();
    this.canvas = null;
    this.ctx = null;
    this.samples = [];
    console.log(`${this.metadata.name} disposed`);
  }

  // Visualization interface implementation

  /**
   * Initialize rendering on a canvas
   *
   * TODO: Set up your canvas context and start receiving data
   */
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void {
    this.canvas = canvas;

    // TODO: Choose appropriate context options
    this.ctx = canvas.getContext("2d", {
      alpha: false, // Set to true if you need transparency
      desynchronized: true, // Better performance
    });

    if (!this.ctx) {
      throw new Error("Failed to get 2D context");
    }

    // TODO: WebGL setup (if needed)
    // this.gl = canvas.getContext("webgl");

    // Start receiving data from source
    void dataSource.startStreaming((samples) => {
      this.update(samples);
    });

    // Start render loop if active
    if (this.state === "active") {
      this.startRenderLoop();
    }
  }

  /**
   * Update visualization with new samples
   *
   * TODO: Process and store incoming samples
   */
  update(samples: IQSample[]): void {
    if (!samples || samples.length === 0) {
      return;
    }

    // TODO: Process incoming samples
    // Examples:
    // - Add to buffer
    // - Calculate FFT
    // - Update statistics
    // - Trigger re-render

    this.samples.push(...samples);

    // TODO: Limit buffer size to prevent memory growth
    const maxSamples = 10000;
    if (this.samples.length > maxSamples) {
      this.samples = this.samples.slice(-maxSamples);
    }
  }

  /**
   * Resize visualization
   *
   * TODO: Handle canvas resize
   */
  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;

      // TODO: Update any size-dependent state
      // - Recalculate scales
      // - Resize buffers
      // - Update layouts
    }

    // TODO: Clear and redraw after resize
    this.clear();
  }

  /**
   * Get visualization capabilities
   *
   * TODO: Update capabilities to match your visualization
   */
  getCapabilities(): VisualizationCapabilities {
    return {
      supportsRealtime: true,
      supportsOffline: true,
      supportsWebGL: false, // TODO: Set to true if you implement WebGL
      minUpdateRate: 1,
      maxUpdateRate: 60,
      preferredAspectRatio: 16 / 9, // TODO: Set appropriate aspect ratio
    };
  }

  /**
   * Take a snapshot of the current visualization
   *
   * TODO: Implement if you want snapshot support
   */
  takeSnapshot?(): string {
    if (!this.canvas) {
      throw new Error("Canvas not initialized");
    }

    return this.canvas.toDataURL("image/png");
  }

  // Rendering

  /**
   * Start animation loop
   */
  private startRenderLoop(): void {
    if (this.animationId !== null) {
      return;
    }

    const renderFrame = () => {
      this.renderFrame();
      this.animationId = requestAnimationFrame(renderFrame);
    };

    this.animationId = requestAnimationFrame(renderFrame);
  }

  /**
   * Stop animation loop
   */
  private stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Render a single frame
   *
   * TODO: Implement your rendering logic
   */
  private renderFrame(): void {
    if (!this.ctx || !this.canvas) {
      return;
    }

    // TODO: Clear or prepare canvas
    // this.clear();

    // TODO: Render your visualization
    // Examples:
    // - Draw waveform
    // - Draw spectrum
    // - Draw waterfall
    // - Draw constellation
    // - etc.

    // Example: Simple sample plotting
    if (this.samples.length > 0) {
      this.drawSamples();
    }
  }

  /**
   * Clear the canvas
   */
  private clear(): void {
    if (!this.ctx || !this.canvas) {
      return;
    }

    // TODO: Choose appropriate background color
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw samples (example implementation)
   *
   * TODO: Replace with your own drawing logic
   */
  private drawSamples(): void {
    if (!this.ctx || !this.canvas) {
      return;
    }

    const { width, height } = this.canvas;
    const centerY = height / 2;

    this.ctx.strokeStyle = "green";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    // TODO: Implement your drawing logic
    // This is just an example
    const step = width / this.samples.length;

    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i];
      if (!sample) continue;

      const x = i * step;
      const y = centerY - sample.I * centerY; // Scale to canvas

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();
  }

  // Configuration

  /**
   * Get configuration schema
   *
   * TODO: Define your configuration options
   */
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        // TODO: Add your configuration options
        // Examples:
        // colorScheme: { type: "string", enum: ["light", "dark"] },
        // lineWidth: { type: "number", minimum: 1, maximum: 10 },
        // showGrid: { type: "boolean", default: true },
      },
    };
  }

  /**
   * Handle configuration updates
   *
   * TODO: Apply configuration changes
   */
  protected override onConfigUpdate(config: Record<string, unknown>): void {
    // TODO: Process configuration updates
    // Examples:
    // if (typeof config["colorScheme"] === "string") {
    //   this.colorScheme = config["colorScheme"];
    // }
    void config; // Remove this line when you implement
  }

  // Private helper methods

  // TODO: Add helper methods
  // Examples:
  // - Color mapping functions
  // - Scale calculations
  // - Grid drawing
  // - Label rendering
  // - etc.
}

// TODO: After implementing:
// 1. Write tests in __tests__/TemplateVisualizationPlugin.test.ts
// 2. Export from src/plugins/index.ts
// 3. Test with real data source
// 4. Optimize rendering performance
// 5. Document usage and configuration
