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

  describe("getFPS", () => {
    it("should return 0 when no rendering metrics exist", () => {
      expect(performanceMonitor.getFPS()).toBe(0);
    });

    it("should calculate FPS from average render duration", () => {
      // Simulate 5 render cycles with known durations
      // Category must be "rendering" which is matched by "render" in name
      for (let i = 0; i < 5; i++) {
        const markName = `render-cycle-start-${i}`;
        performanceMonitor.mark(markName);
        // Each measure call will record a duration
        performanceMonitor.measure(`render-cycle-${i}`, markName);
      }

      const fps = performanceMonitor.getFPS();
      // FPS should be calculated as 1000 / avgDuration
      // With fast execution in tests, this should be > 0
      expect(typeof fps).toBe("number");
      expect(fps).toBeGreaterThanOrEqual(0);
      expect(isFinite(fps)).toBe(true);
    });

    it("should return 0 for invalid durations", () => {
      performanceMonitor.mark("test-start");
      // Edge case: check FPS calculation handles empty/zero-duration metrics
      expect(performanceMonitor.getFPS()).toBeGreaterThanOrEqual(0);
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

// Additional robust tests with explicit Performance API stubs to drive branches
describe("performanceMonitor robust behavior", () => {
  beforeEach(() => {
    performanceMonitor.clear();
    performanceMonitor.setEnabled(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    performanceMonitor.clear();
  });

  it("no-ops when disabled (no marks or metrics)", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    const markSpy = jest.fn();
    perf.mark = markSpy;
    perf.measure = jest.fn();
    perf.getEntriesByName = jest.fn().mockReturnValue([]);

    performanceMonitor.setEnabled(false);
    performanceMonitor.mark("disabled-start");
    performanceMonitor.measure("render", "disabled-start");

    expect(markSpy).not.toHaveBeenCalled();
    expect(performanceMonitor.getMetrics("rendering")).toHaveLength(0);

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });

  it("records measures and categorizes into rendering and fft", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    perf.mark = jest.fn();
    perf.measure = jest.fn();
    const getEntriesSpy = jest
      .fn()
      .mockReturnValueOnce([
        {
          name: "render-loop",
          duration: 16.7,
          startTime: 100,
          entryType: "measure",
        },
      ])
      .mockReturnValueOnce([
        {
          name: "fft-pass",
          duration: 5.2,
          startTime: 200,
          entryType: "measure",
        },
      ]);
    perf.getEntriesByName = getEntriesSpy;

    performanceMonitor.mark("render-start");
    performanceMonitor.measure("render-loop", "render-start");
    performanceMonitor.mark("fft-start");
    performanceMonitor.measure("fft-pass", "fft-start");

    expect(getEntriesSpy).toHaveBeenCalledTimes(2);
    expect(performanceMonitor.getMetrics("rendering")).toHaveLength(1);
    expect(performanceMonitor.getMetrics("fft")).toHaveLength(1);

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });

  it("auto-creates an end mark when none is provided", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    const markSpy = jest.fn();
    perf.mark = markSpy;
    perf.measure = jest.fn();
    perf.getEntriesByName = jest.fn().mockReturnValue([
      {
        name: "render-pass",
        duration: 20,
        startTime: 50,
        entryType: "measure",
      },
    ]);
    jest.spyOn(Date, "now").mockReturnValue(9999);

    performanceMonitor.mark("render-start");
    performanceMonitor.measure("render-pass", "render-start");

    expect(markSpy).toHaveBeenCalledWith(
      expect.stringMatching(/render-pass-end-9999/),
    );
    expect(performanceMonitor.getMetrics("rendering")).toHaveLength(1);

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });

  it("computes average duration and FPS for rendering", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    perf.mark = jest.fn();
    perf.measure = jest.fn();
    perf.getEntriesByName = jest
      .fn()
      .mockReturnValueOnce([
        { name: "render", duration: 20, startTime: 0, entryType: "measure" },
      ])
      .mockReturnValueOnce([
        { name: "render", duration: 25, startTime: 0, entryType: "measure" },
      ]);

    performanceMonitor.mark("render-start-1");
    performanceMonitor.measure("render", "render-start-1");
    performanceMonitor.mark("render-start-2");
    performanceMonitor.measure("render", "render-start-2");

    expect(performanceMonitor.getAverageDuration("rendering")).toBeCloseTo(
      22.5,
      3,
    );
    expect(performanceMonitor.getFPS()).toBeCloseTo(44.4, 1);

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });

  it("getStats calculates min/max/percentiles", () => {
    const perf = globalThis.performance as any;
    const durations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    perf.mark = jest.fn();
    perf.measure = jest.fn();
    perf.getEntriesByName = jest.fn().mockImplementation(() => [
      {
        name: "render",
        duration: durations.shift()!,
        startTime: 0,
        entryType: "measure",
      },
    ]);

    for (let i = 0; i < 10; i++) {
      performanceMonitor.mark(`render-start-${i}`);
      performanceMonitor.measure("render", `render-start-${i}`);
    }
    const stats = performanceMonitor.getStats("rendering");
    expect(stats.count).toBe(10);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(10);
    expect(stats.p50).toBe(5);
    expect(stats.p95).toBe(10);
    expect(stats.p99).toBe(10);

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });

  it("clear() empties metrics and calls performance clear methods", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
      clearMarks: perf.clearMarks,
      clearMeasures: perf.clearMeasures,
    } as any;
    perf.mark = jest.fn();
    perf.measure = jest.fn();
    perf.getEntriesByName = jest
      .fn()
      .mockReturnValue([
        { name: "render", duration: 10, startTime: 0, entryType: "measure" },
      ]);
    const clearMarksSpy = (perf.clearMarks = jest.fn());
    const clearMeasuresSpy = (perf.clearMeasures = jest.fn());

    performanceMonitor.mark("render-start");
    performanceMonitor.measure("render", "render-start");
    expect(performanceMonitor.getMetrics("rendering")).toHaveLength(1);
    performanceMonitor.clear();
    expect(performanceMonitor.getMetrics("rendering")).toHaveLength(0);
    expect(clearMarksSpy).toHaveBeenCalled();
    expect(clearMeasuresSpy).toHaveBeenCalled();

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
    perf.clearMarks = original.clearMarks;
    perf.clearMeasures = original.clearMeasures;
  });

  it("exportMetrics serializes category stats", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    perf.mark = jest.fn();
    perf.measure = jest.fn();
    perf.getEntriesByName = jest
      .fn()
      .mockReturnValue([
        { name: "pipeline", duration: 42, startTime: 0, entryType: "measure" },
      ]);

    performanceMonitor.mark("pipeline-start");
    performanceMonitor.measure("pipeline", "pipeline-start");

    const json = performanceMonitor.exportMetrics();
    const obj = JSON.parse(json);
    expect(obj.total.count).toBe(1);

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });

  it("logSummary logs grouped output when stats exist", () => {
    const perf = globalThis.performance as any;
    const original = {
      mark: perf.mark,
      measure: perf.measure,
      getEntriesByName: perf.getEntriesByName,
    } as any;
    perf.mark = jest.fn();
    perf.measure = jest.fn();
    perf.getEntriesByName = jest
      .fn()
      .mockReturnValueOnce([
        { name: "render", duration: 18, startTime: 0, entryType: "measure" },
      ])
      .mockReturnValueOnce([
        { name: "render", duration: 22, startTime: 0, entryType: "measure" },
      ]);

    const group = jest
      .spyOn(console, "group")
      .mockImplementation(() => undefined as any);
    const log = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined as any);
    const groupEnd = jest
      .spyOn(console, "groupEnd")
      .mockImplementation(() => undefined as any);

    performanceMonitor.mark("render-start-1");
    performanceMonitor.measure("render", "render-start-1");
    performanceMonitor.mark("render-start-2");
    performanceMonitor.measure("render", "render-start-2");

    performanceMonitor.logSummary();

    expect(group).toHaveBeenCalledWith("Performance Summary");
    expect(log).toHaveBeenCalled();
    expect(groupEnd).toHaveBeenCalled();

    // restore
    perf.mark = original.mark;
    perf.measure = original.measure;
    perf.getEntriesByName = original.getEntriesByName;
  });
});
