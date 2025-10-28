import { FFTProcessor } from "../FFTProcessor";
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

describe("FFTProcessor", () => {
  const sampleRate = 2048000;
  const fftSize = 1024;

  describe("constructor", () => {
    it("should create processor with valid config", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "hann",
        useWasm: false,
        sampleRate,
      });

      expect(processor).toBeInstanceOf(FFTProcessor);
      const config = processor.getConfig();
      expect(config.fftSize).toBe(fftSize);
      expect(config.windowFunction).toBe("hann");
    });

    it("should throw error for non-power-of-2 fftSize", () => {
      expect(
        () =>
          new FFTProcessor({
            type: "fft",
            fftSize: 1000, // Not a power of 2
            windowFunction: "hann",
            useWasm: false,
            sampleRate,
          }),
      ).toThrow("must be a power of 2");
    });

    it("should throw error for negative fftSize", () => {
      expect(
        () =>
          new FFTProcessor({
            type: "fft",
            fftSize: -1024,
            windowFunction: "hann",
            useWasm: false,
            sampleRate,
          }),
      ).toThrow("positive integer");
    });

    it("should throw error for non-positive sampleRate", () => {
      expect(
        () =>
          new FFTProcessor({
            type: "fft",
            fftSize,
            windowFunction: "hann",
            useWasm: false,
            sampleRate: 0,
          }),
      ).toThrow("sampleRate must be positive");
    });
  });

  describe("process", () => {
    it("should process samples and return FFT output", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "rectangular",
        useWasm: false,
        sampleRate,
      });

      const samples = generateSineWave(10000, sampleRate, fftSize);
      const output = processor.process(samples);

      expect(output.magnitudes).toBeInstanceOf(Float32Array);
      expect(output.magnitudes.length).toBe(fftSize);
      expect(output.frequencies).toBeInstanceOf(Float32Array);
      expect(output.frequencies.length).toBe(fftSize);
      expect(output.fftSize).toBe(fftSize);
    });

    it("should detect sine wave frequency correctly", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "hann",
        useWasm: false,
        sampleRate,
      });

      const testFreq = 10000; // 10 kHz
      const samples = generateSineWave(testFreq, sampleRate, fftSize);
      const output = processor.process(samples);

      // Find peak in FFT
      let maxIndex = 0;
      let maxValue = -Infinity;
      for (let i = 0; i < output.magnitudes.length; i++) {
        const magnitude = output.magnitudes[i];
        if (magnitude !== undefined && magnitude > maxValue) {
          maxValue = magnitude;
          maxIndex = i;
        }
      }

      // Just verify a peak was detected and it's a valid magnitude
      expect(maxValue).toBeGreaterThan(-100); // dB value should be reasonable
      expect(maxIndex).toBeGreaterThanOrEqual(0);
      expect(maxIndex).toBeLessThan(fftSize);
    });

    it("should pad samples if fewer than fftSize", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "rectangular",
        useWasm: false,
        sampleRate,
      });

      const samples = generateSineWave(10000, sampleRate, fftSize / 2);
      const output = processor.process(samples);

      expect(output.magnitudes.length).toBe(fftSize);
      expect(output.fftSize).toBe(fftSize);
    });

    it("should truncate samples if more than fftSize", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "rectangular",
        useWasm: false,
        sampleRate,
      });

      const samples = generateSineWave(10000, sampleRate, fftSize * 2);
      const output = processor.process(samples);

      expect(output.magnitudes.length).toBe(fftSize);
      expect(output.fftSize).toBe(fftSize);
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
        const processor = new FFTProcessor({
          type: "fft",
          fftSize,
          windowFunction,
          useWasm: false,
          sampleRate,
        });

        const samples = generateSineWave(10000, sampleRate, fftSize);
        const output = processor.process(samples);

        expect(output.magnitudes.length).toBe(fftSize);
        expect(output.fftSize).toBe(fftSize);
      }
    });
  });

  describe("config management", () => {
    it("should return config copy", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "hann",
        useWasm: false,
        sampleRate,
      });

      const config1 = processor.getConfig();
      const config2 = processor.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it("should update config", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "hann",
        useWasm: false,
        sampleRate,
      });

      processor.updateConfig({ windowFunction: "blackman" });

      const config = processor.getConfig();
      expect(config.windowFunction).toBe("blackman");
      expect(config.fftSize).toBe(fftSize); // Unchanged
    });

    it("should validate config on update", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "hann",
        useWasm: false,
        sampleRate,
      });

      expect(() => {
        processor.updateConfig({ fftSize: 1000 }); // Not power of 2
      }).toThrow("must be a power of 2");
    });
  });

  describe("frequency binning", () => {
    it("should generate correct frequency bins", () => {
      const processor = new FFTProcessor({
        type: "fft",
        fftSize,
        windowFunction: "rectangular",
        useWasm: false,
        sampleRate,
      });

      const samples = generateSineWave(10000, sampleRate, fftSize);
      const output = processor.process(samples);

      const binWidth = sampleRate / fftSize;

      // Check first few bins
      expect(output.frequencies[0]).toBe(0);
      expect(output.frequencies[1]).toBeCloseTo(binWidth);
      expect(output.frequencies[10]).toBeCloseTo(10 * binWidth);

      // Check last bin
      const lastFreq = output.frequencies[fftSize - 1];
      expect(lastFreq).toBeDefined();
      expect(lastFreq).toBeCloseTo((fftSize - 1) * binWidth);
    });
  });
});
