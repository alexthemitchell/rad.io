/**
 * Visualization module - Clean interfaces for data sources, processors, and renderers.
 * This module provides a structured approach to visualization with decoupled components.
 */

// Core interfaces
export type {
  DataSource,
  DataSourceMetadata,
  FrameProcessor,
  FrameProcessorConfig,
  Renderer,
  VisualizationPipeline,
} from "./interfaces";

// Implementations
export { SimulatedSource } from "./SimulatedSource";
export type { SimulatedSourceConfig } from "./SimulatedSource";
