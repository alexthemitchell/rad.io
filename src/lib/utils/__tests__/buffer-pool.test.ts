/**
 * Buffer Pool Tests
 * Tests for ADR-0002: Web Worker DSP Architecture
 */

import { bufferPool } from "../buffer-pool";

describe("ArrayBufferPool", () => {
  beforeEach(() => {
    bufferPool.clear();
  });

  describe("acquire and release", () => {
    it("should acquire new buffer when pool is empty", () => {
      const buffer = bufferPool.acquire(1024);
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(1024);
    });

    it("should reuse released buffer", () => {
      const size = 2048;
      const buffer1 = bufferPool.acquire(size);
      bufferPool.release(buffer1);

      const buffer2 = bufferPool.acquire(size);
      expect(buffer2).toBe(buffer1); // Same buffer reference
    });

    it("should handle multiple buffers of same size", () => {
      const size = 4096;
      const buffer1 = bufferPool.acquire(size);
      const buffer2 = bufferPool.acquire(size);
      const buffer3 = bufferPool.acquire(size);

      bufferPool.release(buffer1);
      bufferPool.release(buffer2);
      bufferPool.release(buffer3);

      const reused1 = bufferPool.acquire(size);
      const reused2 = bufferPool.acquire(size);
      const reused3 = bufferPool.acquire(size);

      // Should reuse in LIFO order
      expect([reused1, reused2, reused3]).toContain(buffer1);
      expect([reused1, reused2, reused3]).toContain(buffer2);
      expect([reused1, reused2, reused3]).toContain(buffer3);
    });

    it("should handle different buffer sizes", () => {
      const small = bufferPool.acquire(512);
      const medium = bufferPool.acquire(1024);
      const large = bufferPool.acquire(4096);

      bufferPool.release(small);
      bufferPool.release(medium);
      bufferPool.release(large);

      expect(bufferPool.acquire(512)).toBe(small);
      expect(bufferPool.acquire(1024)).toBe(medium);
      expect(bufferPool.acquire(4096)).toBe(large);
    });

    it("should create new buffer when pool for size is exhausted", () => {
      const size = 1024;
      const buffer1 = bufferPool.acquire(size);
      bufferPool.release(buffer1);

      const buffer2 = bufferPool.acquire(size); // Reused
      const buffer3 = bufferPool.acquire(size); // New

      expect(buffer2).toBe(buffer1);
      expect(buffer3).not.toBe(buffer1);
      expect(buffer3.byteLength).toBe(size);
    });
  });

  describe("clear", () => {
    it("should clear all pools", () => {
      const buffer1 = bufferPool.acquire(1024);
      const buffer2 = bufferPool.acquire(2048);

      bufferPool.release(buffer1);
      bufferPool.release(buffer2);

      bufferPool.clear();

      const newBuffer1 = bufferPool.acquire(1024);
      const newBuffer2 = bufferPool.acquire(2048);

      expect(newBuffer1).not.toBe(buffer1);
      expect(newBuffer2).not.toBe(buffer2);
    });
  });

  describe("memory management", () => {
    it("should handle large number of buffers", () => {
      const size = 8192;
      const buffers: ArrayBuffer[] = [];

      // Acquire many buffers
      for (let i = 0; i < 100; i++) {
        buffers.push(bufferPool.acquire(size));
      }

      // Release all
      buffers.forEach((buffer) => bufferPool.release(buffer));

      // Reacquire
      for (let i = 0; i < 100; i++) {
        const buffer = bufferPool.acquire(size);
        expect(buffers).toContain(buffer);
      }
    });

    it("should handle alternating acquire/release patterns", () => {
      const size = 1024;
      const buffer1 = bufferPool.acquire(size);
      bufferPool.release(buffer1);

      const buffer2 = bufferPool.acquire(size);
      expect(buffer2).toBe(buffer1);
      bufferPool.release(buffer2);

      const buffer3 = bufferPool.acquire(size);
      expect(buffer3).toBe(buffer1);
    });

    it("should isolate pools by size", () => {
      const buffer512 = bufferPool.acquire(512);
      const buffer1024 = bufferPool.acquire(1024);

      bufferPool.release(buffer512);
      bufferPool.release(buffer1024);

      // Acquiring different size should not return wrong buffer
      expect(bufferPool.acquire(1024)).toBe(buffer1024);
      expect(bufferPool.acquire(512)).toBe(buffer512);
    });
  });

  describe("edge cases", () => {
    it("should handle zero-size buffer", () => {
      const buffer = bufferPool.acquire(0);
      expect(buffer.byteLength).toBe(0);

      bufferPool.release(buffer);
      const reused = bufferPool.acquire(0);
      expect(reused).toBe(buffer);
    });

    it("should handle very large buffer size", () => {
      const largeSize = 1024 * 1024 * 10; // 10 MB
      const buffer = bufferPool.acquire(largeSize);
      expect(buffer.byteLength).toBe(largeSize);

      bufferPool.release(buffer);
      const reused = bufferPool.acquire(largeSize);
      expect(reused).toBe(buffer);
    });

    it("should handle releasing same buffer multiple times", () => {
      const buffer = bufferPool.acquire(1024);
      bufferPool.release(buffer);
      bufferPool.release(buffer); // Release again

      // Both should be in pool (duplicate entries)
      const reused1 = bufferPool.acquire(1024);
      const reused2 = bufferPool.acquire(1024);

      expect(reused1).toBe(buffer);
      expect(reused2).toBe(buffer);
    });
  });
});
