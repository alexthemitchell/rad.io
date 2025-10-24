/**
 * Standard visualization renderer interface
 * All visualization renderers (WebGPU, WebGL, 2D Canvas) must implement this interface
 */

export interface IVisualizationRenderer {
  /**
   * Initialize the renderer with a canvas element
   * @returns true if initialization was successful, false otherwise
   */
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;

  /**
   * Render data to the canvas
   * @param data - The data to render (type depends on visualization)
   * @returns true if rendering was successful, false otherwise
   */
  render(data: unknown): boolean;

  /**
   * Clean up renderer resources
   */
  cleanup(): void;

  /**
   * Check if renderer is ready to render
   */
  isReady(): boolean;

  /**
   * Get renderer name for debugging
   */
  getName(): string;
}

/**
 * Point data for scatter plot visualizations (IQ Constellation)
 */
export interface PointData {
  positions: Float32Array; // [x, y, x, y, ...]
  colors?: Float32Array; // [r, g, b, a, r, g, b, a, ...]
  pointSize?: number;
}

/**
 * Line data for waveform visualizations
 */
export interface LineData {
  positions: Float32Array; // [x, y, x, y, ...]
  color?: [number, number, number, number]; // [r, g, b, a]
  lineWidth?: number;
}

/**
 * Texture data for heatmap visualizations (Spectrogram)
 */
export interface TextureData {
  data: Uint8Array; // RGBA data
  width: number;
  height: number;
}

/**
 * Configuration for visualization renderers
 */
export interface RendererConfig {
  width: number;
  height: number;
  devicePixelRatio?: number;
}
