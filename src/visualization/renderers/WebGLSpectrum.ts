/**
 * WebGL renderer for spectrum display (frequency line chart)
 * Uses LINE_STRIP primitive for efficient GPU-accelerated rendering
 */

import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { DEFAULT_MARGIN } from "../grid";
import type { Renderer, SpectrumData } from "./types";

type GL = WebGL2RenderingContext | WebGLRenderingContext;

// Vertex shader: transforms frequency bin index and magnitude to NDC
const VERTEX_SHADER = `
attribute vec2 a_position; // x = bin index (0-1 normalized), y = magnitude (0-1 normalized)
varying vec2 v_position;

void main() {
  // Map to NDC: x from bin range, y from magnitude range
  gl_Position = vec4(a_position.x * 2.0 - 1.0, a_position.y * 2.0 - 1.0, 0.0, 1.0);
  v_position = a_position;
}
`;

// Fragment shader: blue gradient based on height
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_position;

void main() {
  // Blue gradient: brighter at top
  float intensity = 0.5 + v_position.y * 0.5;
  gl_FragColor = vec4(0.4 * intensity, 0.86 * intensity, 1.0 * intensity, 0.9);
}
`;

export class WebGLSpectrum implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: GL | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private aPosition = -1;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private lastCanvasWidth = 0;
  private lastCanvasHeight = 0;

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas;

    // Try WebGL2 first
    let gl: GL | null = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      desynchronized: true,
    }) as GL | null;

    // Fallback to WebGL1 if WebGL2 not available
    // Using if-statement pattern for clarity over ??= operator
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (!gl) {
      gl = (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        desynchronized: true,
      }) ??
        canvas.getContext("experimental-webgl", {
          alpha: false,
          antialias: false,
        })) as GL | null;
    }

    if (!gl) {
      return false;
    }

    // Store GL context
    this.gl = gl;
    this.dpr = window.devicePixelRatio || 1;

    // Compile shaders
    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertShader || !fragShader) {
      return false;
    }

    // Link program
    const program = gl.createProgram();
    // WebGL spec allows null return in error conditions despite TypeScript types
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!program) {
      return false;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("WebGL program link error:", gl.getProgramInfoLog(program));
      return false;
    }

    this.program = program;
    this.aPosition = gl.getAttribLocation(program, "a_position");

    // Create position buffer
    this.positionBuffer = gl.createBuffer();

    // Report successful renderer initialization tier
    try {
      // WebGL2 contexts have a different constructor in browsers
      const isWebGL2 =
        typeof WebGL2RenderingContext !== "undefined" &&
        gl instanceof WebGL2RenderingContext;
      renderTierManager.reportSuccess(
        isWebGL2 ? RenderTier.WebGL2 : RenderTier.WebGL1,
      );
    } catch {
      // ignore environment issues (SSR/tests)
    }

    return await Promise.resolve(true);
  }

  isReady(): boolean {
    return this.gl !== null && this.program !== null;
  }

  render(data: SpectrumData): boolean {
    const gl = this.gl;
    if (!gl || !this.program || !this.canvas || !this.positionBuffer) {
      return false;
    }

    const { magnitudes, freqMin, freqMax } = data;

    if (magnitudes.length === 0 || freqMax <= freqMin) {
      return false;
    }

    // Update canvas size only if it changed (avoid expensive getBoundingClientRect on every frame)
    const rect = this.canvas.getBoundingClientRect();
    const newWidth = rect.width;
    const newHeight = rect.height;
    const scaledWidth = newWidth * this.dpr;
    const scaledHeight = newHeight * this.dpr;

    if (
      scaledWidth !== this.lastCanvasWidth ||
      scaledHeight !== this.lastCanvasHeight
    ) {
      this.width = newWidth;
      this.height = newHeight;
      this.canvas.width = scaledWidth;
      this.canvas.height = scaledHeight;
      this.canvas.style.width = `${newWidth}px`;
      this.canvas.style.height = `${newHeight}px`;
      this.lastCanvasWidth = scaledWidth;
      this.lastCanvasHeight = scaledHeight;
      // Viewport needs update when canvas size changes
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    // Calculate data range
    let minMag = Infinity;
    let maxMag = -Infinity;

    for (let i = freqMin; i < freqMax && i < magnitudes.length; i++) {
      const mag = magnitudes[i];
      if (mag !== undefined && isFinite(mag)) {
        minMag = Math.min(minMag, mag);
        maxMag = Math.max(maxMag, mag);
      }
    }

    if (!isFinite(minMag) || !isFinite(maxMag)) {
      return false;
    }

    const magRange = maxMag - minMag;
    const binCount = freqMax - freqMin;

    // Build vertex data: [x0, y0, x1, y1, ...]
    // x: normalized bin index (0-1)
    // y: normalized magnitude (0-1)
    const vertices: number[] = [];

    // Chart margins must match CanvasSpectrum so overlay annotations align.
    const margin = DEFAULT_MARGIN;
    const chartWidth = this.width - margin.left - margin.right;
    const chartHeight = this.height - margin.top - margin.bottom;

    for (let i = freqMin; i < freqMax && i < magnitudes.length; i++) {
      const mag = magnitudes[i];
      if (mag === undefined || !isFinite(mag)) {
        continue;
      }

      // Normalized coordinates within the chart area
      const xNorm = (i - freqMin) / binCount; // 0..1 across data bins
      const yNorm = (mag - minMag) / Math.max(1e-9, magRange); // 0..1 across magnitude

      // Map normalized chart coords into full canvas normalized coords
      const fullX =
        (margin.left + xNorm * chartWidth) / Math.max(1, this.width);
      // Invert y so 0 -> top of chart; compute pixel Y first
      const pixelY = margin.top + chartHeight - yNorm * chartHeight;
      const fullY = pixelY / Math.max(1, this.height);

      vertices.push(fullX, fullY);
    }

    if (vertices.length === 0) {
      return false;
    }

    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

    // Clear canvas
    gl.clearColor(0.04, 0.06, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for smooth lines
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Use program
    gl.useProgram(this.program);

    // Set attributes
    gl.enableVertexAttribArray(this.aPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    // Draw line strip
    gl.lineWidth(2.0);
    gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);

    gl.disable(gl.BLEND);

    return true;
  }

  cleanup(): void {
    if (this.gl) {
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
      if (this.positionBuffer) {
        this.gl.deleteBuffer(this.positionBuffer);
      }
    }
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.positionBuffer = null;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) {
      return null;
    }

    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
}
