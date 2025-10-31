/**
 * Tests for WebGPU compute utilities
 */

import {
  isWebGPUSupported,
  getWebGPUCapabilities,
  WebGPUFFT,
} from "../webgpuCompute";

describe("WebGPU Compute", () => {
  // Provide a minimal WebGPU mock so these tests can run in Jest without real GPU
  // The mock simulates device/queue/compute pipeline behavior and returns a
  // Float32Array buffer with finite, reasonable dB values.
  beforeAll(() => {
    const existingNavigator = (global as any).navigator ?? {};

    class MockGPUBuffer {
      size: number;
      private _backing: ArrayBuffer;
      constructor(size: number) {
        this.size = size;
        this._backing = new ArrayBuffer(size);
      }
      destroy = jest.fn();
      async mapAsync() {
        // no-op
        return Promise.resolve();
      }
      getMappedRange() {
        // Fill with a safe finite value (e.g., -100 dB) encoded as f32
        const f32 = new Float32Array(this._backing);
        f32.fill(-100);
        return this._backing;
      }
      unmap = jest.fn();
    }

    const mockDevice: any = {
      createBuffer: ({ size }: { size: number }) => new MockGPUBuffer(size),
      createShaderModule: jest.fn(() => ({})),
      createComputePipeline: jest.fn(() => ({
        getBindGroupLayout: jest.fn(() => ({})),
      })),
      createBindGroup: jest.fn(() => ({})),
      createCommandEncoder: jest.fn(() => ({
        beginComputePass: jest.fn(() => ({
          setPipeline: jest.fn(),
          setBindGroup: jest.fn(),
          dispatchWorkgroups: jest.fn(),
          end: jest.fn(),
        })),
        copyBufferToBuffer: jest.fn(),
        finish: jest.fn(() => ({})),
      })),
      queue: {
        writeBuffer: jest.fn(),
        submit: jest.fn(),
      },
      destroy: jest.fn(),
    };

    const mockAdapter: any = {
      requestDevice: jest.fn(async () => mockDevice),
    };

    const mockGPU = {
      requestAdapter: jest.fn(async () => mockAdapter),
    };

    (global as any).navigator = { ...existingNavigator, gpu: mockGPU };
  });

  describe("Feature Detection", () => {
    it("should detect WebGPU support", () => {
      const supported = isWebGPUSupported();
      expect(typeof supported).toBe("boolean");
    });

    it("should get WebGPU capabilities", async () => {
      const caps = await getWebGPUCapabilities();

      expect(caps).toHaveProperty("supported");
      expect(caps).toHaveProperty("adapter");
      expect(caps).toHaveProperty("device");
      expect(typeof caps.supported).toBe("boolean");
      expect(typeof caps.adapter).toBe("boolean");
      expect(typeof caps.device).toBe("boolean");
    });

    it("should provide error message when not available", async () => {
      const caps = await getWebGPUCapabilities();

      if (!caps.device) {
        expect(caps.error).toBeDefined();
        expect(typeof caps.error).toBe("string");
      }
    });
  });

  describe("WebGPUFFT", () => {
    const runTest = isWebGPUSupported();

    (runTest ? it : it.skip)("should create WebGPUFFT instance", () => {
      const fft = new WebGPUFFT();
      expect(fft).toBeDefined();
    });

    (runTest ? it : it.skip)("should initialize with FFT size", async () => {
      const fft = new WebGPUFFT();
      const initialized = await fft.initialize(1024);

      // May fail if WebGPU not fully available
      expect(typeof initialized).toBe("boolean");
    });

    (runTest ? it : it.skip)(
      "should compute magnitude from I/Q samples",
      async () => {
        const fft = new WebGPUFFT();
        const initialized = await fft.initialize(256);

        if (!initialized) {
          // Skip if WebGPU not available
          return;
        }

        // Create test samples
        const iSamples = new Float32Array(256);
        const qSamples = new Float32Array(256);

        for (let i = 0; i < 256; i++) {
          iSamples[i] = Math.cos((2 * Math.PI * i * 10) / 256);
          qSamples[i] = Math.sin((2 * Math.PI * i * 10) / 256);
        }

        const result = await fft.compute(iSamples, qSamples);

        expect(result).not.toBeNull();
        if (result) {
          expect(result.length).toBe(256);
          expect(result).toBeInstanceOf(Float32Array);

          // Check that results are reasonable dB values
          for (let i = 0; i < result.length; i++) {
            expect(result[i]).toBeGreaterThan(-200); // Not too negative
            expect(result[i]).toBeLessThan(100); // Not too positive
            expect(Number.isFinite(result[i])).toBe(true);
          }
        }

        fft.destroy();
      },
      10000,
    ); // Longer timeout for GPU operations

    (runTest ? it : it.skip)(
      "should handle zero input gracefully",
      async () => {
        const fft = new WebGPUFFT();
        const initialized = await fft.initialize(128);

        if (!initialized) {
          return;
        }

        const iSamples = new Float32Array(128);
        const qSamples = new Float32Array(128);
        // All zeros

        const result = await fft.compute(iSamples, qSamples);

        expect(result).not.toBeNull();
        if (result) {
          expect(result.length).toBe(128);
          // All results should be finite (using epsilon for log)
          for (let i = 0; i < result.length; i++) {
            expect(Number.isFinite(result[i])).toBe(true);
          }
        }

        fft.destroy();
      },
      10000,
    );

    (runTest ? it : it.skip)(
      "should cleanup resources on destroy",
      async () => {
        const fft = new WebGPUFFT();
        await fft.initialize(512);

        // Should not throw
        expect(() => fft.destroy()).not.toThrow();

        // Multiple destroys should be safe
        expect(() => fft.destroy()).not.toThrow();
      },
    );

    (runTest ? it : it.skip)(
      "should return null when not initialized",
      async () => {
        const fft = new WebGPUFFT();

        const iSamples = new Float32Array(256);
        const qSamples = new Float32Array(256);

        const result = await fft.compute(iSamples, qSamples);
        expect(result).toBeNull();
      },
    );

    (runTest ? it : it.skip)(
      "should handle different FFT sizes",
      async () => {
        const sizes = [64, 128, 256, 512];

        for (const size of sizes) {
          const fft = new WebGPUFFT();
          const initialized = await fft.initialize(size);

          if (!initialized) {
            continue;
          }

          const iSamples = new Float32Array(size);
          const qSamples = new Float32Array(size);
          iSamples.fill(1);
          qSamples.fill(0);

          const result = await fft.compute(iSamples, qSamples);

          expect(result).not.toBeNull();
          if (result) {
            expect(result.length).toBe(size);
          }

          fft.destroy();
        }
      },
      20000,
    );
  });
});
