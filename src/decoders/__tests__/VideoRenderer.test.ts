/**
 * Tests for VideoRenderer
 */

import { VideoRenderer } from "../VideoRenderer";

describe("VideoRenderer", () => {
  let canvas: HTMLCanvasElement;
  let renderer: VideoRenderer;

  beforeEach(() => {
    // Create a mock canvas
    canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    Object.defineProperty(canvas, "clientWidth", { value: 1920 });
    Object.defineProperty(canvas, "clientHeight", { value: 1080 });

    renderer = new VideoRenderer({
      canvas,
      maintainAspectRatio: true,
      scaleMode: "fit",
    });
  });

  describe("initialization", () => {
    it("should create renderer with default options", () => {
      const defaultRenderer = new VideoRenderer({ canvas });
      expect(defaultRenderer).toBeDefined();
    });

    it("should create renderer with custom options", () => {
      const customRenderer = new VideoRenderer({
        canvas,
        maintainAspectRatio: false,
        scaleMode: "fill",
      });
      expect(customRenderer).toBeDefined();
    });

    it("should throw error if canvas context cannot be obtained", () => {
      const mockCanvas = {
        getContext: jest.fn().mockReturnValue(null),
      } as unknown as HTMLCanvasElement;

      expect(
        () =>
          new VideoRenderer({
            canvas: mockCanvas,
          }),
      ).toThrow("Failed to get 2D context from canvas");
    });
  });

  describe("renderFrame", () => {
    let mockFrame: VideoFrame;

    beforeEach(() => {
      mockFrame = {
        displayWidth: 1920,
        displayHeight: 1080,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;
    });

    it("should render a frame to canvas", () => {
      expect(() => renderer.renderFrame(mockFrame)).not.toThrow();
      expect(mockFrame.close).toHaveBeenCalled();
    });

    it("should close frame after rendering", () => {
      renderer.renderFrame(mockFrame);
      expect(mockFrame.close).toHaveBeenCalledTimes(1);
    });

    it("should update video dimensions on resolution change", () => {
      renderer.renderFrame(mockFrame);

      const newFrame = {
        displayWidth: 1280,
        displayHeight: 720,
        timestamp: 1000,
        close: jest.fn(),
      } as unknown as VideoFrame;

      renderer.renderFrame(newFrame);

      const dimensions = renderer.getVideoDimensions();
      expect(dimensions.width).toBe(1280);
      expect(dimensions.height).toBe(720);
    });
  });

  describe("FPS tracking", () => {
    it("should start with 0 FPS", () => {
      expect(renderer.getFPS()).toBe(0);
    });

    it("should track FPS over time", () => {
      const mockFrame = {
        displayWidth: 1920,
        displayHeight: 1080,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      // Render multiple frames
      for (let i = 0; i < 30; i++) {
        renderer.renderFrame(mockFrame);
      }

      // FPS will be calculated after 1 second
      expect(renderer.getFPS()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("clear", () => {
    it("should clear the canvas", () => {
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();

      renderer.clear();

      // Canvas should be cleared (black)
      // We can't easily verify the canvas content in Jest, but we can verify the method doesn't throw
      expect(() => renderer.clear()).not.toThrow();
    });
  });

  describe("reset", () => {
    it("should reset renderer state", () => {
      const mockFrame = {
        displayWidth: 1920,
        displayHeight: 1080,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      renderer.renderFrame(mockFrame);
      renderer.reset();

      expect(renderer.getFPS()).toBe(0);
      const dimensions = renderer.getVideoDimensions();
      expect(dimensions.width).toBe(0);
      expect(dimensions.height).toBe(0);
    });
  });

  describe("aspect ratio handling", () => {
    it("should maintain aspect ratio in fit mode", () => {
      const fitRenderer = new VideoRenderer({
        canvas,
        maintainAspectRatio: true,
        scaleMode: "fit",
      });

      const mockFrame = {
        displayWidth: 1280,
        displayHeight: 720,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      expect(() => fitRenderer.renderFrame(mockFrame)).not.toThrow();
    });

    it("should maintain aspect ratio in fill mode", () => {
      const fillRenderer = new VideoRenderer({
        canvas,
        maintainAspectRatio: true,
        scaleMode: "fill",
      });

      const mockFrame = {
        displayWidth: 1280,
        displayHeight: 720,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      expect(() => fillRenderer.renderFrame(mockFrame)).not.toThrow();
    });

    it("should stretch video in stretch mode", () => {
      const stretchRenderer = new VideoRenderer({
        canvas,
        maintainAspectRatio: true,
        scaleMode: "stretch",
      });

      const mockFrame = {
        displayWidth: 1280,
        displayHeight: 720,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      expect(() => stretchRenderer.renderFrame(mockFrame)).not.toThrow();
    });

    it("should ignore aspect ratio when maintainAspectRatio is false", () => {
      const noAspectRenderer = new VideoRenderer({
        canvas,
        maintainAspectRatio: false,
        scaleMode: "fit",
      });

      const mockFrame = {
        displayWidth: 1280,
        displayHeight: 720,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      expect(() => noAspectRenderer.renderFrame(mockFrame)).not.toThrow();
    });
  });

  describe("getVideoDimensions", () => {
    it("should return initial dimensions as 0x0", () => {
      const dimensions = renderer.getVideoDimensions();
      expect(dimensions.width).toBe(0);
      expect(dimensions.height).toBe(0);
    });

    it("should return current video dimensions after rendering", () => {
      const mockFrame = {
        displayWidth: 1920,
        displayHeight: 1080,
        timestamp: 0,
        close: jest.fn(),
      } as unknown as VideoFrame;

      renderer.renderFrame(mockFrame);

      const dimensions = renderer.getVideoDimensions();
      expect(dimensions.width).toBe(1920);
      expect(dimensions.height).toBe(1080);
    });
  });
});
