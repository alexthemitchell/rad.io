/**
 * Tests for Test Memory Manager
 *
 * Validates memory management utilities for test environments
 */

import {
  getSampleBuffer,
  releaseSampleBuffer,
  clearMemoryPools,
  generateSamplesChunked,
  processSamplesBatched,
  TestMemoryMonitor,
} from "../testMemoryManager";
import type { Sample } from "../dsp";

describe("Test Memory Manager", () => {
  afterEach(() => {
    clearMemoryPools();
  });

  describe("Sample Buffer Pool", () => {
    it("should allocate sample buffers", () => {
      const buffer = getSampleBuffer(100);
      expect(buffer).toHaveLength(100);
      expect(buffer[0]).toHaveProperty("I");
      expect(buffer[0]).toHaveProperty("Q");
    });

    it("should reuse released buffers", () => {
      const buffer1 = getSampleBuffer(50);
      buffer1[0]!.I = 1.0;
      releaseSampleBuffer(buffer1);

      const buffer2 = getSampleBuffer(50);
      // Should be the same buffer, but cleared
      expect(buffer2).toHaveLength(50);
      expect(buffer2[0]!.I).toBe(0);
      expect(buffer2[0]!.Q).toBe(0);
    });

    it("should clear all pools", () => {
      const buffer = getSampleBuffer(100);
      releaseSampleBuffer(buffer);
      clearMemoryPools();

      // After clearing, should get a new buffer
      const newBuffer = getSampleBuffer(100);
      expect(newBuffer).toHaveLength(100);
    });
  });

  describe("Chunked Sample Generation", () => {
    it("should generate samples in chunks", () => {
      const generator = (n: number): Sample => ({
        I: Math.cos(n),
        Q: Math.sin(n),
      });

      const samples = generateSamplesChunked(1000, generator, 250);
      expect(samples).toHaveLength(1000);
      expect(samples[0]!.I).toBeCloseTo(Math.cos(0));
      expect(samples[999]!.I).toBeCloseTo(Math.cos(999));
    });

    it("should handle non-divisible chunk sizes", () => {
      const generator = (): Sample => ({ I: 1, Q: 1 });
      const samples = generateSamplesChunked(1000, generator, 300);
      expect(samples).toHaveLength(1000);
      expect(samples[999]!.I).toBe(1);
    });

    it("should work with default chunk size", () => {
      const generator = (): Sample => ({ I: 1, Q: 1 });
      const samples = generateSamplesChunked(50000, generator);
      expect(samples).toHaveLength(50000);
    });
  });

  describe("Batched Sample Processing", () => {
    it("should process samples in batches", () => {
      const samples: Sample[] = Array.from({ length: 1000 }, (_, i) => ({
        I: i,
        Q: i,
      }));

      const processor = (batch: Sample[]): number => batch.length;
      const results = processSamplesBatched(samples, processor, 250);

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result).toBe(250);
      });
    });

    it("should handle non-divisible batch sizes", () => {
      const samples: Sample[] = Array.from({ length: 1000 }, (_, i) => ({
        I: i,
        Q: i,
      }));

      const processor = (batch: Sample[]): number => batch.length;
      const results = processSamplesBatched(samples, processor, 300);

      expect(results).toHaveLength(4);
      expect(results[0]).toBe(300);
      expect(results[1]).toBe(300);
      expect(results[2]).toBe(300);
      expect(results[3]).toBe(100); // Last batch is smaller
    });

    it("should process data correctly", () => {
      const samples: Sample[] = Array.from({ length: 100 }, (_, i) => ({
        I: i,
        Q: i * 2,
      }));

      const processor = (batch: Sample[]): number => {
        return batch.reduce((sum, s) => sum + s.I, 0);
      };

      const results = processSamplesBatched(samples, processor, 25);
      const total = results.reduce((sum, r) => sum + r, 0);

      // Sum of 0 to 99
      expect(total).toBe((99 * 100) / 2);
    });
  });

  describe("Memory Monitor", () => {
    it("should track memory usage", () => {
      const monitor = new TestMemoryMonitor();
      monitor.start();

      // Allocate some data
      const data = new Array(1000).fill(0);
      monitor.checkpoint("after allocation");

      const report = monitor.report();
      expect(report).toHaveProperty("deltaBytes");
      expect(report).toHaveProperty("deltaMB");
      expect(report).toHaveProperty("peakMB");

      // Just ensure we don't crash and values are numbers
      expect(typeof report.deltaBytes).toBe("number");
      expect(typeof report.deltaMB).toBe("number");
      expect(typeof report.peakMB).toBe("number");

      // Keep data in scope to avoid premature GC
      expect(data.length).toBe(1000);
    });
  });
});
