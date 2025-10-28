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

// Frame Processors
export { FFTProcessor, AGCProcessor, SpectrogramProcessor } from "./processors";
export type {
  FFTProcessorConfig,
  FFTOutput,
  AGCProcessorConfig,
  AGCOutput,
  SpectrogramProcessorConfig,
  SpectrogramOutput,
} from "./processors";

// Visualization Components
export { default as IQConstellation } from "./components/IQConstellation";
export type { IQConstellationProps } from "./components/IQConstellation";
export { default as Spectrogram } from "./components/Spectrogram";
export type { SpectrogramProps } from "./components/Spectrogram";
export { default as WaveformVisualizer } from "./components/WaveformVisualizer";
export type { WaveformVisualizerProps } from "./components/WaveformVisualizer";
export { default as FFTChart } from "./components/FFTChart";
export type { FFTChartProps } from "./components/FFTChart";
export { default as SpectrumExplorer } from "./components/SpectrumExplorer";
export type { SpectrumExplorerProps } from "./components/SpectrumExplorer";
export { default as Spectrum } from "./components/Spectrum";
export type { SpectrumProps } from "./components/Spectrum";
export { default as Waterfall } from "./components/Waterfall";
export type { WaterfallProps } from "./components/Waterfall";

// Renderers (for custom rendering or advanced use cases)
export {
  CanvasSpectrum,
  WebGLSpectrum,
  CanvasWaterfall,
  WebGLWaterfall,
} from "./renderers";
export type {
  SpectrumData,
  WaterfallData,
  RenderTransform,
} from "./renderers";
export { RendererTier } from "./renderers";

// Composition helpers and presets
export {
  VisualizationPresets,
  createFFTPipeline,
  createAGCPipeline,
  createSpectrogramPipeline,
  createSimulatedSource,
  createVisualizationSetup,
  chainProcessors,
  createMetadata,
} from "./compositions";
export type { VisualizationSetup } from "./compositions";
