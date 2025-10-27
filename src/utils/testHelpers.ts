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

/**
 * Wait for a condition to be true
 * Useful for async assertions in tests
 * @param condition Function that returns true when condition is met
 * @param timeout Maximum time to wait in milliseconds (default: 5000)
 * @param interval Polling interval in milliseconds (default: 50)
 * @returns Promise that resolves when condition is met or rejects on timeout
 * 
 * @example
 * await waitForCondition(() => element.textContent === 'Ready', 2000);
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 50,
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition timeout exceeded');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Create a mock WebGL rendering context for testing
 * @returns Mocked WebGLRenderingContext
 */
export function createMockWebGLContext(): WebGLRenderingContext {
  const mockContext = {
    canvas: document.createElement('canvas'),
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    getExtension: jest.fn(() => null),
    getParameter: jest.fn(() => null),
    createProgram: jest.fn(() => ({})),
    createShader: jest.fn(() => ({})),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    useProgram: jest.fn(),
    getShaderParameter: jest.fn(() => true),
    getProgramParameter: jest.fn(() => true),
    getAttribLocation: jest.fn(() => 0),
    getUniformLocation: jest.fn(() => ({})),
    createBuffer: jest.fn(() => ({})),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    vertexAttribPointer: jest.fn(),
    createTexture: jest.fn(() => ({})),
    bindTexture: jest.fn(),
    texParameteri: jest.fn(),
    texImage2D: jest.fn(),
    uniform1i: jest.fn(),
    uniform1f: jest.fn(),
    uniform2f: jest.fn(),
    uniform3f: jest.fn(),
    uniform4f: jest.fn(),
    uniformMatrix4fv: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    viewport: jest.fn(),
    drawArrays: jest.fn(),
    drawElements: jest.fn(),
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    FLOAT: 0x1406,
    TEXTURE_2D: 0x0DE1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
  };
  return mockContext as unknown as WebGLRenderingContext;
}

/**
 * Generate deterministic random numbers for testing
 * Uses a simple LCG (Linear Congruential Generator) for reproducibility
 */
export class SeededRandom {
  private seed: number;
  
  constructor(seed = 12345) {
    this.seed = seed;
  }
  
  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
  
  /**
   * Generate random number in range [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  /**
   * Reset to initial seed
   */
  reset(seed?: number): void {
    if (seed !== undefined) {
      this.seed = seed;
    }
  }
}

/**
 * Assert that two Float32Arrays are approximately equal
 * @param actual Actual array
 * @param expected Expected array
 * @param tolerance Maximum allowed difference per element (default: 1e-6)
 */
export function expectFloat32ArraysClose(
  actual: Float32Array,
  expected: Float32Array,
  tolerance = 1e-6,
): void {
  expect(actual.length).toBe(expected.length);
  
  for (let i = 0; i < actual.length; i++) {
    const actualVal = actual[i];
    const expectedVal = expected[i];
    
    if (actualVal === undefined || expectedVal === undefined) {
      throw new Error(`Missing value at index ${i}`);
    }
    
    const diff = Math.abs(actualVal - expectedVal);
    if (diff > tolerance) {
      throw new Error(
        `Arrays differ at index ${i}: ${actual[i]} vs ${expected[i]} (diff: ${diff}, tolerance: ${tolerance})`
      );
    }
  }
}

/**
 * Create a mock File object for testing file uploads
 * @param content File content
 * @param filename File name
 * @param mimeType MIME type (default: 'application/octet-stream')
 */
export function createMockFile(
  content: string | ArrayBuffer,
  filename: string,
  mimeType = 'application/octet-stream',
): File {
  const blob = new Blob([content], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * Suppress console warnings/errors during test execution
 * Useful for testing error cases without polluting test output
 * 
 * @example
 * const restore = suppressConsole(['error', 'warn']);
 * // ... test code that generates expected errors ...
 * restore();
 */
export function suppressConsole(
  methods: Array<'log' | 'warn' | 'error' | 'info'> = ['error', 'warn']
): () => void {
  const originals: Map<string, typeof console.log> = new Map();
  
  methods.forEach(method => {
    originals.set(method, console[method]);
    console[method] = jest.fn();
  });
  
  return () => {
    methods.forEach(method => {
    const original = originals.get(method);
    if (original) {
      console[method] = original as typeof console.log;
    }
  });
  };
}
