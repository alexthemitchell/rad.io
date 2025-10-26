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
export { ReplaySource } from "./ReplaySource";

// Visualization Components
export { default as IQConstellation } from "./components/IQConstellation";
export { default as Spectrogram } from "./components/Spectrogram";
export { default as WaveformVisualizer } from "./components/WaveformVisualizer";
export { default as FFTChart } from "./components/FFTChart";
