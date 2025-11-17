/**
 * Tests for Audio Resampler
 */

import {
  AudioResampler,
  LinearResampler,
  ResamplerQuality,
  createResampler,
} from "../audioResampler";

describe("LinearResampler", () => {
  describe("Constructor", () => {
    it("should create resampler with specified rates", () => {
      const resampler = new LinearResampler(48000, 44100);
      expect(resampler.getRatio()).toBeCloseTo(48000 / 44100, 5);
    });
  });

  describe("Resampling", () => {
    it("should downsample audio correctly", () => {
      const resampler = new LinearResampler(48000, 24000);
      const input = new Float32Array([1, 0, -1, 0, 1, 0, -1, 0]);
      const output = resampler.resample(input);

      expect(output.length).toBe(4); // 48000/24000 = 2:1 ratio
      expect(output[0]).toBeCloseTo(1, 1);
      expect(output[1]).toBeCloseTo(-1, 1);
    });

    it("should upsample audio correctly", () => {
      const resampler = new LinearResampler(24000, 48000);
      const input = new Float32Array([1, -1, 1, -1]);
      const output = resampler.resample(input);

      expect(output.length).toBe(8); // 24000/48000 = 1:2 ratio
    });

    it("should handle 1:1 ratio (no resampling)", () => {
      const resampler = new LinearResampler(48000, 48000);
      const input = new Float32Array([1, 0, -1, 0]);
      const output = resampler.resample(input);

      expect(output).toBe(input); // Should return same array
      expect(output.length).toBe(4);
    });

    it("should preserve DC offset", () => {
      const resampler = new LinearResampler(48000, 24000);
      const input = new Float32Array(100).fill(0.5);
      const output = resampler.resample(input);

      const mean = output.reduce((sum, val) => sum + val, 0) / output.length;
      expect(mean).toBeCloseTo(0.5, 1);
    });

    it("should handle empty input", () => {
      const resampler = new LinearResampler(48000, 24000);
      const input = new Float32Array(0);
      const output = resampler.resample(input);

      expect(output.length).toBe(0);
    });
  });

  describe("State management", () => {
    it("should reset state", () => {
      const resampler = new LinearResampler(48000, 24000);
      const input1 = new Float32Array([1, 0, -1, 0]);
      resampler.resample(input1);

      resampler.reset();

      const input2 = new Float32Array([1, 0, -1, 0]);
      const output2 = resampler.resample(input2);

      expect(output2.length).toBeGreaterThan(0);
    });
  });

  describe("Helper methods", () => {
    it("should calculate correct output length", () => {
      const resampler = new LinearResampler(48000, 24000);
      const expectedLength = resampler.getOutputLength(100);

      expect(expectedLength).toBe(50); // 2:1 ratio
    });
  });
});

describe("AudioResampler", () => {
  describe("Constructor", () => {
    it("should create resampler with specified quality", () => {
      const resampler = new AudioResampler(48000, 44100, ResamplerQuality.MEDIUM);
      expect(resampler.getRatio()).toBeCloseTo(48000 / 44100, 5);
      expect(resampler.getInputRate()).toBe(48000);
      expect(resampler.getOutputRate()).toBe(44100);
    });

    it("should use default quality if not specified", () => {
      const resampler = new AudioResampler(48000, 44100);
      expect(resampler.getRatio()).toBeCloseTo(48000 / 44100, 5);
    });
  });

  describe("Resampling", () => {
    it("should downsample audio with windowed sinc", () => {
      const resampler = new AudioResampler(
        48000,
        24000,
        ResamplerQuality.MEDIUM,
      );
      const input = new Float32Array(480).fill(0).map((_, i) =>
        Math.sin((2 * Math.PI * 1000 * i) / 48000),
      );
      const output = resampler.resample(input);

      expect(output.length).toBeGreaterThan(200);
      expect(output.length).toBeLessThan(250);
    });

    it("should handle 1:1 ratio (no resampling)", () => {
      const resampler = new AudioResampler(48000, 48000, ResamplerQuality.HIGH);
      const input = new Float32Array([1, 0, -1, 0]);
      const output = resampler.resample(input);

      expect(output).toBe(input); // Should return same array
    });
  });

  describe("Quality settings", () => {
    it("should work with LOW quality", () => {
      const resampler = new AudioResampler(48000, 24000, ResamplerQuality.LOW);
      const input = new Float32Array(100).fill(0.5);
      const output = resampler.resample(input);

      expect(output.length).toBeGreaterThan(0);
    });

    it("should work with HIGH quality", () => {
      const resampler = new AudioResampler(48000, 24000, ResamplerQuality.HIGH);
      const input = new Float32Array(100).fill(0.5);
      const output = resampler.resample(input);

      expect(output.length).toBeGreaterThan(0);
    });

    it("should work with VERY_HIGH quality", () => {
      const resampler = new AudioResampler(
        48000,
        24000,
        ResamplerQuality.VERY_HIGH,
      );
      const input = new Float32Array(100).fill(0.5);
      const output = resampler.resample(input);

      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("State management", () => {
    it("should reset state", () => {
      const resampler = new AudioResampler(48000, 24000, ResamplerQuality.MEDIUM);
      const input = new Float32Array(100).fill(0.5);
      resampler.resample(input);

      resampler.reset();

      const output = resampler.resample(input);
      expect(output.length).toBeGreaterThan(0);
    });
  });
});

describe("createResampler", () => {
  it("should create LinearResampler for small ratio", () => {
    const resampler = createResampler(48000, 44100);
    expect(resampler).toBeInstanceOf(LinearResampler);
  });

  it("should create LinearResampler when quality is LOW", () => {
    const resampler = createResampler(48000, 24000, ResamplerQuality.LOW);
    expect(resampler).toBeInstanceOf(LinearResampler);
  });

  it("should create AudioResampler for large ratio with quality", () => {
    const resampler = createResampler(48000, 8000, ResamplerQuality.MEDIUM);
    expect(resampler).toBeInstanceOf(AudioResampler);
  });
});
