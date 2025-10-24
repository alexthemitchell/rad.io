import {
  isWebGPUSupported,
  getViridisLUT,
  WebGPUPointRenderer,
  WebGPULineRenderer,
  WebGPUTextureRenderer,
} from "../webgpu";
import type {
  PointData,
  LineData,
  TextureData,
} from "../../types/visualization";

// Mock WebGPU API
const mockGPU = {
  requestAdapter: jest.fn(),
  getPreferredCanvasFormat: jest.fn(() => "bgra8unorm"),
};

const mockAdapter = {
  requestDevice: jest.fn(),
};

const mockDevice = {
  createBuffer: jest.fn(),
  createTexture: jest.fn(),
  createShaderModule: jest.fn(),
  createRenderPipeline: jest.fn(),
  createBindGroupLayout: jest.fn(),
  createPipelineLayout: jest.fn(),
  createBindGroup: jest.fn(),
  createSampler: jest.fn(),
  createCommandEncoder: jest.fn(),
  queue: {
    writeBuffer: jest.fn(),
    writeTexture: jest.fn(),
    submit: jest.fn(),
  },
};

const mockContext = {
  configure: jest.fn(),
  getCurrentTexture: jest.fn(() => ({
    createView: jest.fn(() => ({})),
  })),
};

describe("WebGPU Utilities", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;

    // Reset mocks
    jest.clearAllMocks();

    // Mock navigator.gpu
    Object.defineProperty(navigator, "gpu", {
      writable: true,
      configurable: true,
      value: mockGPU,
    });

    // Setup default mock implementations
    mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
    mockAdapter.requestDevice.mockResolvedValue(mockDevice);
    canvas.getContext = jest.fn(() => mockContext) as any;

    mockDevice.createBuffer.mockReturnValue({
      getMappedRange: jest.fn(() => new ArrayBuffer(1024)),
      unmap: jest.fn(),
      destroy: jest.fn(),
      size: 1024,
    });

    mockDevice.createTexture.mockReturnValue({
      createView: jest.fn(() => ({})),
      destroy: jest.fn(),
    });

    mockDevice.createShaderModule.mockReturnValue({});
    mockDevice.createRenderPipeline.mockReturnValue({
      getBindGroupLayout: jest.fn(() => ({})),
    });
    mockDevice.createBindGroupLayout.mockReturnValue({});
    mockDevice.createPipelineLayout.mockReturnValue({});
    mockDevice.createBindGroup.mockReturnValue({});
    mockDevice.createSampler.mockReturnValue({});

    const mockCommandEncoder = {
      beginRenderPass: jest.fn(() => ({
        setPipeline: jest.fn(),
        setVertexBuffer: jest.fn(),
        setBindGroup: jest.fn(),
        draw: jest.fn(),
        end: jest.fn(),
      })),
      finish: jest.fn(() => ({})),
    };
    mockDevice.createCommandEncoder.mockReturnValue(mockCommandEncoder);
  });

  afterEach(() => {
    // Clean up navigator.gpu mock
    delete (navigator as any).gpu;
  });

  describe("isWebGPUSupported", () => {
    it("should return true when WebGPU is available", () => {
      expect(isWebGPUSupported()).toBe(true);
    });

    it("should return false when WebGPU is not available", () => {
      delete (navigator as any).gpu;
      expect(isWebGPUSupported()).toBe(false);
    });
  });

  describe("getViridisLUT", () => {
    it("should return a 256-color RGBA lookup table", () => {
      const lut = getViridisLUT();
      expect(lut).toBeInstanceOf(Uint8Array);
      expect(lut.length).toBe(256 * 4); // 256 colors * 4 channels (RGBA)
    });

    it("should have valid RGBA values", () => {
      const lut = getViridisLUT();
      for (let i = 0; i < 256; i++) {
        const r = lut[i * 4 + 0];
        const g = lut[i * 4 + 1];
        const b = lut[i * 4 + 2];
        const a = lut[i * 4 + 3];

        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
        expect(a).toBe(255); // Alpha should always be 255
      }
    });

    it("should start with dark purple (viridis low end)", () => {
      const lut = getViridisLUT();
      const r = lut[0];
      const g = lut[1];
      const b = lut[2];

      // First color should be close to [68, 1, 84]
      expect(r).toBeCloseTo(68, 0);
      expect(g).toBeCloseTo(1, 0);
      expect(b).toBeCloseTo(84, 0);
    });

    it("should end with bright yellow-green (viridis high end)", () => {
      const lut = getViridisLUT();
      const lastIdx = 255 * 4;
      const r = lut[lastIdx + 0];
      const g = lut[lastIdx + 1];
      const b = lut[lastIdx + 2];

      // Last color should be close to [121, 209, 81]
      expect(r).toBeCloseTo(121, 0);
      expect(g).toBeCloseTo(209, 0);
      expect(b).toBeCloseTo(81, 0);
    });
  });

  describe("WebGPUPointRenderer", () => {
    let renderer: WebGPUPointRenderer;

    beforeEach(() => {
      renderer = new WebGPUPointRenderer();
    });

    it("should have correct name", () => {
      expect(renderer.getName()).toBe("WebGPU Point Renderer");
    });

    it("should initialize successfully with valid canvas", async () => {
      const success = await renderer.initialize(canvas);
      expect(success).toBe(true);
      expect(renderer.isReady()).toBe(true);
    });

    it("should fail to initialize when WebGPU is not supported", async () => {
      delete (navigator as any).gpu;
      const success = await renderer.initialize(canvas);
      expect(success).toBe(false);
      expect(renderer.isReady()).toBe(false);
    });

    it("should fail to initialize when adapter request fails", async () => {
      mockGPU.requestAdapter.mockResolvedValue(null);
      const success = await renderer.initialize(canvas);
      expect(success).toBe(false);
      expect(renderer.isReady()).toBe(false);
    });

    it("should render point data", async () => {
      await renderer.initialize(canvas);

      const pointData: PointData = {
        positions: new Float32Array([0, 0, 0.5, 0.5, -0.5, -0.5]),
        colors: new Float32Array([
          1,
          0,
          0,
          1, // Red
          0,
          1,
          0,
          1, // Green
          0,
          0,
          1,
          1, // Blue
        ]),
        pointSize: 5.0,
      };

      const success = renderer.render(pointData);
      expect(success).toBe(true);
      expect(mockDevice.queue.submit).toHaveBeenCalled();
    });

    it("should handle empty point data", async () => {
      await renderer.initialize(canvas);

      const pointData: PointData = {
        positions: new Float32Array([]),
      };

      const success = renderer.render(pointData);
      expect(success).toBe(false);
    });

    it("should cleanup resources", async () => {
      await renderer.initialize(canvas);
      const pointData: PointData = {
        positions: new Float32Array([0, 0]),
      };
      renderer.render(pointData);

      renderer.cleanup();
      expect(renderer.isReady()).toBe(false);
    });
  });

  describe("WebGPULineRenderer", () => {
    let renderer: WebGPULineRenderer;

    beforeEach(() => {
      renderer = new WebGPULineRenderer();
    });

    it("should have correct name", () => {
      expect(renderer.getName()).toBe("WebGPU Line Renderer");
    });

    it("should initialize successfully with valid canvas", async () => {
      const success = await renderer.initialize(canvas);
      expect(success).toBe(true);
      expect(renderer.isReady()).toBe(true);
    });

    it("should render line data", async () => {
      await renderer.initialize(canvas);

      const lineData: LineData = {
        positions: new Float32Array([-1, 0, -0.5, 0.5, 0, 0, 0.5, 0.5, 1, 0]),
        color: [1, 0, 0, 1],
        lineWidth: 2.0,
      };

      const success = renderer.render(lineData);
      expect(success).toBe(true);
      expect(mockDevice.queue.submit).toHaveBeenCalled();
    });

    it("should handle empty line data", async () => {
      await renderer.initialize(canvas);

      const lineData: LineData = {
        positions: new Float32Array([]),
      };

      const success = renderer.render(lineData);
      expect(success).toBe(false);
    });

    it("should cleanup resources", async () => {
      await renderer.initialize(canvas);
      renderer.cleanup();
      expect(renderer.isReady()).toBe(false);
    });
  });

  describe("WebGPUTextureRenderer", () => {
    let renderer: WebGPUTextureRenderer;

    beforeEach(() => {
      renderer = new WebGPUTextureRenderer();
    });

    it("should have correct name", () => {
      expect(renderer.getName()).toBe("WebGPU Texture Renderer");
    });

    it("should initialize successfully with valid canvas", async () => {
      const success = await renderer.initialize(canvas);
      expect(success).toBe(true);
      expect(renderer.isReady()).toBe(true);
    });

    it("should render texture data", async () => {
      await renderer.initialize(canvas);

      const textureData: TextureData = {
        data: new Uint8Array(256 * 256 * 4), // 256x256 RGBA texture
        width: 256,
        height: 256,
      };

      const success = renderer.render(textureData);
      expect(success).toBe(true);
      expect(mockDevice.queue.submit).toHaveBeenCalled();
    });

    it("should handle empty texture data", async () => {
      await renderer.initialize(canvas);

      const textureData: TextureData = {
        data: new Uint8Array([]),
        width: 0,
        height: 0,
      };

      const success = renderer.render(textureData);
      expect(success).toBe(false);
    });

    it("should cleanup resources", async () => {
      await renderer.initialize(canvas);
      renderer.cleanup();
      expect(renderer.isReady()).toBe(false);
    });
  });
});
