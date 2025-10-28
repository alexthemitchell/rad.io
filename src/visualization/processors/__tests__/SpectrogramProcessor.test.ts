import { SpectrogramProcessor } from "../SpectrogramProcessor";
import type { Sample } from "../../../utils/dsp";

/**
 * Generate a simple sine wave for testing
 */
function generateSineWave(
  frequency: number,
  sampleRate: number,
  numSamples: number,
): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * frequency * t;
    samples.push({
      I: Math.cos(phase),
      Q: Math.sin(phase),
    });
  }
  return samples;
}

describe("SpectrogramProcessor", () => {
  const sampleRate = 2048000;
  const fftSize = 512;
  const hopSize = 256;
  const maxTimeSlices = 100;

  const defaultConfig = {
    type: "spectrogram" as const,
    fftSize,
    hopSize,
    windowFunction: "hann" as const,
    useWasm: false,
    sampleRate,
    maxTimeSlices,
  };

  describe("constructor", () => {
    it("should create processor with valid config", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      expect(processor).toBeInstanceOf(SpectrogramProcessor);
      const config = processor.getConfig();
      expect(config.fftSize).toBe(fftSize);
      expect(config.hopSize).toBe(hopSize);
    });

    it("should throw error for non-power-of-2 fftSize", () => {
      expect(
        () =>
          new SpectrogramProcessor({
            ...defaultConfig,
            fftSize: 500,
          }),
      ).toThrow("must be a power of 2");
    });

    it("should throw error for hopSize > fftSize", () => {
      expect(
        () =>
          new SpectrogramProcessor({
            ...defaultConfig,
            hopSize: 1024,
          }),
      ).toThrow("hopSize must not exceed fftSize");
    });

    it("should throw error for non-positive sampleRate", () => {
      expect(
        () =>
          new SpectrogramProcessor({
            ...defaultConfig,
            sampleRate: 0,
          }),
      ).toThrow("sampleRate must be positive");
    });

    it("should throw error for non-positive maxTimeSlices", () => {
      expect(
        () =>
          new SpectrogramProcessor({
            ...defaultConfig,
            maxTimeSlices: 0,
          }),
      ).toThrow("maxTimeSlices must be a positive integer");
    });
  });

  describe("process", () => {
    it("should return empty output for insufficient samples", () => {
      const processor = new SpectrogramProcessor(defaultConfig);
      const samples = generateSineWave(10000, sampleRate, fftSize / 2);

      const output = processor.process(samples);

      expect(output.data).toHaveLength(0);
      expect(output.numTimeSlices).toBe(0);
    });

    it("should process samples and return spectrogram output", () => {
      const processor = new SpectrogramProcessor(defaultConfig);
      const samples = generateSineWave(10000, sampleRate, fftSize * 2);

      const output = processor.process(samples);

      expect(output.data.length).toBeGreaterThan(0);
      const firstRow = output.data[0];
      expect(firstRow).toBeInstanceOf(Float32Array);
      expect(firstRow?.length).toBe(fftSize);
      expect(output.frequencies).toBeInstanceOf(Float32Array);
      expect(output.times).toBeInstanceOf(Float32Array);
      expect(output.fftSize).toBe(fftSize);
      expect(output.numTimeSlices).toBe(output.data.length);
    });

    it("should compute correct number of time slices", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      // With hopSize=256 and fftSize=512:
      // For 1024 samples: (1024 - 512) / 256 + 1 = 3 frames
      const samples = generateSineWave(10000, sampleRate, 1024);
      const output = processor.process(samples);

      expect(output.numTimeSlices).toBe(3);
    });

    it("should accumulate time slices across multiple calls", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      const samples1 = generateSineWave(10000, sampleRate, fftSize * 2);
      const output1 = processor.process(samples1);
      const count1 = output1.numTimeSlices;

      const samples2 = generateSineWave(10000, sampleRate, fftSize * 2);
      const output2 = processor.process(samples2);
      const count2 = output2.numTimeSlices;

      expect(count2).toBeGreaterThan(count1);
    });

    it("should respect maxTimeSlices limit", () => {
      const processor = new SpectrogramProcessor({
        ...defaultConfig,
        maxTimeSlices: 10,
      });

      // Add many time slices
      for (let i = 0; i < 20; i++) {
        const samples = generateSineWave(10000, sampleRate, fftSize * 2);
        const output = processor.process(samples);

        // Should never exceed maxTimeSlices
        expect(output.numTimeSlices).toBeLessThanOrEqual(10);
      }

      const finalOutput = processor.process(
        generateSineWave(10000, sampleRate, fftSize * 2),
      );
      expect(finalOutput.numTimeSlices).toBe(10);
    });

    it("should work with different window functions", () => {
      const windowFunctions = [
        "rectangular",
        "hann",
        "hamming",
        "blackman",
        "kaiser",
      ] as const;

      for (const windowFunction of windowFunctions) {
        const processor = new SpectrogramProcessor({
          ...defaultConfig,
          windowFunction,
        });

        const samples = generateSineWave(10000, sampleRate, fftSize * 2);
        const output = processor.process(samples);

        expect(output.data.length).toBeGreaterThan(0);
        expect(output.data[0]?.length).toBe(fftSize);
      }
    });
  });

  describe("frequency and time binning", () => {
    it("should generate correct frequency bins", () => {
      const processor = new SpectrogramProcessor(defaultConfig);
      const samples = generateSineWave(10000, sampleRate, fftSize * 2);

      const output = processor.process(samples);

      const binWidth = sampleRate / fftSize;

      expect(output.frequencies[0]).toBe(0);
      expect(output.frequencies[1]).toBeCloseTo(binWidth);
      const lastFreq = output.frequencies[fftSize - 1];
      expect(lastFreq).toBeDefined();
      expect(lastFreq).toBeCloseTo((fftSize - 1) * binWidth);
    });

    it("should generate correct time bins", () => {
      const processor = new SpectrogramProcessor(defaultConfig);
      const samples = generateSineWave(10000, sampleRate, fftSize * 4);

      const output = processor.process(samples);

      const timeStep = hopSize / sampleRate;

      expect(output.times[0]).toBe(0);
      if (output.times.length > 1) {
        const time1 = output.times[1];
        expect(time1).toBeCloseTo(timeStep);
      }
    });
  });

  describe("config management", () => {
    it("should return config copy", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      const config1 = processor.getConfig();
      const config2 = processor.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it("should update config", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      processor.updateConfig({ windowFunction: "blackman" });

      const config = processor.getConfig();
      expect(config.windowFunction).toBe("blackman");
      expect(config.fftSize).toBe(fftSize); // Unchanged
    });

    it("should clear buffer when config changes", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      // Add some data
      const samples = generateSineWave(10000, sampleRate, fftSize * 2);
      processor.process(samples);

      expect(processor.getBufferSize()).toBeGreaterThan(0);

      // Update config
      processor.updateConfig({ windowFunction: "blackman" });

      // Buffer should be cleared
      expect(processor.getBufferSize()).toBe(0);
    });

    it("should validate config on update", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      expect(() => {
        processor.updateConfig({ fftSize: 500 });
      }).toThrow("must be a power of 2");
    });
  });

  describe("buffer management", () => {
    it("should clear buffer", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      const samples = generateSineWave(10000, sampleRate, fftSize * 2);
      processor.process(samples);

      expect(processor.getBufferSize()).toBeGreaterThan(0);

      processor.clear();

      expect(processor.getBufferSize()).toBe(0);
    });

    it("should return current buffer size", () => {
      const processor = new SpectrogramProcessor(defaultConfig);

      expect(processor.getBufferSize()).toBe(0);

      const samples = generateSineWave(10000, sampleRate, fftSize * 2);
      const output = processor.process(samples);

      expect(processor.getBufferSize()).toBe(output.numTimeSlices);
    });
  });

  describe("overlap processing", () => {
    it("should handle 50% overlap correctly", () => {
      const processor = new SpectrogramProcessor({
        ...defaultConfig,
        hopSize: fftSize / 2,
      });

      // Exact number of samples for 2 overlapping frames
      const samples = generateSineWave(10000, sampleRate, fftSize + hopSize);
      const output = processor.process(samples);

      // (samples.length - fftSize) / hopSize + 1 = (768 - 512) / 256 + 1 = 2
      expect(output.numTimeSlices).toBe(2);
    });

    it("should handle no overlap correctly", () => {
      const processor = new SpectrogramProcessor({
        ...defaultConfig,
        hopSize: fftSize,
      });

      const samples = generateSineWave(10000, sampleRate, fftSize * 3);
      const output = processor.process(samples);

      // (samples.length - fftSize) / hopSize + 1 = (1536 - 512) / 512 + 1 = 3
      expect(output.numTimeSlices).toBe(3);
    });

    it("should handle 75% overlap correctly", () => {
      const processor = new SpectrogramProcessor({
        ...defaultConfig,
        hopSize: fftSize / 4,
      });

      const samples = generateSineWave(10000, sampleRate, fftSize * 2);
      const output = processor.process(samples);

      // (1024 - 512) / 128 + 1 = 5
      expect(output.numTimeSlices).toBe(5);
    });
  });
});
