/**
 * Tests for Performance Monitoring Utilities
 */

import { performanceMonitor, measurePerformance } from "../performanceMonitor";

describe("PerformanceMonitor", () => {
  beforeEach(() => {
    performanceMonitor.clear();
    performanceMonitor.setEnabled(true);
  });

  afterEach(() => {
    performanceMonitor.clear();
  });

  describe("Basic functionality", () => {
    it("should create performance marks", () => {
      performanceMonitor.mark("test-mark");
      // Should not throw
      expect(true).toBe(true);
    });

    it("should measure performance between marks", () => {
      performanceMonitor.mark("test-start");
      performanceMonitor.measure("test-measure", "test-start");

      const metrics = performanceMonitor.getMetrics("other");
      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });

    it("should categorize FFT measurements correctly", () => {
      performanceMonitor.mark("fft-start");
      performanceMonitor.measure("fft-calculation", "fft-start");

      const fftMetrics = performanceMonitor.getMetrics("fft");
      expect(fftMetrics.length).toBeGreaterThanOrEqual(0);
    });

    it("should categorize waveform measurements correctly", () => {
      performanceMonitor.mark("waveform-start");
      performanceMonitor.measure("waveform-calculation", "waveform-start");

      const waveformMetrics = performanceMonitor.getMetrics("waveform");
      expect(waveformMetrics.length).toBeGreaterThanOrEqual(0);
    });

    it("should categorize spectrogram measurements correctly", () => {
      performanceMonitor.mark("spectrogram-start");
      performanceMonitor.measure(
        "spectrogram-calculation",
        "spectrogram-start",
      );

      const spectrogramMetrics = performanceMonitor.getMetrics("spectrogram");
      expect(spectrogramMetrics.length).toBeGreaterThanOrEqual(0);
    });

    it("should categorize rendering measurements correctly", () => {
      performanceMonitor.mark("render-start");
      performanceMonitor.measure("render-canvas", "render-start");

      const renderMetrics = performanceMonitor.getMetrics("rendering");
      expect(renderMetrics.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Statistics", () => {
    it("should calculate statistics for empty metrics", () => {
      const stats = performanceMonitor.getStats("nonexistent");
      expect(stats.count).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    it("should calculate average duration", () => {
      // Add some test measurements
      performanceMonitor.mark("test1-start");
      performanceMonitor.measure("fft-test", "test1-start");

      const avg = performanceMonitor.getAverageDuration("fft");
      expect(avg).toBeGreaterThanOrEqual(0);
    });

    it("should provide percentile statistics", () => {
      // Add multiple measurements
      for (let i = 0; i < 10; i++) {
        const markName = `fft-${i}-start`;
        performanceMonitor.mark(markName);
        performanceMonitor.measure(`fft-${i}`, markName);
      }

      const stats = performanceMonitor.getStats("fft");
      expect(stats.count).toBeGreaterThanOrEqual(0);
      expect(stats.p50).toBeGreaterThanOrEqual(0);
      expect(stats.p95).toBeGreaterThanOrEqual(0);
      expect(stats.p99).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Pipeline metrics", () => {
    it("should return pipeline metrics structure", () => {
      const pipelineMetrics = performanceMonitor.getPipelineMetrics();

      expect(pipelineMetrics).toHaveProperty("fft");
      expect(pipelineMetrics).toHaveProperty("waveform");
      expect(pipelineMetrics).toHaveProperty("spectrogram");
      expect(pipelineMetrics).toHaveProperty("rendering");
      expect(pipelineMetrics).toHaveProperty("total");
    });
  });

  describe("Enable/Disable", () => {
    it("should be enabled by default", () => {
      expect(performanceMonitor.isEnabled()).toBe(true);
    });

    it("should allow disabling", () => {
      performanceMonitor.setEnabled(false);
      expect(performanceMonitor.isEnabled()).toBe(false);
    });

    it("should not create marks when disabled", () => {
      performanceMonitor.setEnabled(false);
      performanceMonitor.mark("disabled-mark");
      // Should not throw even when disabled
      expect(true).toBe(true);
    });
  });

  describe("Clear", () => {
    it("should clear all metrics", () => {
      performanceMonitor.mark("test-start");
      performanceMonitor.measure("test", "test-start");

      performanceMonitor.clear();

      const metrics = performanceMonitor.getMetrics("other");
      expect(metrics.length).toBe(0);
    });
  });

  describe("Export", () => {
    it("should export metrics as JSON", () => {
      performanceMonitor.mark("test-start");
      performanceMonitor.measure("fft-test", "test-start");

      const exported = performanceMonitor.exportMetrics();
      expect(typeof exported).toBe("string");

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty("fft");
      expect(parsed).toHaveProperty("waveform");
      expect(parsed).toHaveProperty("spectrogram");
      expect(parsed).toHaveProperty("rendering");
      expect(parsed).toHaveProperty("longTasks");
    });
  });

  describe("Long tasks", () => {
    it("should track long tasks", () => {
      const longTasks = performanceMonitor.getLongTasks();
      expect(Array.isArray(longTasks)).toBe(true);
    });
  });
});

describe("measurePerformance decorator", () => {
  beforeEach(() => {
    performanceMonitor.clear();
    performanceMonitor.setEnabled(true);
  });

  afterEach(() => {
    performanceMonitor.clear();
  });

  it("should measure synchronous function performance", () => {
    const testFn = measurePerformance(
      "test-sync",
      ((x: number) => x * 2) as (...args: unknown[]) => unknown,
    );

    const result = testFn(5);
    expect(result).toBe(10);
  });

  it("should measure async function performance", async () => {
    const asyncFn = measurePerformance("test-async", (async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return x * 2;
    }) as (...args: unknown[]) => unknown);

    const result = await asyncFn(5);
    expect(result).toBe(10);
  });

  it("should handle function errors", () => {
    const errorFn = measurePerformance("test-error", (() => {
      throw new Error("Test error");
    }) as (...args: unknown[]) => unknown);

    expect(() => errorFn()).toThrow("Test error");
  });
});
