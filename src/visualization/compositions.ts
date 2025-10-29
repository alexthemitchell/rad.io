/**
 * Composition helpers for creating common visualization patterns
 *
 * This module provides factory functions and utilities to easily compose
 * data sources, processors, and visualizations for common SDR use cases.
 *
 * @example
 * ```typescript
 * // Create a complete waterfall display with simulated data
 * const config = createWaterfallPipeline({
 *   pattern: 'fm',
 *   sampleRate: 2048000,
 *   fftSize: 1024,
 * });
 *
 * // Use in your React component
 * <Waterfall frames={config.frames} width={900} height={600} />
 * ```
 */

import { FFTProcessor, AGCProcessor, SpectrogramProcessor } from "./processors";
import { SimulatedSource } from "./SimulatedSource";
import type { DataSource, DataSourceMetadata } from "./interfaces";
import type {
  FFTProcessorConfig,
  AGCProcessorConfig,
  SpectrogramProcessorConfig,
} from "./processors";
import type { SimulatedSourceConfig } from "./SimulatedSource";

/**
 * Configuration presets for common SDR use cases
 */
export const VisualizationPresets = {
  /**
   * FM broadcast receiver (88-108 MHz)
   * - Wide bandwidth for stereo audio
   * - High FFT resolution for station separation
   */
  FMBroadcast: {
    sampleRate: 2048000,
    fftSize: 2048,
    windowFunction: "hann" as const,
    bandwidth: 200000,
    centerFrequency: 98000000,
  },

  /**
   * AM broadcast receiver (530-1700 kHz)
   * - Narrower bandwidth
   * - Lower sample rate
   */
  AMBroadcast: {
    sampleRate: 1024000,
    fftSize: 1024,
    windowFunction: "hann" as const,
    bandwidth: 10000,
    centerFrequency: 1000000,
  },

  /**
   * Wideband spectrum scanner
   * - High sample rate for wide coverage
   * - Large FFT for detailed view
   */
  WidebandScanner: {
    sampleRate: 20000000,
    fftSize: 4096,
    windowFunction: "blackman" as const,
    bandwidth: 20000000,
    centerFrequency: 100000000,
  },

  /**
   * Narrowband signal analysis
   * - High resolution for weak signals
   * - Longer integration time
   */
  NarrowbandAnalysis: {
    sampleRate: 256000,
    fftSize: 4096,
    windowFunction: "blackman" as const,
    bandwidth: 25000,
    centerFrequency: 433920000,
  },

  /**
   * Real-time spectrum monitoring
   * - Balanced performance and detail
   * - Fast update rate
   */
  RealtimeMonitoring: {
    sampleRate: 2048000,
    fftSize: 1024,
    windowFunction: "hann" as const,
    bandwidth: 2000000,
    centerFrequency: 100000000,
  },
} as const;

/**
 * Create a complete FFT processing pipeline with sensible defaults
 *
 * @param config - FFT configuration (uses RealtimeMonitoring preset if not specified)
 * @returns Configured FFT processor
 *
 * @example
 * ```typescript
 * const fftProcessor = createFFTPipeline({
 *   fftSize: 2048,
 *   windowFunction: 'hann',
 *   useWasm: true,
 *   sampleRate: 2048000,
 * });
 *
 * const output = fftProcessor.process(samples);
 * ```
 */
export function createFFTPipeline(
  config?: Partial<FFTProcessorConfig>,
): FFTProcessor {
  const defaults = VisualizationPresets.RealtimeMonitoring;

  return new FFTProcessor({
    type: "fft",
    fftSize: config?.fftSize ?? defaults.fftSize,
    windowFunction: config?.windowFunction ?? defaults.windowFunction,
    useWasm: config?.useWasm ?? true,
    sampleRate: config?.sampleRate ?? defaults.sampleRate,
  });
}

/**
 * Create an AGC processor with sensible defaults for SDR applications
 *
 * @param config - AGC configuration
 * @returns Configured AGC processor
 *
 * @example
 * ```typescript
 * const agc = createAGCPipeline({
 *   targetLevel: 0.7,
 *   attackTime: 0.01,
 *   decayTime: 0.1,
 * });
 *
 * const normalized = agc.process(samples);
 * ```
 */
export function createAGCPipeline(
  config?: Partial<AGCProcessorConfig>,
): AGCProcessor {
  return new AGCProcessor({
    type: "agc",
    targetLevel: config?.targetLevel ?? 0.7,
    attackTime: config?.attackTime ?? 0.01,
    decayTime: config?.decayTime ?? 0.1,
    maxGain: config?.maxGain ?? 10.0,
  });
}

/**
 * Create a spectrogram processor with sensible defaults
 *
 * @param config - Spectrogram configuration
 * @returns Configured spectrogram processor
 *
 * @example
 * ```typescript
 * const spectrogram = createSpectrogramPipeline({
 *   fftSize: 1024,
 *   hopSize: 512,
 *   maxTimeSlices: 100,
 * });
 *
 * const output = spectrogram.process(samples);
 * ```
 */
export function createSpectrogramPipeline(
  config?: Partial<SpectrogramProcessorConfig>,
): SpectrogramProcessor {
  const defaults = VisualizationPresets.RealtimeMonitoring;

  return new SpectrogramProcessor({
    type: "spectrogram",
    fftSize: config?.fftSize ?? defaults.fftSize,
    hopSize:
      config?.hopSize ?? Math.floor((config?.fftSize ?? defaults.fftSize) / 2),
    windowFunction: config?.windowFunction ?? defaults.windowFunction,
    useWasm: config?.useWasm ?? true,
    sampleRate: config?.sampleRate ?? defaults.sampleRate,
    maxTimeSlices: config?.maxTimeSlices ?? 100,
  });
}

/**
 * Create a simulated data source with a specific signal pattern
 *
 * @param config - Simulated source configuration
 * @returns Configured simulated source
 *
 * @example
 * ```typescript
 * const source = createSimulatedSource({
 *   pattern: 'fm',
 *   sampleRate: 2048000,
 *   amplitude: 0.8,
 * });
 *
 * await source.startStreaming((samples) => {
 *   // Handle samples
 * });
 * ```
 */
export function createSimulatedSource(
  config?: Partial<SimulatedSourceConfig>,
): SimulatedSource {
  const defaults = VisualizationPresets.RealtimeMonitoring;

  return new SimulatedSource({
    pattern: config?.pattern ?? "sine",
    sampleRate: config?.sampleRate ?? defaults.sampleRate,
    amplitude: config?.amplitude ?? 0.8,
    updateInterval: config?.updateInterval ?? 50,
    samplesPerUpdate: config?.samplesPerUpdate ?? 2048,
    centerFrequency: config?.centerFrequency ?? defaults.centerFrequency,
  });
}

/**
 * Configuration for a complete visualization setup
 */
export interface VisualizationSetup<T extends DataSource = DataSource> {
  /** Data source providing IQ samples */
  source: T;
  /** Optional FFT processor */
  fftProcessor?: FFTProcessor;
  /** Optional AGC processor */
  agcProcessor?: AGCProcessor;
  /** Optional spectrogram processor */
  spectrogramProcessor?: SpectrogramProcessor;
  /** Cleanup function to stop streaming and release resources */
  cleanup: () => Promise<void>;
}

/**
 * Create a complete visualization setup with data source and processors
 *
 * This is a high-level factory that creates a full pipeline including:
 * - Simulated data source
 * - Optional AGC for signal normalization
 * - Optional FFT processor for frequency analysis
 * - Optional spectrogram processor for time-frequency analysis
 *
 * @param options - Configuration options
 * @returns Complete visualization setup with cleanup function
 *
 * @example
 * ```typescript
 * const setup = await createVisualizationSetup({
 *   preset: 'FMBroadcast',
 *   pattern: 'fm',
 *   enableAGC: true,
 *   enableFFT: true,
 * });
 *
 * // Start streaming
 * await setup.source.startStreaming((samples) => {
 *   if (setup.agcProcessor) {
 *     const normalized = setup.agcProcessor.process(samples);
 *     samples = normalized.samples;
 *   }
 *
 *   if (setup.fftProcessor) {
 *     const spectrum = setup.fftProcessor.process(samples);
 *     // Update visualization
 *   }
 * });
 *
 * // When done
 * await setup.cleanup();
 * ```
 */
export function createVisualizationSetup<
  T extends DataSource = SimulatedSource,
>(options?: {
  /** Use a preset configuration */
  preset?: keyof typeof VisualizationPresets;
  /** Custom data source. If not provided, a simulated source will be created. */
  source?: T;
  /** Signal pattern for simulated source (only used if no custom source is provided) */
  pattern?: SimulatedSourceConfig["pattern"];
  /** Enable AGC processing */
  enableAGC?: boolean;
  /** Enable FFT processing */
  enableFFT?: boolean;
  /** Enable spectrogram processing */
  enableSpectrogram?: boolean;
  /** Custom sample rate (overrides preset) */
  sampleRate?: number;
  /** Custom FFT size (overrides preset) */
  fftSize?: number;
}): VisualizationSetup<T> {
  const presetConfig = options?.preset
    ? VisualizationPresets[options.preset]
    : VisualizationPresets.RealtimeMonitoring;

  const sampleRate = options?.sampleRate ?? presetConfig.sampleRate;
  const fftSize = options?.fftSize ?? presetConfig.fftSize;

  // Create data source
  const source =
    options?.source ??
    (createSimulatedSource({
      pattern: options?.pattern ?? "sine",
      sampleRate,
      samplesPerUpdate: fftSize,
    }) as unknown as T);

  // Create processors based on options
  const fftProcessor = options?.enableFFT
    ? createFFTPipeline({ fftSize, sampleRate })
    : undefined;

  const agcProcessor = options?.enableAGC ? createAGCPipeline() : undefined;

  const spectrogramProcessor = options?.enableSpectrogram
    ? createSpectrogramPipeline({ fftSize, sampleRate })
    : undefined;

  return {
    source,
    fftProcessor,
    agcProcessor,
    spectrogramProcessor,
    /**
     * Cleanup function to stop streaming and release resources.
     * Note: Processors (FFTProcessor, AGCProcessor, SpectrogramProcessor) are stateless
     * and do not require explicit cleanup. They can be safely discarded after use.
     */
    cleanup: async (): Promise<void> => {
      await source.stopStreaming();
    },
  };
}

/**
 * Utility to chain multiple frame processors
 *
 * Chains processors in sequence, automatically extracting the `samples` property
 * from intermediate results when present. This allows chaining processors that
 * return complex objects (like AGC which returns {samples, currentGain}) with
 * processors that expect simple sample arrays (like FFT).
 *
 * @param processors - Array of processors to chain
 * @returns A function that processes data through all processors in sequence
 *
 * @example
 * ```typescript
 * const agc = createAGCPipeline();
 * const fft = createFFTPipeline();
 *
 * // Create a chain that normalizes then computes FFT
 * const process = chainProcessors([agc, fft]);
 *
 * // Process samples
 * const result = process(samples);
 * ```
 *
 * @remarks
 * If a processor returns an object with a `samples` property, that property
 * will be automatically extracted and passed to the next processor. This enables
 * seamless chaining of processors with different output formats. If you need
 * access to the full output of an intermediate processor, process them separately.
 */
export function chainProcessors(
  processors: Array<{ process: (input: unknown) => unknown }>,
): (input: unknown) => unknown {
  return (input: unknown): unknown => {
    let result: unknown = input;
    for (const processor of processors) {
      result = processor.process(result);
      // If processor returns an object with samples, use that for next step
      if (result && typeof result === "object" && "samples" in result) {
        result = result.samples;
      }
    }
    return result;
  };
}

/**
 * Create a metadata object from visualization configuration
 *
 * @param config - Configuration to derive metadata from
 * @returns Data source metadata
 */
export function createMetadata(config: {
  sampleRate: number;
  centerFrequency?: number;
  bandwidth?: number;
}): DataSourceMetadata {
  return {
    name: "Configuration-derived source",
    sampleRate: config.sampleRate,
    centerFrequency: config.centerFrequency,
    bandwidth: config.bandwidth,
    format: "IQ" as const,
  };
}
