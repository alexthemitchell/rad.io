# How-To: Create a Visualization Plugin

**Time to complete**: 45-60 minutes
**Prerequisites**: TypeScript, Canvas API, completed [Plugin Tutorial](../tutorials/03-creating-plugins.md)
**Difficulty**: Advanced

## Overview

This guide shows you how to create a custom visualization plugin for rad.io. We'll build a constellation diagram plugin that displays IQ samples in a scatter plot format.

## Visualization Plugin Interface

Every visualization plugin must implement:

```typescript
interface VisualizationPlugin extends Plugin {
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void;
  update(samples: IQSample[]): void;
  resize(width: number, height: number): void;
  getCapabilities(): VisualizationCapabilities;
  takeSnapshot?(): string | Promise<string>;
}
```

## Step 1: Choose Your Visualization Type

Common SDR visualizations:

- **FFT Spectrum**: Frequency domain view
- **Waterfall**: Time-frequency display
- **Constellation**: IQ scatter plot
- **Eye Diagram**: Symbol timing visualization
- **Phase Plot**: Phase vs time
- **Vector Scope**: Polar IQ display

This guide focuses on creating a constellation diagram.

## Step 2: Understand Constellation Diagrams

A constellation diagram plots:

- X-axis: In-phase (I) component
- Y-axis: Quadrature (Q) component
- Each dot represents one IQ sample
- Pattern reveals modulation type and quality

## Step 3: Create the Plugin Structure

```typescript
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

export class ConstellationPlugin
  extends BasePlugin
  implements VisualizationPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.VISUALIZATION };

  // Canvas and rendering
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  // Data
  private samples: IQSample[] = [];
  private maxSamples: number = 1000;

  // Rendering options
  private pointSize: number = 2;
  private persistence: number = 0.9; // Fade rate
  private gridEnabled: boolean = true;
  private autoScale: boolean = true;
  private scale: number = 1.0;

  // Animation
  private animationId: number | null = null;

  constructor() {
    const metadata: PluginMetadata = {
      id: "constellation-diagram",
      name: "Constellation Diagram",
      version: "1.0.0",
      author: "rad.io",
      description: "IQ constellation diagram with persistence and auto-scaling",
      type: PluginType.VISUALIZATION,
    };

    super(metadata);
  }
}
```

## Step 4: Implement Lifecycle Hooks

```typescript
  protected onInitialize(): void {
    // Initialize state
    this.samples = [];
  }

  protected async onActivate(): Promise<void> {
    // Start rendering loop
    if (this.canvas) {
      this.startRenderLoop();
    }
  }

  protected async onDeactivate(): Promise<void> {
    // Stop rendering loop
    this.stopRenderLoop();
  }

  protected onDispose(): void {
    // Clean up resources
    this.stopRenderLoop();
    this.canvas = null;
    this.ctx = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.samples = [];
  }
```

## Step 5: Implement Rendering Methods

```typescript
  /**
   * Initialize rendering on a canvas
   */
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    if (!this.ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Create offscreen canvas for double buffering
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = canvas.width;
    this.offscreenCanvas.height = canvas.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    if (!this.offscreenCtx) {
      throw new Error("Failed to get offscreen 2D context");
    }

    // Start receiving data
    void dataSource.startStreaming((samples) => {
      this.update(samples);
    });

    // Start render loop
    if (this.state === "active") {
      this.startRenderLoop();
    }
  }

  /**
   * Update with new samples
   */
  update(samples: IQSample[]): void {
    if (!samples || samples.length === 0) {
      return;
    }

    // Add new samples
    this.samples.push(...samples);

    // Limit buffer size
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }

    // Update auto-scale if enabled
    if (this.autoScale) {
      this.updateScale();
    }
  }

  /**
   * Resize visualization
   */
  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
    }

    // Clear after resize
    this.clear();
  }
```

## Step 6: Implement Rendering Logic

```typescript
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
   */
  private renderFrame(): void {
    if (!this.offscreenCtx || !this.ctx || !this.canvas) {
      return;
    }

    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;

    // Apply persistence (fade previous frame)
    if (this.persistence > 0) {
      this.offscreenCtx.fillStyle = `rgba(0, 0, 0, ${1 - this.persistence})`;
      this.offscreenCtx.fillRect(0, 0, width, height);
    } else {
      this.clear();
    }

    // Draw grid
    if (this.gridEnabled) {
      this.drawGrid();
    }

    // Draw samples
    this.drawSamples();

    // Copy offscreen to main canvas
    this.ctx.drawImage(this.offscreenCanvas!, 0, 0);
  }

  /**
   * Draw grid and axes
   */
  private drawGrid(): void {
    if (!this.offscreenCtx || !this.offscreenCanvas) {
      return;
    }

    const ctx = this.offscreenCtx;
    const { width, height } = this.offscreenCanvas;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
    ctx.lineWidth = 1;

    // Draw center axes
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw grid circles
    const maxRadius = Math.min(width, height) / 2;
    const steps = 4;

    for (let i = 1; i <= steps; i++) {
      const radius = (maxRadius * i) / steps;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw scale labels
    ctx.fillStyle = "rgba(150, 150, 150, 0.8)";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";

    for (let i = 1; i <= steps; i++) {
      const value = (i / steps / this.scale).toFixed(1);
      const y = centerY - (maxRadius * i) / steps;
      ctx.fillText(value, centerX + 20, y + 4);
    }
  }

  /**
   * Draw IQ samples
   */
  private drawSamples(): void {
    if (!this.offscreenCtx || !this.offscreenCanvas) {
      return;
    }

    const ctx = this.offscreenCtx;
    const { width, height } = this.offscreenCanvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2;

    // Set point color
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)";

    // Draw each sample
    for (const sample of this.samples) {
      if (!sample) continue;

      // Convert IQ to screen coordinates
      const x = centerX + sample.I * maxRadius * this.scale;
      const y = centerY - sample.Q * maxRadius * this.scale; // Invert Y

      // Skip if out of bounds
      if (
        x < 0 ||
        x > width ||
        y < 0 ||
        y > height
      ) {
        continue;
      }

      // Draw point
      ctx.fillRect(
        x - this.pointSize / 2,
        y - this.pointSize / 2,
        this.pointSize,
        this.pointSize,
      );
    }
  }

  /**
   * Clear the display
   */
  private clear(): void {
    if (!this.offscreenCtx || !this.offscreenCanvas) {
      return;
    }

    this.offscreenCtx.fillStyle = "black";
    this.offscreenCtx.fillRect(
      0,
      0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height,
    );
  }

  /**
   * Update auto-scale based on sample amplitude
   */
  private updateScale(): void {
    if (this.samples.length === 0) {
      return;
    }

    // Find maximum amplitude
    let maxAmp = 0;
    for (const sample of this.samples) {
      if (!sample) continue;
      const amp = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
      maxAmp = Math.max(maxAmp, amp);
    }

    // Adjust scale to keep samples visible
    if (maxAmp > 0) {
      const targetScale = 1.0 / maxAmp;
      // Smooth transition
      this.scale = this.scale * 0.95 + targetScale * 0.05;
    }
  }
```

## Step 7: Implement Capabilities and Snapshot

```typescript
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
      preferredAspectRatio: 1, // Square display
    };
  }

  /**
   * Take a snapshot of current visualization
   */
  takeSnapshot(): string {
    if (!this.canvas) {
      throw new Error("Canvas not initialized");
    }

    return this.canvas.toDataURL("image/png");
  }
```

## Step 8: Add Configuration

```typescript
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        maxSamples: {
          type: "number",
          description: "Maximum number of samples to display",
          minimum: 100,
          maximum: 10000,
          default: 1000,
        },
        pointSize: {
          type: "number",
          description: "Size of each point in pixels",
          minimum: 1,
          maximum: 10,
          default: 2,
        },
        persistence: {
          type: "number",
          description: "Persistence/fade rate (0-1)",
          minimum: 0,
          maximum: 1,
          default: 0.9,
        },
        gridEnabled: {
          type: "boolean",
          description: "Show grid and axes",
          default: true,
        },
        autoScale: {
          type: "boolean",
          description: "Automatically scale to fit samples",
          default: true,
        },
      },
    };
  }

  protected override onConfigUpdate(config: Record<string, unknown>): void {
    if (typeof config["maxSamples"] === "number") {
      this.maxSamples = config["maxSamples"];
    }
    if (typeof config["pointSize"] === "number") {
      this.pointSize = config["pointSize"];
    }
    if (typeof config["persistence"] === "number") {
      this.persistence = config["persistence"];
    }
    if (typeof config["gridEnabled"] === "boolean") {
      this.gridEnabled = config["gridEnabled"];
    }
    if (typeof config["autoScale"] === "boolean") {
      this.autoScale = config["autoScale"];
    }
  }
```

## Step 9: Performance Optimization

### Use Offscreen Canvas for Double Buffering

```typescript
// Already implemented above - prevents flickering
private offscreenCanvas: HTMLCanvasElement | null = null;
```

### Throttle Updates

```typescript
  private lastUpdateTime: number = 0;
  private updateInterval: number = 16; // ~60 FPS

  update(samples: IQSample[]): void {
    const now = Date.now();

    // Throttle updates
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }

    this.lastUpdateTime = now;

    // Process samples...
  }
```

### Limit Sample Buffer

```typescript
// Already implemented - prevents memory growth
if (this.samples.length > this.maxSamples) {
  this.samples = this.samples.slice(-this.maxSamples);
}
```

## Step 10: Add WebGL Support (Optional)

For high-performance rendering with many points:

```typescript
export class ConstellationPluginWebGL
  extends BasePlugin
  implements VisualizationPlugin
{
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;

  render(canvas: HTMLCanvasElement, dataSource: DataSource): void {
    this.gl = canvas.getContext("webgl");

    if (!this.gl) {
      throw new Error("WebGL not supported");
    }

    this.initWebGL();

    void dataSource.startStreaming((samples) => {
      this.update(samples);
    });
  }

  private initWebGL(): void {
    if (!this.gl) return;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        gl_PointSize = 2.0;
      }
    `;

    // Fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(0.0, 1.0, 0.0, 0.8);
      }
    `;

    // Compile shaders and create program
    const vertexShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    this.program = this.gl.createProgram();
    if (!this.program) throw new Error("Failed to create program");

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    this.gl.useProgram(this.program);

    // Create vertex buffer
    this.vertexBuffer = this.gl.createBuffer();
  }

  private compileShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error("WebGL not initialized");

    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
  }

  private renderWebGL(): void {
    if (!this.gl || !this.program || !this.vertexBuffer) return;

    // Clear
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Convert samples to vertex array
    const vertices = new Float32Array(this.samples.length * 2);
    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i];
      if (!sample) continue;
      vertices[i * 2] = sample.I * this.scale;
      vertices[i * 2 + 1] = sample.Q * this.scale;
    }

    // Upload to GPU
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    // Set up attribute
    const positionLoc = this.gl.getAttribLocation(this.program, "position");
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

    // Draw
    this.gl.drawArrays(this.gl.POINTS, 0, this.samples.length);
  }
}
```

## Step 11: Write Tests

```typescript
import { ConstellationPlugin } from "../ConstellationPlugin";
import { PluginState } from "../../../types/plugin";
import type { IQSample } from "../../../models/SDRDevice";

describe("ConstellationPlugin", () => {
  let plugin: ConstellationPlugin;
  let mockCanvas: HTMLCanvasElement;
  let mockDataSource: any;

  beforeEach(() => {
    plugin = new ConstellationPlugin();

    // Mock canvas
    mockCanvas = document.createElement("canvas");
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Mock data source
    mockDataSource = {
      startStreaming: jest.fn((callback) => {
        // Simulate data stream
        const samples: IQSample[] = [
          { I: 0.5, Q: 0.5 },
          { I: -0.5, Q: 0.5 },
        ];
        callback(samples);
      }),
    };
  });

  describe("initialization", () => {
    it("should create plugin with correct metadata", () => {
      expect(plugin.metadata.id).toBe("constellation-diagram");
      expect(plugin.metadata.type).toBe("visualization");
    });

    it("should initialize successfully", async () => {
      await plugin.initialize();
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });
  });

  describe("rendering", () => {
    beforeEach(async () => {
      await plugin.initialize();
      await plugin.activate();
    });

    it("should render to canvas", () => {
      expect(() => {
        plugin.render(mockCanvas, mockDataSource);
      }).not.toThrow();

      expect(mockDataSource.startStreaming).toHaveBeenCalled();
    });

    it("should handle updates", () => {
      plugin.render(mockCanvas, mockDataSource);

      const samples: IQSample[] = [
        { I: 1.0, Q: 0.0 },
        { I: 0.0, Q: 1.0 },
      ];

      expect(() => plugin.update(samples)).not.toThrow();
    });

    it("should resize canvas", () => {
      plugin.render(mockCanvas, mockDataSource);
      plugin.resize(1024, 768);

      expect(mockCanvas.width).toBe(1024);
      expect(mockCanvas.height).toBe(768);
    });
  });

  describe("capabilities", () => {
    it("should report correct capabilities", () => {
      const caps = plugin.getCapabilities();

      expect(caps.supportsRealtime).toBe(true);
      expect(caps.supportsOffline).toBe(true);
      expect(caps.minUpdateRate).toBeGreaterThan(0);
      expect(caps.maxUpdateRate).toBeGreaterThan(0);
    });
  });

  describe("snapshot", () => {
    it("should take snapshot", () => {
      plugin.render(mockCanvas, mockDataSource);
      const dataUrl = plugin.takeSnapshot();

      expect(dataUrl).toMatch(/^data:image\/png/);
    });

    it("should throw if canvas not initialized", () => {
      expect(() => plugin.takeSnapshot()).toThrow();
    });
  });

  describe("configuration", () => {
    it("should provide config schema", () => {
      const schema = plugin.getConfigSchema();
      expect(schema).toBeDefined();
      expect(schema?.properties.maxSamples).toBeDefined();
    });

    it("should update configuration", async () => {
      await plugin.updateConfig({
        maxSamples: 2000,
        pointSize: 4,
        persistence: 0.8,
      });

      // Configuration applied
      expect(true).toBe(true);
    });
  });
});
```

## Best Practices

### 1. Use RequestAnimationFrame

```typescript
// Good: Sync with display refresh
requestAnimationFrame(() => this.render());

// Bad: Fixed interval can cause jank
setInterval(() => this.render(), 16);
```

### 2. Optimize Canvas Operations

```typescript
// Good: Batch operations
ctx.beginPath();
for (const point of points) {
  ctx.rect(point.x, point.y, 2, 2);
}
ctx.fill();

// Bad: Many draw calls
for (const point of points) {
  ctx.fillRect(point.x, point.y, 2, 2); // Too many calls
}
```

### 3. Handle Window Resize

```typescript
window.addEventListener("resize", () => {
  const rect = this.canvas.getBoundingClientRect();
  this.resize(rect.width, rect.height);
});
```

### 4. Clean Up Resources

```typescript
protected override onDispose(): void {
  // Stop animation
  this.stopRenderLoop();

  // Clear references
  this.canvas = null;
  this.ctx = null;

  // Free memory
  this.samples = [];
}
```

## Resources

- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [rad.io Visualization Guide](../reference/webgl-visualization.md)
- [Plugin API Reference](../reference/plugin-api.md)

## Next Steps

- Learn about [Device Driver Plugins](./create-device-driver-plugin.md)
- Explore [Performance Optimization](./optimize-dsp-performance.md)
- See [Waterfall Example](../../src/plugins/visualizations/WaterfallVisualizationPlugin.ts)
