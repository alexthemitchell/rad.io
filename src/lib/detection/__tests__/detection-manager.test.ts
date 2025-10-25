/**
 * DetectionManager Tests
 */

import { DetectionManager } from "../detection-manager";
import type { ClassifiedSignal } from "../signal-classifier";

// Mock Worker
class MockWorker {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;

  postMessage = jest.fn();
  terminate = jest.fn();
}

// Setup Worker mock
global.Worker = jest.fn().mockImplementation(() => new MockWorker()) as any;

describe("DetectionManager", () => {
  let manager: DetectionManager;

  beforeEach(() => {
    manager = new DetectionManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe("initialize", () => {
    it("should initialize the worker", async () => {
      await manager.initialize();
      expect(global.Worker).toHaveBeenCalled();
    });

    it("should not reinitialize if already initialized", async () => {
      await manager.initialize();
      const firstWorker = (manager as any).worker;

      await manager.initialize();
      const secondWorker = (manager as any).worker;

      expect(firstWorker).toBe(secondWorker);
    });
  });

  describe("detectSignals", () => {
    it("should warn if not initialized", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const spectrum = new Float32Array(100).fill(-70);
      manager.detectSignals(spectrum, 2_000_000, 100_000_000);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Detection worker not initialized",
      );
      consoleSpy.mockRestore();
    });

    it("should post message to worker when initialized", async () => {
      await manager.initialize();

      const postMessageSpy = jest.spyOn((manager as any).worker, "postMessage");
      const spectrum = new Float32Array(100).fill(-70);

      manager.detectSignals(spectrum, 2_000_000, 100_000_000, {
        thresholdDB: 15,
      });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining("detect-"),
          spectrum: expect.any(Float32Array),
          sampleRate: 2_000_000,
          centerFreq: 100_000_000,
          config: { thresholdDB: 15 },
        }),
        expect.any(Array),
      );
    });

    it("should increment request ID", async () => {
      await manager.initialize();

      const postMessageSpy = jest.spyOn((manager as any).worker, "postMessage");
      const spectrum = new Float32Array(100).fill(-70);

      manager.detectSignals(spectrum, 2_000_000, 100_000_000);
      manager.detectSignals(spectrum, 2_000_000, 100_000_000);

      expect(postMessageSpy).toHaveBeenCalledTimes(2);
      const calls = postMessageSpy.mock.calls;
      expect((calls[0]![0] as any).id).not.toBe((calls[1]![0] as any).id);
    });
  });

  describe("onDetection", () => {
    it("should register detection callback", async () => {
      await manager.initialize();

      const callback = jest.fn();
      manager.onDetection(callback);

      // Simulate worker message
      const mockSignals: ClassifiedSignal[] = [
        {
          binIndex: 100,
          frequency: 146_000_000,
          power: -50,
          bandwidth: 15_000,
          snr: 30,
          type: "narrowband-fm",
          confidence: 0.8,
        },
      ];

      (manager as any).worker.onmessage({
        data: {
          id: "test-1",
          signals: mockSignals,
          noiseFloor: -75,
          processingTime: 10,
        },
      });

      expect(callback).toHaveBeenCalledWith(mockSignals);
    });
  });

  describe("onNoiseFloor", () => {
    it("should register noise floor callback", async () => {
      await manager.initialize();

      const callback = jest.fn();
      manager.onNoiseFloor(callback);

      // Simulate worker message
      (manager as any).worker.onmessage({
        data: {
          id: "test-1",
          signals: [],
          noiseFloor: -72,
          processingTime: 10,
        },
      });

      expect(callback).toHaveBeenCalledWith(-72);
    });
  });

  describe("destroy", () => {
    it("should terminate the worker", async () => {
      await manager.initialize();

      const terminateSpy = jest.spyOn((manager as any).worker, "terminate");
      manager.destroy();

      expect(terminateSpy).toHaveBeenCalled();
      expect((manager as any).worker).toBeNull();
    });

    it("should handle destroy when not initialized", () => {
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});
