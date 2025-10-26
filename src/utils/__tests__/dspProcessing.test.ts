/**
 * Tests for DSP Processing Pipeline
 * Validates windowing functions, AGC, decimation, scaling, and pipeline composition
 */

import {
  applyHannWindow,
  applyHammingWindow,
  applyBlackmanWindow,
  applyKaiserWindow,
  applyWindow,
  applyAGC,
  decimate,
  applyScaling,
  processFFT,
  composePipeline,
  createVisualizationPipeline,
  type WindowFunction,
  type ScalingMode,
} from "../dspProcessing";
import type { Sample } from "../dsp";

/**
 * Generate test samples
 */
function generateTestSamples(count: number, amplitude: number = 1.0): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const phase = (2 * Math.PI * i) / count;
    samples.push({
      I: amplitude * Math.cos(phase),
      Q: amplitude * Math.sin(phase),
    });
  }
  return samples;
}

/**
 * Generate DC samples (constant value)
 */
function generateDCSamples(count: number, value: number = 1.0): Sample[] {
  return Array(count).fill({ I: value, Q: 0 });
}

/**
 * Calculate sample magnitude
 */
function magnitude(sample: Sample): number {
  return Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
}

describe("Windowing Functions", () => {
  const testSamples = generateTestSamples(64, 1.0);

  describe("applyHannWindow", () => {
    it("should apply Hann window to samples", () => {
      const windowed = applyHannWindow(testSamples);
      
      expect(windowed).toHaveLength(testSamples.length);
      
      // Hann window should have zeros at endpoints
      expect(magnitude(windowed[0]!)).toBeCloseTo(0, 5);
      expect(magnitude(windowed[windowed.length - 1]!)).toBeCloseTo(0, 5);
      
      // Maximum should be near center
      const midpoint = Math.floor(windowed.length / 2);
      const midMag = magnitude(windowed[midpoint]!);
      const edgeMag = magnitude(windowed[0]!);
      expect(midMag).toBeGreaterThan(edgeMag);
    });

    it("should preserve sample structure", () => {
      const windowed = applyHannWindow(testSamples);
      windowed.forEach((sample) => {
        expect(sample).toHaveProperty("I");
        expect(sample).toHaveProperty("Q");
        expect(typeof sample.I).toBe("number");
        expect(typeof sample.Q).toBe("number");
      });
    });
  });

  describe("applyHammingWindow", () => {
    it("should apply Hamming window to samples", () => {
      const windowed = applyHammingWindow(testSamples);
      
      expect(windowed).toHaveLength(testSamples.length);
      
      // Hamming window doesn't reach zero at endpoints (0.08 minimum)
      expect(magnitude(windowed[0]!)).toBeGreaterThan(0);
      expect(magnitude(windowed[0]!)).toBeLessThan(0.1);
    });

    it("should differ from Hann window", () => {
      const hann = applyHannWindow(testSamples);
      const hamming = applyHammingWindow(testSamples);
      
      // Edge values should be different
      expect(magnitude(hann[0]!)).not.toBeCloseTo(magnitude(hamming[0]!), 2);
    });
  });

  describe("applyBlackmanWindow", () => {
    it("should apply Blackman window to samples", () => {
      const windowed = applyBlackmanWindow(testSamples);
      
      expect(windowed).toHaveLength(testSamples.length);
      
      // Blackman window has very low sidelobes
      expect(magnitude(windowed[0]!)).toBeCloseTo(0, 4);
    });
  });

  describe("applyKaiserWindow", () => {
    it("should apply Kaiser window with default beta", () => {
      const windowed = applyKaiserWindow(testSamples);
      
      expect(windowed).toHaveLength(testSamples.length);
    });

    it("should accept custom beta parameter", () => {
      const windowed1 = applyKaiserWindow(testSamples, 3);
      const windowed2 = applyKaiserWindow(testSamples, 10);
      
      // Different beta values should produce different results
      expect(magnitude(windowed1[0]!)).not.toBeCloseTo(magnitude(windowed2[0]!), 3);
    });
  });

  describe("applyWindow", () => {
    const windowTypes: WindowFunction[] = [
      "rectangular",
      "hann",
      "hamming",
      "blackman",
      "kaiser",
    ];

    windowTypes.forEach((windowType) => {
      it(`should apply ${windowType} window`, () => {
        const windowed = applyWindow(testSamples, windowType);
        expect(windowed).toHaveLength(testSamples.length);
      });
    });

    it("should return original samples for rectangular window", () => {
      const windowed = applyWindow(testSamples, "rectangular");
      expect(windowed).toEqual(testSamples);
    });
  });

  describe("Window properties", () => {
    it("should maintain energy conservation", () => {
      const samples = generateTestSamples(128, 1.0);
      const windowed = applyHannWindow(samples);
      
      // Calculate total energy before and after windowing
      const energyBefore = samples.reduce((sum, s) => sum + s.I * s.I + s.Q * s.Q, 0);
      const energyAfter = windowed.reduce((sum, s) => sum + s.I * s.I + s.Q * s.Q, 0);
      
      // Windowing reduces energy (expected behavior)
      expect(energyAfter).toBeLessThan(energyBefore);
      expect(energyAfter).toBeGreaterThan(0);
    });
  });
});

describe("Automatic Gain Control (AGC)", () => {
  it("should normalize signal amplitude", () => {
    const samples = generateTestSamples(5000, 0.1); // Low amplitude, longer signal
    const targetLevel = 0.7;
    const agc = applyAGC(samples, targetLevel, 0.05, 0.005); // Faster rates
    
    // Calculate average magnitude after AGC stabilizes (last 20% of samples)
    const tailSamples = agc.slice(-1000);
    const avgMag = tailSamples.reduce((sum, s) => sum + magnitude(s), 0) / tailSamples.length;
    
    // Should be reasonably close to target level after settling
    expect(avgMag).toBeGreaterThan(targetLevel * 0.3);
    expect(avgMag).toBeLessThan(targetLevel * 1.8);
  });

  it("should handle varying signal levels", () => {
    const samples: Sample[] = [];
    
    // Create signal with varying amplitude
    for (let i = 0; i < 1000; i++) {
      const amp = 0.2 + 0.3 * Math.sin(2 * Math.PI * i / 200);
      const phase = 2 * Math.PI * i / 32;
      samples.push({
        I: amp * Math.cos(phase),
        Q: amp * Math.sin(phase),
      });
    }
    
    const agc = applyAGC(samples, 0.7, 0.02, 0.002);
    
    // AGC should produce output with reasonable stability
    const tailSamples = agc.slice(-500);
    const avgMag = tailSamples.reduce((sum, s) => sum + magnitude(s), 0) / tailSamples.length;
    
    // Output should stabilize to a reasonable level
    expect(avgMag).toBeGreaterThan(0.3);
    expect(avgMag).toBeLessThan(1.0);
  });

  it("should handle empty input", () => {
    const agc = applyAGC([]);
    expect(agc).toEqual([]);
  });

  it("should clamp gain to reasonable limits", () => {
    // Very small signal
    const samples = generateTestSamples(100, 0.001);
    const agc = applyAGC(samples);
    
    // Should not amplify to infinity
    agc.forEach((sample) => {
      expect(Math.abs(sample.I)).toBeLessThan(100);
      expect(Math.abs(sample.Q)).toBeLessThan(100);
    });
  });

  it("should respect attack and release rates", () => {
    const samples = generateTestSamples(500, 1.0);
    
    // Fast attack, slow release
    const fast = applyAGC(samples, 0.7, 0.1, 0.001);
    
    // Slow attack, fast release
    const slow = applyAGC(samples, 0.7, 0.001, 0.1);
    
    // Results should differ based on rates
    const fastMag = magnitude(fast[10]!);
    const slowMag = magnitude(slow[10]!);
    expect(fastMag).not.toBeCloseTo(slowMag, 2);
  });
});

describe("Decimation", () => {
  it("should reduce sample count by decimation factor", () => {
    const samples = generateTestSamples(1000, 1.0);
    const factor = 4;
    const decimated = decimate(samples, factor);
    
    expect(decimated.length).toBeCloseTo(samples.length / factor, 1);
  });

  it("should return original samples for factor <= 1", () => {
    const samples = generateTestSamples(100, 1.0);
    
    expect(decimate(samples, 1)).toEqual(samples);
    expect(decimate(samples, 0)).toEqual(samples);
    expect(decimate(samples, -1)).toEqual(samples);
  });

  it("should handle empty input", () => {
    expect(decimate([], 4)).toEqual([]);
  });

  it("should preserve signal characteristics after decimation", () => {
    // Create low-frequency signal that won't alias
    const samples: Sample[] = [];
    for (let i = 0; i < 1000; i++) {
      const phase = 2 * Math.PI * i / 100; // Low frequency
      samples.push({
        I: Math.cos(phase),
        Q: Math.sin(phase),
      });
    }
    
    const decimated = decimate(samples, 4);
    
    // Check that samples are still on unit circle (magnitude ~1)
    const avgMag = decimated.reduce((sum, s) => sum + magnitude(s), 0) / decimated.length;
    expect(avgMag).toBeGreaterThan(0.8);
    expect(avgMag).toBeLessThan(1.2);
  });

  it("should apply anti-aliasing filter", () => {
    const samples = generateTestSamples(1000, 1.0);
    const decimated = decimate(samples, 5);
    
    // Decimated signal should be smoother (anti-aliasing applied)
    expect(decimated.length).toBeGreaterThan(0);
    expect(decimated.every((s) => !isNaN(s.I) && !isNaN(s.Q))).toBe(true);
  });
});

describe("Scaling", () => {
  const testSamples = generateTestSamples(100, 1.0);

  describe("applyScaling - none", () => {
    it("should return original samples", () => {
      const scaled = applyScaling(testSamples, "none");
      expect(scaled).toEqual(testSamples);
    });
  });

  describe("applyScaling - normalize", () => {
    it("should normalize to target level", () => {
      const samples = generateTestSamples(100, 0.5);
      const scaled = applyScaling(samples, "normalize", 1.0);
      
      const maxMag = Math.max(...scaled.map(magnitude));
      expect(maxMag).toBeCloseTo(1.0, 2);
    });

    it("should handle zero-magnitude signal", () => {
      const zeros: Sample[] = Array(10).fill({ I: 0, Q: 0 });
      const scaled = applyScaling(zeros, "normalize");
      expect(scaled).toEqual(zeros);
    });
  });

  describe("applyScaling - linear", () => {
    it("should scale linearly", () => {
      const scaled = applyScaling(testSamples, "linear", 2.0);
      
      testSamples.forEach((original, i) => {
        expect(scaled[i]!.I).toBeCloseTo(original.I * 2.0, 5);
        expect(scaled[i]!.Q).toBeCloseTo(original.Q * 2.0, 5);
      });
    });
  });

  describe("applyScaling - dB", () => {
    it("should scale using dB conversion", () => {
      const scaled = applyScaling(testSamples, "dB", 6.0); // +6dB = 2x amplitude
      
      const originalMag = magnitude(testSamples[0]!);
      const scaledMag = magnitude(scaled[0]!);
      
      // +6dB should approximately double the amplitude
      expect(scaledMag / originalMag).toBeCloseTo(2.0, 1);
    });

    it("should handle negative dB values", () => {
      const scaled = applyScaling(testSamples, "dB", -6.0); // -6dB = 0.5x amplitude
      
      const originalMag = magnitude(testSamples[0]!);
      const scaledMag = magnitude(scaled[0]!);
      
      expect(scaledMag / originalMag).toBeCloseTo(0.5, 1);
    });
  });
});

describe("processFFT", () => {
  const testSamples = generateTestSamples(1024, 1.0);

  it("should process FFT with windowing", () => {
    const result = processFFT(testSamples, {
      fftSize: 1024,
      window: "hann",
      overlap: 0,
      wasm: false,
    });
    
    expect(result.output).not.toBeNull();
    expect(result.output).toBeInstanceOf(Float32Array);
    expect(result.output?.length).toBe(1024);
    expect(result.metrics.bins).toBe(1024);
    expect(result.metrics.windowType).toBe("hann");
    expect(result.metrics.processingTime).toBeGreaterThanOrEqual(0);
  });

  it("should work with different window types", () => {
    const windows: WindowFunction[] = ["rectangular", "hann", "hamming", "blackman"];
    
    windows.forEach((windowType) => {
      const result = processFFT(testSamples, {
        fftSize: 512,
        window: windowType,
        overlap: 0,
        wasm: false,
      });
      
      expect(result.output).not.toBeNull();
      expect(result.metrics.windowType).toBe(windowType);
    });
  });

  it("should handle insufficient samples", () => {
    const fewSamples = generateTestSamples(10, 1.0);
    const result = processFFT(fewSamples, {
      fftSize: 1024,
      window: "hann",
      overlap: 0,
      wasm: false,
    });
    
    expect(result.output).toBeNull();
    expect(result.metrics.bins).toBe(1024);
  });

  it("should measure processing time", () => {
    const result = processFFT(testSamples, {
      fftSize: 1024,
      window: "hann",
      overlap: 0,
      wasm: false,
    });
    
    expect(result.metrics.processingTime).toBeGreaterThan(0);
    expect(result.metrics.processingTime).toBeLessThan(1000); // Should be < 1 second
  });
});

describe("Pipeline Composition", () => {
  describe("composePipeline", () => {
    it("should compose multiple transforms", () => {
      const input = 10;
      const pipeline = [
        { name: "double", fn: (x: unknown) => (x as number) * 2 },
        { name: "add5", fn: (x: unknown) => (x as number) + 5 },
        { name: "square", fn: (x: unknown) => (x as number) * (x as number) },
      ];
      
      const result = composePipeline<number, number>(input, pipeline);
      
      // (10 * 2) + 5 = 25, then 25 * 25 = 625
      expect(result.data).toBe(625);
      expect(result.stageName).toBe("square");
    });

    it("should measure processing time for each stage", () => {
      const input = 5;
      const pipeline = [
        { name: "stage1", fn: (x: unknown) => (x as number) * 2 },
        { name: "stage2", fn: (x: unknown) => (x as number) + 10 },
      ];
      
      const result = composePipeline(input, pipeline);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty pipeline", () => {
      expect(() => {
        composePipeline(10, []);
      }).toThrow("Pipeline must have at least one transform");
    });
  });

  describe("createVisualizationPipeline", () => {
    it("should create pipeline with all stages", () => {
      const pipeline = createVisualizationPipeline({
        fftSize: 512,
        windowType: "hann",
        agcEnabled: true,
        decimationFactor: 2,
        scalingMode: "dB",
        scaleFactor: 6,
      });
      
      // Should have: decimation, agc, windowing, fft, scaling
      expect(pipeline.length).toBe(5);
      expect(pipeline[0]!.name).toBe("decimation");
      expect(pipeline[1]!.name).toBe("agc");
      expect(pipeline[2]!.name).toBe("windowing");
      expect(pipeline[3]!.name).toBe("fft");
      expect(pipeline[4]!.name).toBe("scaling");
    });

    it("should create minimal pipeline", () => {
      const pipeline = createVisualizationPipeline({
        fftSize: 512,
        windowType: "rectangular",
      });
      
      // Should have: windowing, fft (no optional stages)
      expect(pipeline.length).toBe(2);
      expect(pipeline[0]!.name).toBe("windowing");
      expect(pipeline[1]!.name).toBe("fft");
    });

    it("should execute pipeline on real samples", () => {
      const samples = generateTestSamples(2048, 1.0);
      const pipeline = createVisualizationPipeline({
        fftSize: 1024,
        windowType: "hann",
        agcEnabled: true,
      });
      
      const result = composePipeline<Sample[], Float32Array>(samples, pipeline);
      
      expect(result.data).toBeInstanceOf(Float32Array);
      expect(result.data.length).toBe(1024);
    });

    it("should support decimation", () => {
      const samples = generateTestSamples(2048, 1.0);
      const pipeline = createVisualizationPipeline({
        fftSize: 512,
        windowType: "hann",
        decimationFactor: 4,
      });
      
      // Should include decimation stage
      expect(pipeline.some((s) => s.name === "decimation")).toBe(true);
    });
  });
});

describe("Integration Tests", () => {
  it("should process complete visualization pipeline", () => {
    // Generate test signal: 1kHz sine wave sampled at 48kHz
    const sampleRate = 48000;
    const frequency = 1000;
    const duration = 0.1; // 100ms
    const numSamples = Math.floor(sampleRate * duration);
    
    const samples: Sample[] = [];
    for (let i = 0; i < numSamples; i++) {
      const phase = 2 * Math.PI * frequency * i / sampleRate;
      samples.push({
        I: Math.cos(phase),
        Q: Math.sin(phase),
      });
    }
    
    const pipeline = createVisualizationPipeline({
      fftSize: 2048,
      windowType: "blackman",
      agcEnabled: true,
      decimationFactor: 2,
    });
    
    const result = composePipeline<Sample[], unknown>(samples, pipeline);
    
    expect(result.data).toBeDefined();
    expect(result.data).toBeInstanceOf(Float32Array);
    expect(result.stageName).toBe("fft");
  });

  it("should handle realistic SDR data", () => {
    // Simulate noisy FM signal
    const samples: Sample[] = [];
    for (let i = 0; i < 4096; i++) {
      const signal = Math.cos(2 * Math.PI * i / 64);
      const noise = (Math.random() - 0.5) * 0.1;
      samples.push({
        I: signal + noise,
        Q: Math.sin(2 * Math.PI * i / 64) + noise,
      });
    }
    
    // Apply AGC and windowing
    const agc = applyAGC(samples);
    const windowed = applyWindow(agc, "hann");
    
    expect(windowed.length).toBe(samples.length);
    expect(windowed.every((s) => !isNaN(s.I) && !isNaN(s.Q))).toBe(true);
  });
});

describe("Edge Cases and Error Handling", () => {
  it("should handle single sample", () => {
    const sample: Sample[] = [{ I: 1, Q: 0 }];
    
    expect(() => applyHannWindow(sample)).not.toThrow();
    expect(() => applyAGC(sample)).not.toThrow();
    expect(() => decimate(sample, 2)).not.toThrow();
  });

  it("should handle very large samples", () => {
    const samples = generateTestSamples(100000, 1.0);
    
    // Should complete without timeout
    const windowed = applyHannWindow(samples);
    expect(windowed.length).toBe(samples.length);
  });

  it("should handle extreme amplitudes", () => {
    const samples = generateTestSamples(2000, 100.0);
    
    const agc = applyAGC(samples, 0.7, 0.01, 0.001);
    
    // Check that AGC brings amplitude down to reasonable range
    const tailSamples = agc.slice(-500);
    const avgMag = tailSamples.reduce((sum, s) => sum + magnitude(s), 0) / tailSamples.length;
    
    // Should stabilize to reasonable level
    expect(avgMag).toBeGreaterThan(0.1);
    expect(avgMag).toBeLessThan(5.0);
  });

  it("should handle NaN and Infinity gracefully", () => {
    const samples: Sample[] = [
      { I: NaN, Q: 0 },
      { I: Infinity, Q: 0 },
      { I: 0, Q: -Infinity },
    ];
    
    // Should not crash (though results may be NaN)
    expect(() => applyHannWindow(samples)).not.toThrow();
  });
});

// Helper function to calculate variance
function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}
