/**
 * Core interfaces for the visualization module.
 * These interfaces establish clear separation of concerns between
 * data sources, processing, and rendering.
 */

import type { Sample } from "../utils/dsp";

export type { Sample };

/**
 * Data source interface for providing IQ samples to visualizations.
 * Implementations can be real hardware devices, simulated sources, or recorded data.
 */
export interface DataSource {
  /**
   * Start streaming data from the source.
   * @param callback Function to call with each batch of samples
   * @returns Promise that resolves when streaming starts
   */
  startStreaming(callback: (samples: Sample[]) => void): Promise<void>;

  /**
   * Stop streaming data from the source.
   * @returns Promise that resolves when streaming stops
   */
  stopStreaming(): Promise<void>;

  /**
   * Check if the source is currently streaming.
   */
  isStreaming(): boolean;

  /**
   * Get metadata about the data source.
   */
  getMetadata(): Promise<DataSourceMetadata>;
}

/**
 * Metadata about a data source.
 */
export interface DataSourceMetadata {
  /** Name of the data source */
  name: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Center frequency in Hz (if applicable) */
  centerFrequency?: number;
  /** Additional properties */
  [key: string]: unknown;
}

/**
 * Frame processor interface for transforming IQ samples into visualization data.
 * Examples: FFT computation, amplitude extraction, power spectral density calculation.
 */
export interface FrameProcessor<TInput, TOutput> {
  /**
   * Process a batch of input data into output data.
   * @param input The input data to process
   * @returns The processed output data
   */
  process(input: TInput): TOutput;

  /**
   * Get the configuration of this processor.
   */
  getConfig(): FrameProcessorConfig;

  /**
   * Update the configuration of this processor.
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<FrameProcessorConfig>): void;
}

/**
 * Configuration for frame processors.
 */
export interface FrameProcessorConfig {
  /** Processor type identifier */
  type: string;
  /** Additional configuration properties */
  [key: string]: unknown;
}

/**
 * Renderer interface for drawing visualization data to a canvas.
 * Implementations can use WebGL, WebGPU, Canvas2D, or workers.
 */
export interface Renderer<TData> {
  /**
   * Initialize the renderer with a canvas element.
   * @param canvas The canvas element to render to
   * @returns Promise that resolves when initialization is complete
   */
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;

  /**
   * Render data to the canvas.
   * @param data The data to render
   * @returns True if rendering was successful
   */
  render(data: TData): boolean;

  /**
   * Clean up renderer resources.
   */
  cleanup(): void;

  /**
   * Check if renderer is ready to render.
   */
  isReady(): boolean;

  /**
   * Get the name of this renderer (for debugging).
   */
  getName(): string;
}

/**
 * Combined visualization pipeline that connects a data source,
 * frame processor, and renderer.
 */
export interface VisualizationPipeline<TProcessed> {
  /**
   * Start the visualization pipeline.
   */
  start(): Promise<void>;

  /**
   * Stop the visualization pipeline.
   */
  stop(): Promise<void>;

  /**
   * Check if the pipeline is running.
   */
  isRunning(): boolean;

  /**
   * Get the data source.
   */
  getDataSource(): DataSource;

  /**
   * Get the frame processor.
   */
  getFrameProcessor(): FrameProcessor<Sample[], TProcessed>;

  /**
   * Get the renderer.
   */
  getRenderer(): Renderer<TProcessed>;
}
