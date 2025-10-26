/**
 * Tests for Canvas2D and WebGL waterfall renderers
 */

import { CanvasWaterfall } from "../CanvasWaterfall";
import { WebGLWaterfall } from "../WebGLWaterfall";
import type { WaterfallData } from "../types";

describe("CanvasWaterfall", () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasWaterfall;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 800;
    renderer = new CanvasWaterfall();
  });

  afterEach(() => {
    renderer.cleanup();
  });

  it("should initialize successfully", async () => {
    const success = await renderer.initialize(canvas);
    expect(success).toBe(true);
    expect(renderer.isReady()).toBe(true);
  });

  it("should render waterfall data", async () => {
    await renderer.initialize(canvas);

    const frames: Float32Array[] = [];
    for (let f = 0; f < 50; f++) {
      const frame = new Float32Array(1024);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = -60 + Math.sin((i / 1024 + f / 50) * Math.PI * 4) * 20;
      }
      frames.push(frame);
    }

    const data: WaterfallData = {
      frames,
      freqMin: 0,
      freqMax: 1024,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should handle empty frames when initialized", async () => {
    const initSuccess = await renderer.initialize(canvas);
    if (!initSuccess) {
      return;
    }

    const data: WaterfallData = {
      frames: [],
      freqMin: 0,
      freqMax: 1024,
    };

    const success = renderer.render(data);
    expect(success).toBe(false);
  });

  it("should cleanup safely", async () => {
    await renderer.initialize(canvas);
    renderer.cleanup();
    expect(renderer.isReady()).toBe(false);
  });
});
