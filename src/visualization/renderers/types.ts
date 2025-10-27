/**
 * Common types for visualization renderers
 */

/**
 * Transform state for pan and zoom
 */
export interface RenderTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/**
 * Base renderer interface
 */
export interface Renderer {
  /**
   * Initialize the renderer (setup GL context, compile shaders, etc.)
   */
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;

  /**
   * Check if renderer is ready to render
   */
  isReady(): boolean;

  /**
   * Render the visualization
   */
  render(data: unknown): boolean;

  /**
   * Clean up resources
   */
  cleanup(): void;
}

/**
 * Spectrum data for rendering
 */
export interface SpectrumData {
  /** FFT magnitude values in dB */
  magnitudes: Float32Array;
  /** Minimum frequency bin index */
  freqMin: number;
  /** Maximum frequency bin index */
  freqMax: number;
  /** Optional transform for pan/zoom */
  transform?: RenderTransform;
}

/**
 * Waterfall data for rendering
 */
export interface WaterfallData {
  /** Array of FFT frames (each frame is magnitude values in dB) */
  frames: Float32Array[];
  /** Minimum frequency bin index */
  freqMin: number;
  /** Maximum frequency bin index */
  freqMax: number;
  /** Optional transform for pan/zoom */
  transform?: RenderTransform;
}

/**
 * Renderer tier for fallback logic
 */
export enum RendererTier {
  WebGL2 = "webgl2",
  WebGL1 = "webgl1",
  Canvas2D = "canvas2d",
}
