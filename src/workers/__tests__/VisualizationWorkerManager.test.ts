/**
 * @jest-environment jsdom
 */
import { VisualizationWorkerManager } from "../VisualizationWorkerManager";

// Mock Worker
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((err: ErrorEvent) => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

describe("VisualizationWorkerManager", () => {
  beforeEach(() => {
    // Mock Worker
    (global as never)["Worker"] = jest.fn(() => new MockWorker()) as never;
    // Mock OffscreenCanvas
    (global as never)["OffscreenCanvas"] = jest.fn() as never;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isSupported", () => {
    it("should return true when Worker and OffscreenCanvas are available", () => {
      expect(VisualizationWorkerManager.isSupported()).toBe(true);
    });

    it("should return false when Worker is not available", () => {
      delete (global as never)["Worker"];
      expect(VisualizationWorkerManager.isSupported()).toBe(false);
    });

    it("should return false when OffscreenCanvas is not available", () => {
      delete (global as never)["OffscreenCanvas"];
      expect(VisualizationWorkerManager.isSupported()).toBe(false);
    });
  });

  describe("initialization", () => {
    let manager: VisualizationWorkerManager;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      manager = new VisualizationWorkerManager();
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
    });

    afterEach(() => {
      manager.cleanup();
    });

    it("should return false if canvas already has a context", async () => {
      // Get a context to prevent transfer
      canvas.getContext("2d");

      const success = await manager.initialize(canvas, "constellation", {
        width: 800,
        height: 600,
        dpr: 1,
      });

      expect(success).toBe(false);
    });

    it("should return false if transferControlToOffscreen is not available", async () => {
      // Don't add the transfer method
      const success = await manager.initialize(canvas, "constellation", {
        width: 800,
        height: 600,
        dpr: 1,
      });

      expect(success).toBe(false);
    });

    it("should initialize successfully with transferable canvas", async () => {
      // Mock transferControlToOffscreen
      const mockOffscreen = {};
      (canvas as HTMLCanvasElement & { transferControlToOffscreen?: () => OffscreenCanvas }).transferControlToOffscreen = jest.fn(() => mockOffscreen as OffscreenCanvas);

      // Start initialization (don't await yet)
      const initPromise = manager.initialize(canvas, "constellation", {
        width: 800,
        height: 600,
        dpr: 1,
      });

      // Simulate worker initialization response
      setTimeout(() => {
        const worker = (Worker as jest.MockedClass<typeof Worker>).mock.results[0].value as MockWorker;
        if (worker.onmessage) {
          worker.onmessage(new MessageEvent("message", {
            data: { type: "initialized", success: true, hasWebGL: true, has2D: false }
          }));
        }
      }, 10);

      const success = await initPromise;

      expect(success).toBe(true);
      expect(manager.isReady()).toBe(true);
      expect(canvas.transferControlToOffscreen).toHaveBeenCalled();
    });
  });

  describe("rendering", () => {
    let manager: VisualizationWorkerManager;
    let canvas: HTMLCanvasElement;
    let mockWorker: MockWorker;

    beforeEach(async () => {
      manager = new VisualizationWorkerManager();
      canvas = document.createElement("canvas");
      
      const mockOffscreen = {};
      (canvas as HTMLCanvasElement & { transferControlToOffscreen?: () => OffscreenCanvas }).transferControlToOffscreen = jest.fn(() => mockOffscreen as OffscreenCanvas);

      const initPromise = manager.initialize(canvas, "constellation", {
        width: 800,
        height: 600,
        dpr: 1,
      });

      // Get the worker instance
      mockWorker = (Worker as jest.MockedClass<typeof Worker>).mock.results[0].value as MockWorker;

      // Simulate initialization response
      setTimeout(() => {
        if (mockWorker.onmessage) {
          mockWorker.onmessage(new MessageEvent("message", {
            data: { type: "initialized", success: true, hasWebGL: true, has2D: false }
          }));
        }
      }, 10);

      await initPromise;
    });

    afterEach(() => {
      manager.cleanup();
    });

    it("should send render message to worker", () => {
      const samples = [
        { I: 0.5, Q: 0.5 },
        { I: -0.5, Q: 0.5 },
      ];

      manager.render({ samples });

      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "render",
          frameId: expect.any(Number),
          data: { samples },
        })
      );
    });

    it("should throw error if not initialized", () => {
      const uninitializedManager = new VisualizationWorkerManager();
      
      expect(() => {
        uninitializedManager.render({ samples: [] });
      }).toThrow("Worker not initialized");
    });

    it("should send resize message to worker", () => {
      manager.resize({ width: 1024, height: 768, dpr: 2 });

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: "resize",
        config: { width: 1024, height: 768, dpr: 2 },
      });
    });

    it("should call metrics callback on frameComplete message", () => {
      const metricsCallback = jest.fn();
      manager.onMetrics(metricsCallback);

      // Simulate frame complete message from worker
      if (mockWorker.onmessage) {
        mockWorker.onmessage(new MessageEvent("message", {
          data: {
            type: "frameComplete",
            frameId: 1,
            renderTimeMs: 16.5,
            queueSize: 0,
            droppedFrames: 0,
            renderedFrames: 1,
          }
        }));
      }

      expect(metricsCallback).toHaveBeenCalledWith({
        frameId: 1,
        renderTimeMs: 16.5,
        queueSize: 0,
        droppedFrames: 0,
        renderedFrames: 1,
      });
    });

    it("should call error callback on worker error", () => {
      const errorCallback = jest.fn();
      manager.onError(errorCallback);

      // Simulate error message from worker
      if (mockWorker.onmessage) {
        mockWorker.onmessage(new MessageEvent("message", {
          data: {
            type: "error",
            message: "Rendering failed",
          }
        }));
      }

      expect(errorCallback).toHaveBeenCalledWith("Rendering failed");
    });
  });

  describe("cleanup", () => {
    it("should terminate worker and clean up resources", async () => {
      const manager = new VisualizationWorkerManager();
      const canvas = document.createElement("canvas");
      const mockOffscreen = {};
      (canvas as HTMLCanvasElement & { transferControlToOffscreen?: () => OffscreenCanvas }).transferControlToOffscreen = jest.fn(() => mockOffscreen as OffscreenCanvas);

      const initPromise = manager.initialize(canvas, "constellation", {
        width: 800,
        height: 600,
        dpr: 1,
      });

      const mockWorker = (Worker as jest.MockedClass<typeof Worker>).mock.results[0].value as MockWorker;
      setTimeout(() => {
        if (mockWorker.onmessage) {
          mockWorker.onmessage(new MessageEvent("message", {
            data: { type: "initialized", success: true, hasWebGL: true, has2D: false }
          }));
        }
      }, 10);

      await initPromise;

      manager.cleanup();

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: "dispose" });
      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(manager.isReady()).toBe(false);
    });
  });
});
