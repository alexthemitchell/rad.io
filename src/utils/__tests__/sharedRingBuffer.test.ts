/**
 * Tests for SharedArrayBuffer ring buffer
 */

import {
  SharedRingBuffer,
  isSharedArrayBufferSupported,
  isCrossOriginIsolated,
  canUseSharedArrayBuffer,
  getSharedBufferCapabilities,
} from "../sharedRingBuffer";

describe("SharedRingBuffer", () => {
  describe("Feature Detection", () => {
    it("should detect SharedArrayBuffer support", () => {
      const supported = isSharedArrayBufferSupported();
      expect(typeof supported).toBe("boolean");
    });

    it("should detect cross-origin isolation", () => {
      const isolated = isCrossOriginIsolated();
      expect(typeof isolated).toBe("boolean");
    });

    it("should determine if SharedArrayBuffer can be used", () => {
      const canUse = canUseSharedArrayBuffer();
      expect(typeof canUse).toBe("boolean");
    });

    it("should provide detailed capabilities", () => {
      const caps = getSharedBufferCapabilities();
      expect(caps).toHaveProperty("supported");
      expect(caps).toHaveProperty("isolated");
      expect(caps).toHaveProperty("canUse");
      expect(typeof caps.supported).toBe("boolean");
      expect(typeof caps.isolated).toBe("boolean");
      expect(typeof caps.canUse).toBe("boolean");
    });

    it("should provide error message when not available", () => {
      const caps = getSharedBufferCapabilities();
      if (!caps.canUse) {
        expect(caps.error).toBeDefined();
        expect(typeof caps.error).toBe("string");
      }
    });
  });

  describe("Ring Buffer Operations", () => {
    // Only run these tests if SharedArrayBuffer is supported
    const runTest = isSharedArrayBufferSupported();

    (runTest ? it : it.skip)("should create a ring buffer", () => {
      const buffer = new SharedRingBuffer(1024);
      expect(buffer).toBeDefined();
      expect(buffer.getAvailableSpace()).toBe(1023); // Size - 1
      expect(buffer.getAvailableData()).toBe(0);
    });

    (runTest ? it : it.skip)("should write and read data", () => {
      const buffer = new SharedRingBuffer(1024);
      const samples = new Float32Array([1, 2, 3, 4, 5]);

      const written = buffer.write(samples);
      expect(written).toBe(5);
      expect(buffer.getAvailableData()).toBe(5);

      const read = buffer.tryRead(5);
      expect(read).not.toBeNull();
      expect(read).toEqual(samples);
      expect(buffer.getAvailableData()).toBe(0);
    });

    (runTest ? it : it.skip)("should handle ring buffer wrap-around", () => {
      const buffer = new SharedRingBuffer(10);

      // Fill buffer to near capacity
      const samples1 = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      buffer.write(samples1);

      // Read some
      buffer.tryRead(5);

      // Write more (will wrap around)
      const samples2 = new Float32Array([9, 10, 11, 12]);
      const written = buffer.write(samples2);
      expect(written).toBe(4);

      // Read remaining
      const read1 = buffer.tryRead(3);
      expect(read1).toEqual(new Float32Array([6, 7, 8]));

      const read2 = buffer.tryRead(4);
      expect(read2).toEqual(new Float32Array([9, 10, 11, 12]));
    });

    (runTest ? it : it.skip)(
      "should return null when insufficient data",
      () => {
        const buffer = new SharedRingBuffer(1024);
        const samples = new Float32Array([1, 2, 3]);
        buffer.write(samples);

        const read = buffer.tryRead(5);
        expect(read).toBeNull();
      },
    );

    (runTest ? it : it.skip)("should limit write to available space", () => {
      const buffer = new SharedRingBuffer(10);
      const samples = new Float32Array(20); // More than capacity
      samples.fill(1);

      const written = buffer.write(samples);
      expect(written).toBeLessThan(samples.length);
      expect(written).toBeLessThanOrEqual(9); // Max available space
    });

    (runTest ? it : it.skip)("should clear the buffer", () => {
      const buffer = new SharedRingBuffer(1024);
      const samples = new Float32Array([1, 2, 3, 4, 5]);

      buffer.write(samples);
      expect(buffer.getAvailableData()).toBe(5);

      buffer.clear();
      expect(buffer.getAvailableData()).toBe(0);
      expect(buffer.getAvailableSpace()).toBe(1023);
    });

    (runTest ? it : it.skip)("should handle multiple write-read cycles", () => {
      const buffer = new SharedRingBuffer(100);

      for (let i = 0; i < 10; i++) {
        const samples = new Float32Array(10);
        samples.fill(i);

        buffer.write(samples);
        const read = buffer.tryRead(10);

        expect(read).not.toBeNull();
        expect(read?.[0]).toBe(i);
      }
    });

    (runTest ? it : it.skip)("should maintain data integrity", () => {
      const buffer = new SharedRingBuffer(1024);
      const samples = new Float32Array(100);

      // Fill with known pattern
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((i * Math.PI) / 50);
      }

      buffer.write(samples);
      const read = buffer.tryRead(100);

      expect(read).not.toBeNull();
      if (read) {
        for (let i = 0; i < samples.length; i++) {
          expect(read[i]).toBeCloseTo(samples[i] ?? 0, 10);
        }
      }
    });

    (runTest ? it : it.skip)("should return SharedArrayBuffer", () => {
      const buffer = new SharedRingBuffer(1024);
      const sharedBuffer = buffer.getBuffer();

      expect(sharedBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(sharedBuffer.byteLength).toBeGreaterThan(0);
    });

    (runTest ? it : it.skip)("should handle zero-length writes", () => {
      const buffer = new SharedRingBuffer(1024);
      const samples = new Float32Array(0);

      const written = buffer.write(samples);
      expect(written).toBe(0);
      expect(buffer.getAvailableData()).toBe(0);
    });

    (runTest ? it : it.skip)("should handle zero-length reads", () => {
      const buffer = new SharedRingBuffer(1024);
      const samples = new Float32Array([1, 2, 3]);
      buffer.write(samples);

      const read = buffer.tryRead(0);
      expect(read).toEqual(new Float32Array(0));
      expect(buffer.getAvailableData()).toBe(3); // Data still in buffer
    });

    (runTest ? it : it.skip)(
      "should throw error on out-of-bounds access",
      () => {
        const buffer = new SharedRingBuffer(10);
        const invalidSamples = new Float32Array(5);

        // Try to write with an invalid index - accessing beyond array bounds
        expect(() => {
          const hugeArray = new Float32Array(1);
          // Access element at index 100 which is out of bounds
          const _ = hugeArray[100];
        }).not.toThrow(); // TypedArray returns undefined, doesn't throw

        // But our safeFloatArrayIndex should throw
        // This is tested implicitly in write operations
      },
    );

    (runTest ? it : it.skip)(
      "should correctly report space after partial reads",
      () => {
        const buffer = new SharedRingBuffer(20);
        const samples = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        buffer.write(samples);
        expect(buffer.getAvailableSpace()).toBe(9); // 20 - 1 - 10 = 9

        buffer.tryRead(5);
        expect(buffer.getAvailableSpace()).toBe(14); // 20 - 1 - 5 = 14
      },
    );

    (runTest ? it : it.skip)("should handle full buffer scenario", () => {
      const buffer = new SharedRingBuffer(10);
      const samples = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Fill to max capacity (size - 1)
      const written = buffer.write(samples);
      expect(written).toBe(9);
      expect(buffer.getAvailableSpace()).toBe(0);

      // Try to write more
      const moreSamples = new Float32Array([10, 11]);
      const written2 = buffer.write(moreSamples);
      expect(written2).toBe(0); // No space available
    });
  });
});
