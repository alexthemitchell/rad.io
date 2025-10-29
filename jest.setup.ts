import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import { toHaveNoViolations } from "jest-axe";

// Polyfill TextEncoder/TextDecoder for react-router-dom in tests
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock canvas methods for testing
HTMLCanvasElement.prototype.getContext = function () {
  return {
    setTransform: jest.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    globalAlpha: 1,
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    clearRect: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    createRadialGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
  } as any;
};

// Extend Jest matchers with axe accessibility matchers
expect.extend(toHaveNoViolations);

// Mock WebGPU constants and types
if (typeof (global as any).GPUBufferUsage === "undefined") {
  (global as any).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };

  (global as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };

  (global as any).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  };
}

// Mock ResizeObserver
if (typeof (global as any).ResizeObserver === "undefined") {
  (global as any).ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
}
