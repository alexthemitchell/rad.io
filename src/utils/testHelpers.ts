import type { Sample } from "./dsp";

/**
 * Shared test utilities for visualization components
 */

/**
 * Creates sample IQ data for testing visualizations
 * @param count Number of samples to create
 * @param pattern Pattern to use for sample generation
 * @returns Array of IQ samples
 */
export function createTestSamples(
  count: number,
  pattern: "sine" | "linear" | "random" = "sine",
): Sample[] {
  return Array.from({ length: count }, (_, i) => {
    switch (pattern) {
      case "sine":
        return {
          I: Math.sin((2 * Math.PI * i) / count) * 0.5,
          Q: Math.cos((2 * Math.PI * i) / count) * 0.5,
        };
      case "linear":
        return {
          I: (i / count - 0.5) * 0.2,
          Q: Math.sin((2 * Math.PI * i) / count) * 0.1,
        };
      case "random":
        return {
          I: (Math.random() - 0.5) * 0.5,
          Q: (Math.random() - 0.5) * 0.5,
        };
      default:
        return { I: 0, Q: 0 };
    }
  });
}

/**
 * Creates a mock canvas 2D rendering context for testing
 * @returns Mocked CanvasRenderingContext2D
 */
export function createMockCanvasContext(): CanvasRenderingContext2D {
  const mockContext = {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    strokeRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    resetTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillStyle: "",
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    createRadialGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
  };
  return mockContext as unknown as CanvasRenderingContext2D;
}

/**
 * Sets window.devicePixelRatio for testing purposes.
 * This function only sets the value; callers must use try-finally with restoreDevicePixelRatio for proper cleanup.
 * @param ratio The DPR value to set
 */
export function setDevicePixelRatio(ratio: number): void {
  Object.defineProperty(window, "devicePixelRatio", {
    writable: true,
    configurable: true,
    value: ratio,
  });
}

/**
 * Restores original window.devicePixelRatio value
 * @param originalValue The original DPR value to restore
 */
export function restoreDevicePixelRatio(originalValue: number): void {
  Object.defineProperty(window, "devicePixelRatio", {
    writable: true,
    configurable: true,
    value: originalValue,
  });
}
