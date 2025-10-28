/**
 * @jest-environment jsdom
 */

import {
  VisualizationPresets,
  createFFTPipeline,
  createAGCPipeline,
  createSpectrogramPipeline,
  createSimulatedSource,
  createVisualizationSetup,
  chainProcessors,
  createMetadata,
} from "../compositions";
import {
  FFTProcessor,
  AGCProcessor,
  SpectrogramProcessor,
} from "../processors";
import { SimulatedSource } from "../SimulatedSource";

// Type alias for processor-like objects
type ProcessorLike = { process: (input: unknown) => unknown };

describe("VisualizationPresets", () => {
  it("should define FM broadcast preset", () => {
    expect(VisualizationPresets.FMBroadcast).toMatchObject({
      sampleRate: 2048000,
      fftSize: 2048,
      windowFunction: "hann",
      bandwidth: 200000,
      centerFrequency: 98000000,
    });
  });

  it("should define AM broadcast preset", () => {
    expect(VisualizationPresets.AMBroadcast).toMatchObject({
      sampleRate: 1024000,
      fftSize: 1024,
      windowFunction: "hann",
      bandwidth: 10000,
      centerFrequency: 1000000,
    });
  });

  it("should define wideband scanner preset", () => {
    expect(VisualizationPresets.WidebandScanner).toMatchObject({
      sampleRate: 20000000,
      fftSize: 4096,
      windowFunction: "blackman",
    });
  });

  it("should define narrowband analysis preset", () => {
    expect(VisualizationPresets.NarrowbandAnalysis).toMatchObject({
      sampleRate: 256000,
      fftSize: 4096,
      windowFunction: "blackman",
    });
  });

  it("should define realtime monitoring preset", () => {
    expect(VisualizationPresets.RealtimeMonitoring).toMatchObject({
      sampleRate: 2048000,
      fftSize: 1024,
      windowFunction: "hann",
    });
  });
});

describe("createFFTPipeline", () => {
  it("should create FFT processor with defaults", () => {
    const processor = createFFTPipeline();
    expect(processor).toBeInstanceOf(FFTProcessor);

    const config = processor.getConfig();
    expect(config.type).toBe("fft");
    expect(config.fftSize).toBe(1024);
    expect(config.windowFunction).toBe("hann");
  });

  it("should create FFT processor with custom config", () => {
    const processor = createFFTPipeline({
      fftSize: 2048,
      windowFunction: "blackman",
      sampleRate: 1000000,
    });

    const config = processor.getConfig();
    expect(config.fftSize).toBe(2048);
    expect(config.windowFunction).toBe("blackman");
    expect(config.sampleRate).toBe(1000000);
  });

  it("should enable WASM by default", () => {
    const processor = createFFTPipeline();
    const config = processor.getConfig();
    expect(config.useWasm).toBe(true);
  });
});

describe("createAGCPipeline", () => {
  it("should create AGC processor with defaults", () => {
    const processor = createAGCPipeline();
    expect(processor).toBeInstanceOf(AGCProcessor);

    const config = processor.getConfig();
    expect(config.type).toBe("agc");
    expect(config.targetLevel).toBe(0.7);
    expect(config.attackTime).toBe(0.01);
    expect(config.decayTime).toBe(0.1);
    expect(config.maxGain).toBe(10.0);
  });

  it("should create AGC processor with custom config", () => {
    const processor = createAGCPipeline({
      targetLevel: 0.5,
      attackTime: 0.05,
      decayTime: 0.2,
      maxGain: 20.0,
    });

    const config = processor.getConfig();
    expect(config.targetLevel).toBe(0.5);
    expect(config.attackTime).toBe(0.05);
    expect(config.decayTime).toBe(0.2);
    expect(config.maxGain).toBe(20.0);
  });
});

describe("createSpectrogramPipeline", () => {
  it("should create spectrogram processor with defaults", () => {
    const processor = createSpectrogramPipeline();
    expect(processor).toBeInstanceOf(SpectrogramProcessor);

    const config = processor.getConfig();
    expect(config.type).toBe("spectrogram");
    expect(config.fftSize).toBe(1024);
    expect(config.hopSize).toBe(512); // 50% overlap
    expect(config.maxTimeSlices).toBe(100);
  });

  it("should create spectrogram processor with custom config", () => {
    const processor = createSpectrogramPipeline({
      fftSize: 2048,
      hopSize: 1024,
      maxTimeSlices: 200,
      sampleRate: 1000000,
    });

    const config = processor.getConfig();
    expect(config.fftSize).toBe(2048);
    expect(config.hopSize).toBe(1024);
    expect(config.maxTimeSlices).toBe(200);
    expect(config.sampleRate).toBe(1000000);
  });

  it("should calculate hop size as 50% of FFT size by default", () => {
    const processor = createSpectrogramPipeline({ fftSize: 4096 });
    const config = processor.getConfig();
    expect(config.hopSize).toBe(2048);
  });
});

describe("createSimulatedSource", () => {
  it("should create simulated source with defaults", () => {
    const source = createSimulatedSource();
    expect(source).toBeInstanceOf(SimulatedSource);

    const metadata = source.getMetadata();
    expect(metadata.sampleRate).toBe(2048000);
  });

  it("should create simulated source with custom config", () => {
    const source = createSimulatedSource({
      pattern: "fm",
      sampleRate: 1000000,
      amplitude: 0.5,
    });

    const metadata = source.getMetadata();
    expect(metadata.sampleRate).toBe(1000000);
  });

  it("should support all signal patterns", () => {
    const patterns = ["sine", "qpsk", "fm", "noise", "multi-tone"] as const;

    patterns.forEach((pattern) => {
      const source = createSimulatedSource({ pattern });
      expect(source).toBeInstanceOf(SimulatedSource);
    });
  });
});

describe("createVisualizationSetup", () => {
  it("should create setup with default preset", () => {
    const setup = createVisualizationSetup();

    expect(setup.source).toBeInstanceOf(SimulatedSource);
    expect(setup.fftProcessor).toBeUndefined();
    expect(setup.agcProcessor).toBeUndefined();
    expect(setup.spectrogramProcessor).toBeUndefined();
    expect(typeof setup.cleanup).toBe("function");
  });

  it("should create setup with FM broadcast preset", () => {
    const setup = createVisualizationSetup({
      preset: "FMBroadcast",
      pattern: "fm",
    });

    const metadata = setup.source.getMetadata();
    expect(metadata.sampleRate).toBe(2048000);
  });

  it("should create setup with FFT processor when enabled", () => {
    const setup = createVisualizationSetup({
      enableFFT: true,
    });

    expect(setup.fftProcessor).toBeInstanceOf(FFTProcessor);
  });

  it("should create setup with AGC processor when enabled", () => {
    const setup = createVisualizationSetup({
      enableAGC: true,
    });

    expect(setup.agcProcessor).toBeInstanceOf(AGCProcessor);
  });

  it("should create setup with spectrogram processor when enabled", () => {
    const setup = createVisualizationSetup({
      enableSpectrogram: true,
    });

    expect(setup.spectrogramProcessor).toBeInstanceOf(SpectrogramProcessor);
  });

  it("should create setup with all processors enabled", () => {
    const setup = createVisualizationSetup({
      preset: "RealtimeMonitoring",
      pattern: "sine",
      enableFFT: true,
      enableAGC: true,
      enableSpectrogram: true,
    });

    expect(setup.source).toBeInstanceOf(SimulatedSource);
    expect(setup.fftProcessor).toBeInstanceOf(FFTProcessor);
    expect(setup.agcProcessor).toBeInstanceOf(AGCProcessor);
    expect(setup.spectrogramProcessor).toBeInstanceOf(SpectrogramProcessor);
  });

  it("should allow custom sample rate and FFT size", () => {
    const setup = createVisualizationSetup({
      sampleRate: 1000000,
      fftSize: 2048,
      enableFFT: true,
    });

    const metadata = setup.source.getMetadata();
    expect(metadata.sampleRate).toBe(1000000);

    if (setup.fftProcessor) {
      const config = setup.fftProcessor.getConfig();
      expect(config.fftSize).toBe(2048);
      expect(config.sampleRate).toBe(1000000);
    }
  });

  it("should cleanup source when calling cleanup function", async () => {
    const setup = createVisualizationSetup();

    // Start streaming
    await setup.source.startStreaming(() => {
      // no-op callback
    });

    expect(setup.source.isStreaming()).toBe(true);

    // Cleanup
    await setup.cleanup();

    expect(setup.source.isStreaming()).toBe(false);
  });
});

describe("chainProcessors", () => {
  it("should chain AGC and FFT processors", () => {
    const agc = createAGCPipeline();
    const fft = createFFTPipeline({ fftSize: 256, sampleRate: 1000000 });

    const process = chainProcessors([
      agc as ProcessorLike,
      fft as ProcessorLike,
    ]);

    // Create test samples
    const samples = Array.from({ length: 256 }, (_, i) => ({
      I: Math.cos((2 * Math.PI * 1000 * i) / 1000000),
      Q: Math.sin((2 * Math.PI * 1000 * i) / 1000000),
    }));

    const result = process(samples);

    expect(result).toHaveProperty("magnitudes");
    expect(result).toHaveProperty("frequencies");
  });

  it("should pass data through single processor", () => {
    const fft = createFFTPipeline({ fftSize: 128, sampleRate: 1000000 });
    const process = chainProcessors([fft as ProcessorLike]);

    const samples = Array.from({ length: 128 }, (_, i) => ({
      I: Math.sin((2 * Math.PI * 1000 * i) / 1000000),
      Q: Math.cos((2 * Math.PI * 1000 * i) / 1000000),
    }));

    const result = process(samples) as {
      magnitudes: Float32Array;
      frequencies: Float32Array;
    };

    expect(result).toHaveProperty("magnitudes");
    expect(result.magnitudes.length).toBe(128);
  });

  it("should handle empty processor chain", () => {
    const process = chainProcessors([]);
    const input = [1, 2, 3];
    const result = process(input);

    expect(result).toEqual(input);
  });
});

describe("createMetadata", () => {
  it("should create metadata from config", () => {
    const metadata = createMetadata({
      sampleRate: 2048000,
      centerFrequency: 100000000,
      bandwidth: 200000,
    });

    expect(metadata).toMatchObject({
      name: "Configuration-derived source",
      sampleRate: 2048000,
      centerFrequency: 100000000,
      bandwidth: 200000,
      format: "IQ",
    });
  });

  it("should create metadata without optional fields", () => {
    const metadata = createMetadata({
      sampleRate: 1000000,
    });

    expect(metadata.name).toBe("Configuration-derived source");
    expect(metadata.sampleRate).toBe(1000000);
    expect(metadata["centerFrequency"]).toBeUndefined();
    expect(metadata["bandwidth"]).toBeUndefined();
    expect(metadata["format"]).toBe("IQ");
  });
});
