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

describe("WebGLSpectrum", () => {
  let canvas: HTMLCanvasElement;
  let renderer: WebGLSpectrum;
  let mockGL: any;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 400;
    renderer = new WebGLSpectrum();

    // Create mock WebGL context
    mockGL = {
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      LINE_STRIP: 3,
      COLOR_BUFFER_BIT: 16384,
      LINK_STATUS: 35714,
      COMPILE_STATUS: 35713,
      DEPTH_TEST: 2929,
      BLEND: 3042,
      createShader: jest.fn(() => ({})),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn(() => true),
      getShaderInfoLog: jest.fn(() => ""),
      createProgram: jest.fn(() => ({})),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      getProgramInfoLog: jest.fn(() => ""),
      useProgram: jest.fn(),
      getAttribLocation: jest.fn(() => 0),
      createBuffer: jest.fn(() => ({})),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      viewport: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      drawArrays: jest.fn(),
      deleteShader: jest.fn(),
      deleteProgram: jest.fn(),
      deleteBuffer: jest.fn(),
      disable: jest.fn(),
      enable: jest.fn(),
      lineWidth: jest.fn(),
      blendFunc: jest.fn(),
      SRC_ALPHA: 770,
      ONE_MINUS_SRC_ALPHA: 771,
    };

    // Mock getContext to return our mock WebGL context
    jest.spyOn(canvas, "getContext").mockImplementation((type) => {
      if (type === "webgl2" || type === "webgl") {
        return mockGL;
      }
      return null;
    });
  });

  afterEach(() => {
    renderer.cleanup();
    jest.restoreAllMocks();
  });

  it("should initialize successfully with WebGL", async () => {
    const success = await renderer.initialize(canvas);
    expect(success).toBe(true);
    expect(renderer.isReady()).toBe(true);
    expect(mockGL.createShader).toHaveBeenCalled();
    expect(mockGL.createProgram).toHaveBeenCalled();
  });

  it("should fail initialization if WebGL unavailable", async () => {
    jest.spyOn(canvas, "getContext").mockReturnValue(null);
    const success = await renderer.initialize(canvas);
    expect(success).toBe(false);
    expect(renderer.isReady()).toBe(false);
  });

  it("should fail initialization if shader compilation fails", async () => {
    mockGL.getShaderParameter.mockReturnValue(false);
    const success = await renderer.initialize(canvas);
    expect(success).toBe(false);
  });

  it("should fail initialization if program linking fails", async () => {
    mockGL.getProgramParameter.mockReturnValue(false);
    const success = await renderer.initialize(canvas);
    expect(success).toBe(false);
  });

  it("should render spectrum data with WebGL", async () => {
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
    expect(mockGL.clear).toHaveBeenCalled();
    expect(mockGL.drawArrays).toHaveBeenCalledWith(mockGL.LINE_STRIP, 0, 1024);
  });

  it("should handle empty data", async () => {
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

  it("should not render before initialization", () => {
    const data: SpectrumData = {
      magnitudes: new Float32Array(100),
      freqMin: 0,
      freqMax: 100,
    };

    const success = renderer.render(data);
    expect(success).toBe(false);
  });

  it("should cleanup WebGL resources", async () => {
    await renderer.initialize(canvas);
    renderer.cleanup();
    expect(renderer.isReady()).toBe(false);
    expect(mockGL.deleteProgram).toHaveBeenCalled();
    expect(mockGL.deleteBuffer).toHaveBeenCalled();
  });
});
