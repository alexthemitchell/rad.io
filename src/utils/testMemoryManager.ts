/**
 * Test Memory Manager
 *
 * Provides utilities for managing memory during tests to prevent
 * heap overflow issues when generating and processing large datasets.
 */

import type { Sample } from "./dsp";

/**
 * Sample buffer pool to reuse arrays and reduce allocations
 */
class SampleBufferPool {
  private pools = new Map<number, Sample[][]>();
  private readonly maxPoolSize = 10;

  /**
   * Get a sample array from the pool or create a new one
   */
  get(size: number): Sample[] {
    const pool = this.pools.get(size) || [];
    const buffer = pool.pop();

    if (buffer) {
      // Clear the buffer before reuse
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = { I: 0, Q: 0 };
      }
      return buffer;
    }

    // Create new buffer
    return new Array(size).fill(0).map(() => ({ I: 0, Q: 0 }));
  }

  /**
   * Return a sample array to the pool for reuse
   */
  release(buffer: Sample[]): void {
    const size = buffer.length;
    const pool = this.pools.get(size) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
      this.pools.set(size, pool);
    }
  }

  /**
   * Clear all pools and release memory
   */
  clear(): void {
    this.pools.clear();
  }
}

// Global buffer pool instance
const bufferPool = new SampleBufferPool();

/**
 * Get a sample buffer from the pool
 */
export function getSampleBuffer(size: number): Sample[] {
  return bufferPool.get(size);
}

/**
 * Release a sample buffer back to the pool
 */
export function releaseSampleBuffer(buffer: Sample[]): void {
  bufferPool.release(buffer);
}

/**
 * Clear all memory pools
 * Should be called in afterEach or afterAll hooks
 */
export function clearMemoryPools(): void {
  bufferPool.clear();

  // Force garbage collection if available (when running with --expose-gc)
  if (global.gc) {
    global.gc();
  }
}

/**
 * Generate samples with memory optimization
 * Uses chunking to avoid allocating large arrays at once
 */
export function generateSamplesChunked(
  sampleCount: number,
  generator: (n: number) => Sample,
  chunkSize = 10000,
): Sample[] {
  const chunks: Sample[][] = [];
  const numChunks = Math.ceil(sampleCount / chunkSize);

  for (let chunk = 0; chunk < numChunks; chunk++) {
    const start = chunk * chunkSize;
    const end = Math.min(start + chunkSize, sampleCount);
    const chunkLength = end - start;

    const chunkSamples = new Array(chunkLength);
    for (let i = 0; i < chunkLength; i++) {
      chunkSamples[i] = generator(start + i);
    }
    chunks.push(chunkSamples);
  }

  return chunks.flat();
}

/**
 * Batch process samples to avoid memory pressure
 * Processes samples in batches and calls cleanup between batches
 */
export function processSamplesBatched<T>(
  samples: Sample[],
  processor: (batch: Sample[]) => T,
  batchSize = 5000,
): T[] {
  const results: T[] = [];
  const numBatches = Math.ceil(samples.length / batchSize);

  for (let batch = 0; batch < numBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, samples.length);
    const batchSamples = samples.slice(start, end);

    results.push(processor(batchSamples));

    // Allow GC between batches
    if (global.gc && batch % 10 === 0) {
      global.gc();
    }
  }

  return results;
}

/**
 * Memory monitoring for tests
 */
export class TestMemoryMonitor {
  private startMemory = 0;
  private peakMemory = 0;

  start(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      this.startMemory = process.memoryUsage().heapUsed;
      this.peakMemory = this.startMemory;
    }
  }

  checkpoint(label?: string): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const currentMemory = process.memoryUsage().heapUsed;
      this.peakMemory = Math.max(this.peakMemory, currentMemory);

      const delta = currentMemory - this.startMemory;
      const deltaMB = (delta / 1024 / 1024).toFixed(2);

      if (label) {
        console.warn(`[Memory] ${label}: ${deltaMB} MB delta`);
      }
    }
  }

  report(): { deltaBytes: number; deltaMB: number; peakMB: number } {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const currentMemory = process.memoryUsage().heapUsed;
      const delta = currentMemory - this.startMemory;
      const peakDelta = this.peakMemory - this.startMemory;

      return {
        deltaBytes: delta,
        deltaMB: parseFloat((delta / 1024 / 1024).toFixed(2)),
        peakMB: parseFloat((peakDelta / 1024 / 1024).toFixed(2)),
      };
    }

    return { deltaBytes: 0, deltaMB: 0, peakMB: 0 };
  }
}
