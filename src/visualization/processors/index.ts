/**
 * Frame processors for visualization pipeline.
 * Transform IQ samples into visualization-ready data.
 */

export {
  FFTProcessor,
  type FFTProcessorConfig,
  type FFTOutput,
} from "./FFTProcessor";
export {
  AGCProcessor,
  type AGCProcessorConfig,
  type AGCOutput,
} from "./AGCProcessor";
export {
  SpectrogramProcessor,
  type SpectrogramProcessorConfig,
  type SpectrogramOutput,
} from "./SpectrogramProcessor";
