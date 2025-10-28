/**
 * Tests for Canvas2D and WebGL waterfall renderers
 */

// Mock WebGL2RenderingContext for instanceof checks in webgl.ts
(global as any).WebGL2RenderingContext = class WebGL2RenderingContext {};

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

  it("should handle frequency range subset", async () => {
    await renderer.initialize(canvas);

    const frames: Float32Array[] = [];
    for (let f = 0; f < 30; f++) {
      const frame = new Float32Array(1024);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = -50 - i * 0.01 + f * 0.5;
      }
      frames.push(frame);
    }

    const data: WaterfallData = {
      frames,
      freqMin: 100,
      freqMax: 900,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should handle single frame", async () => {
    await renderer.initialize(canvas);

    const frame = new Float32Array(512);
    for (let i = 0; i < frame.length; i++) {
      frame[i] = -60 + Math.random() * 40;
    }

    const data: WaterfallData = {
      frames: [frame],
      freqMin: 0,
      freqMax: 512,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should handle data with some invalid values", async () => {
    await renderer.initialize(canvas);

    const frames: Float32Array[] = [];
    const frame = new Float32Array(1024);
    // Mix of valid and invalid values
    for (let i = 0; i < frame.length; i++) {
      frame[i] = i % 10 === 0 ? NaN : -60 + i * 0.01;
    }
    frames.push(frame);

    const data: WaterfallData = {
      frames,
      freqMin: 0,
      freqMax: 1024,
    };

    const success = renderer.render(data);
    expect(success).toBe(true); // Should handle gracefully
  });

  it("should not render before initialization", () => {
    const data: WaterfallData = {
      frames: [new Float32Array(100)],
      freqMin: 0,
      freqMax: 100,
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

describe("WebGLWaterfall", () => {
  let canvas: HTMLCanvasElement;
  let renderer: WebGLWaterfall;
  let mockGL: any;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 800;
    renderer = new WebGLWaterfall();

    // Create comprehensive mock WebGL context
    mockGL = {
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TRIANGLES: 4,
      TRIANGLE_STRIP: 5,
      COLOR_BUFFER_BIT: 16384,
      LINK_STATUS: 35714,
      COMPILE_STATUS: 35713,
      TEXTURE_2D: 3553,
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      NEAREST: 9728,
      LINEAR: 9729,
      CLAMP_TO_EDGE: 33071,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
      TEXTURE0: 33984,
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
      getUniformLocation: jest.fn(() => ({})),
      createBuffer: jest.fn(() => ({})),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      viewport: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      drawArrays: jest.fn(),
      createTexture: jest.fn(() => ({})),
      bindTexture: jest.fn(),
      texImage2D: jest.fn(),
      texParameteri: jest.fn(),
      activeTexture: jest.fn(),
      uniform1i: jest.fn(),
      uniform1f: jest.fn(),
      pixelStorei: jest.fn(),
      texSubImage2D: jest.fn(),
      UNPACK_ALIGNMENT: 3317,
      LUMINANCE: 6409,
      DYNAMIC_DRAW: 35048,
      TEXTURE1: 33985,
      R32F: 33326,
      RED: 6403,
      getExtension: jest.fn(() => null),
      deleteShader: jest.fn(),
      deleteProgram: jest.fn(),
      deleteBuffer: jest.fn(),
      deleteTexture: jest.fn(),
      disable: jest.fn(),
    };

    // Mock getContext to return our mock WebGL context
    jest.spyOn(canvas, "getContext").mockImplementation((type: string) => {
      // Support webgl2, webgl, and webgpu context types
      if (type === "webgl2") {
        return mockGL;
      }
      if (type === "webgl") {
        return mockGL;
      }
      if (type === "webgpu") {
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

  it("should render waterfall data with WebGL", async () => {
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
    expect(mockGL.texSubImage2D).toHaveBeenCalled();
    expect(mockGL.drawArrays).toHaveBeenCalled();
  });

  it("should handle empty frames", async () => {
    await renderer.initialize(canvas);

    const data: WaterfallData = {
      frames: [],
      freqMin: 0,
      freqMax: 1024,
    };

    const success = renderer.render(data);
    expect(success).toBe(false);
  });

  it("should handle single frame", async () => {
    await renderer.initialize(canvas);

    const frame = new Float32Array(512);
    for (let i = 0; i < frame.length; i++) {
      frame[i] = -60 + Math.random() * 40;
    }

    const data: WaterfallData = {
      frames: [frame],
      freqMin: 0,
      freqMax: 512,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should handle frequency range subset", async () => {
    await renderer.initialize(canvas);

    const frames: Float32Array[] = [];
    for (let f = 0; f < 30; f++) {
      const frame = new Float32Array(1024);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = -50 - i * 0.01 + f * 0.5;
      }
      frames.push(frame);
    }

    const data: WaterfallData = {
      frames,
      freqMin: 100,
      freqMax: 900,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });

  it("should not render before initialization", () => {
    const data: WaterfallData = {
      frames: [new Float32Array(100)],
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

  it("should handle large datasets", async () => {
    await renderer.initialize(canvas);

    const frames: Float32Array[] = [];
    for (let f = 0; f < 200; f++) {
      const frame = new Float32Array(2048);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = -70 + Math.sin((i / 2048) * Math.PI * 8 + f * 0.1) * 30;
      }
      frames.push(frame);
    }

    const data: WaterfallData = {
      frames,
      freqMin: 0,
      freqMax: 2048,
    };

    const success = renderer.render(data);
    expect(success).toBe(true);
  });
});
