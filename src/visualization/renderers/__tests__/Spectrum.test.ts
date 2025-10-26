/**
 * Tests for Canvas2D and WebGL spectrum renderers
 */

import { CanvasSpectrum } from "../CanvasSpectrum";
import { WebGLSpectrum } from "../WebGLSpectrum";
import type { SpectrumData } from "../types";

describe("CanvasSpectrum", () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasSpectrum;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 400;
    renderer = new CanvasSpectrum();
  });

  afterEach(() => {
    renderer.cleanup();
  });

  it("should initialize successfully", async () => {
    const success = await renderer.initialize(canvas);
    expect(success).toBe(true);
    expect(renderer.isReady()).toBe(true);
  });

  it("should render spectrum data", async () => {
    await renderer.initialize(canvas);

    const magnitudes = new Float32Array(1024);
    for (let i = 0; i < magnitudes.length; i++) {
      magnitudes[i] = -60 + Math.sin((i / 1024) * Math.PI * 4) * 20;
    }

    const data: SpectrumData = {
      magnitudes,
      freqMin: 0,
      freqMax: 1024,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should handle empty data when initialized", async () => {
    await renderer.initialize(canvas);

    const data: SpectrumData = {
      magnitudes: new Float32Array(0),
      freqMin: 0,
      freqMax: 1024,
    };

    const success = renderer.render(data);
    expect(success).toBe(false);
  });

  it("should handle frequency range subset", async () => {
    await renderer.initialize(canvas);

    const magnitudes = new Float32Array(1024);
    for (let i = 0; i < magnitudes.length; i++) {
      magnitudes[i] = -50 - i * 0.01;
    }

    const data: SpectrumData = {
      magnitudes,
      freqMin: 100,
      freqMax: 900,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should handle data with invalid values", async () => {
    await renderer.initialize(canvas);

    const magnitudes = new Float32Array(1024);
    magnitudes.fill(NaN);

    const data: SpectrumData = {
      magnitudes,
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

  it("should not render before initialization", () => {
    const data: SpectrumData = {
      magnitudes: new Float32Array(100),
      freqMin: 0,
      freqMax: 100,
    };

    const success = renderer.render(data);
    expect(success).toBe(false);
  });
});
