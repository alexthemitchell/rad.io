/**
 * DSP Metrics Tests
 * Tests for ADR-0002: Web Worker DSP Architecture
 */

import { dspMetrics, DSPMetrics } from "../dsp-metrics";

describe("DSPPerformanceMonitor", () => {
  beforeEach(() => {
    dspMetrics.reset();
  });

  describe("recordProcessingTime", () => {
    it("should record single processing time", () => {
      dspMetrics.recordProcessingTime(10);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(10);
      expect(metrics.maxProcessingTime).toBe(10);
      expect(metrics.minProcessingTime).toBe(10);
      expect(metrics.totalOperations).toBe(1);
    });

    it("should record multiple processing times", () => {
      dspMetrics.recordProcessingTime(5);
      dspMetrics.recordProcessingTime(10);
      dspMetrics.recordProcessingTime(15);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(10);
      expect(metrics.maxProcessingTime).toBe(15);
      expect(metrics.minProcessingTime).toBe(5);
      expect(metrics.totalOperations).toBe(3);
    });

    it("should maintain rolling window of 100 samples", () => {
      // Record 150 samples
      for (let i = 1; i <= 150; i++) {
        dspMetrics.recordProcessingTime(i);
      }

      const metrics = dspMetrics.getMetrics();
      expect(metrics.totalOperations).toBe(150);

      // Average should be based on last 100 samples (51-150)
      const expectedAvg = (51 + 150) / 2; // Average of 51 to 150
      expect(metrics.avgProcessingTime).toBeCloseTo(expectedAvg, 1);
      expect(metrics.minProcessingTime).toBe(51); // Oldest samples dropped
      expect(metrics.maxProcessingTime).toBe(150);
    });
  });

  describe("setQueueDepth", () => {
    it("should set queue depth", () => {
      dspMetrics.setQueueDepth(5);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.queueDepth).toBe(5);
    });

    it("should update queue depth", () => {
      dspMetrics.setQueueDepth(5);
      dspMetrics.setQueueDepth(10);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.queueDepth).toBe(10);
    });
  });

  describe("getMetrics", () => {
    it("should return zero metrics when no data", () => {
      const metrics = dspMetrics.getMetrics();

      expect(metrics.avgProcessingTime).toBe(0);
      expect(metrics.maxProcessingTime).toBe(0);
      expect(metrics.minProcessingTime).toBe(0);
      expect(metrics.throughput).toBe(0);
      expect(metrics.queueDepth).toBe(0);
      expect(metrics.totalOperations).toBe(0);
    });

    it("should calculate throughput correctly", () => {
      // Record 10ms processing times
      for (let i = 0; i < 10; i++) {
        dspMetrics.recordProcessingTime(10);
      }

      const metrics = dspMetrics.getMetrics();
      // At 10ms per operation, throughput is 100 ops/sec
      expect(metrics.throughput).toBeCloseTo(100, 0);
    });

    it("should handle varying processing times for throughput", () => {
      dspMetrics.recordProcessingTime(5); // 200 ops/sec
      dspMetrics.recordProcessingTime(10); // 100 ops/sec
      dspMetrics.recordProcessingTime(20); // 50 ops/sec

      const metrics = dspMetrics.getMetrics();
      // Average time is (5 + 10 + 20) / 3 = 11.67ms
      // Throughput is 1000 / 11.67 ≈ 85.7 ops/sec
      expect(metrics.throughput).toBeGreaterThan(80);
      expect(metrics.throughput).toBeLessThan(90);
    });

    it("should include all metric fields", () => {
      dspMetrics.recordProcessingTime(10);
      dspMetrics.setQueueDepth(3);

      const metrics = dspMetrics.getMetrics();

      expect(metrics).toHaveProperty("avgProcessingTime");
      expect(metrics).toHaveProperty("maxProcessingTime");
      expect(metrics).toHaveProperty("minProcessingTime");
      expect(metrics).toHaveProperty("throughput");
      expect(metrics).toHaveProperty("queueDepth");
      expect(metrics).toHaveProperty("totalOperations");
    });
  });

  describe("reset", () => {
    it("should reset all metrics", () => {
      dspMetrics.recordProcessingTime(10);
      dspMetrics.recordProcessingTime(20);
      dspMetrics.setQueueDepth(5);

      dspMetrics.reset();

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(0);
      expect(metrics.maxProcessingTime).toBe(0);
      expect(metrics.minProcessingTime).toBe(0);
      expect(metrics.throughput).toBe(0);
      expect(metrics.queueDepth).toBe(0);
      expect(metrics.totalOperations).toBe(0);
    });

    it("should allow recording after reset", () => {
      dspMetrics.recordProcessingTime(10);
      dspMetrics.reset();
      dspMetrics.recordProcessingTime(20);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(20);
      expect(metrics.totalOperations).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle very small processing times", () => {
      dspMetrics.recordProcessingTime(0.001);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(0.001);
      expect(metrics.throughput).toBeGreaterThan(1000);
    });

    it("should handle very large processing times", () => {
      dspMetrics.recordProcessingTime(10000); // 10 seconds

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(10000);
      expect(metrics.throughput).toBeCloseTo(0.1, 2);
    });

    it("should handle zero processing time", () => {
      dspMetrics.recordProcessingTime(0);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(0);
      // Throughput with 0ms time would be infinite, should handle gracefully
      expect(metrics.throughput).toBeDefined();
    });

    it("should handle negative queue depth gracefully", () => {
      dspMetrics.setQueueDepth(-5);

      const metrics = dspMetrics.getMetrics();
      expect(metrics.queueDepth).toBe(-5); // Store as is
    });
  });

  describe("statistics accuracy", () => {
    it("should calculate accurate statistics for known dataset", () => {
      const times = [5, 10, 15, 20, 25];
      times.forEach((time) => dspMetrics.recordProcessingTime(time));

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(15);
      expect(metrics.minProcessingTime).toBe(5);
      expect(metrics.maxProcessingTime).toBe(25);
    });

    it("should handle all same values", () => {
      for (let i = 0; i < 10; i++) {
        dspMetrics.recordProcessingTime(42);
      }

      const metrics = dspMetrics.getMetrics();
      expect(metrics.avgProcessingTime).toBe(42);
      expect(metrics.minProcessingTime).toBe(42);
      expect(metrics.maxProcessingTime).toBe(42);
    });
  });
});
