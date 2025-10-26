/**
 * WebGL renderer for waterfall display (time-frequency heatmap)
 * Uses texture-based rendering with Viridis colormap
 */

import type { Renderer, WaterfallData } from "./types";

type GL = WebGL2RenderingContext | WebGLRenderingContext;

// Fullscreen quad vertex shader
const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// Fragment shader with texture sampling
const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
  gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;

// Viridis colormap (11 control points)
const VIRIDIS_STOPS = [
  [68, 1, 84],
  [72, 35, 116],
  [64, 67, 135],
  [52, 94, 141],
  [41, 120, 142],
  [32, 144, 140],
  [34, 167, 132],
  [68, 190, 112],
  [121, 209, 81],
  [189, 223, 38],
  [253, 231, 37],
];

// Fullscreen quad vertices (NDC)
const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

// Texture coordinates
const TEX_COORDS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

export class WebGLWaterfall implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: GL | null = null;
  private isWebGL2 = false;
  private program: WebGLProgram | null = null;
  private quadVBO: WebGLBuffer | null = null;
  private uvVBO: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private lastTexSize: { w: number; h: number } | null = null;
  private colorLUT: Uint8Array | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas;

    // Try WebGL2 first
    let gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      desynchronized: true,
    }) as WebGL2RenderingContext | null;

    if (gl) {
      this.isWebGL2 = true;
    } else {
      // Fallback to WebGL1
      gl = (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        desynchronized: true,
      }) ??
        canvas.getContext("experimental-webgl", {
          alpha: false,
          antialias: false,
        })) as WebGLRenderingContext | null;
    }

    if (!gl) {
      return false;
    }

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
    if (!program) {
      return false;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        "WebGL program link error:",
        gl.getProgramInfoLog(program),
      );
      return false;
    }

    this.program = program;

    // Create vertex buffers
    this.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    this.uvVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVBO);
    gl.bufferData(gl.ARRAY_BUFFER, TEX_COORDS, gl.STATIC_DRAW);

    // Build color LUT
    this.buildColorLUT();

    return true;
  }

  isReady(): boolean {
    return this.gl !== null && this.program !== null;
  }

  render(data: WaterfallData): boolean {
    const gl = this.gl;
    if (!gl || !this.program || !this.canvas || !this.colorLUT) {
      return false;
    }

    const { frames, freqMin, freqMax } = data;

    if (frames.length === 0 || freqMax <= freqMin) {
      return false;
    }

    // Update canvas size
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    const binCount = freqMax - freqMin;
    const numFrames = frames.length;

    // Find global min/max for normalization
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (const frame of frames) {
      for (let bin = freqMin; bin < freqMax && bin < frame.length; bin++) {
        const value = frame[bin];
        if (value !== undefined && isFinite(value)) {
          globalMin = Math.min(globalMin, value);
          globalMax = Math.max(globalMax, value);
        }
      }
    }

    if (!isFinite(globalMin) || !isFinite(globalMax)) {
      return false;
    }

    // Apply 5% dynamic range compression
    const range = globalMax - globalMin;
    const effectiveMin = globalMin + range * 0.05;
    const effectiveRange = Math.max(1e-9, globalMax - effectiveMin);

    // Build RGBA texture: width = frames, height = bins
    const texW = Math.max(1, numFrames);
    const texH = Math.max(1, binCount);
    const rgba = new Uint8Array(texW * texH * 4);

    for (let x = 0; x < texW; x++) {
      const frame = frames[x];
      if (!frame) {
        continue;
      }

      for (let y = 0; y < texH; y++) {
        const bin = freqMin + y;
        const value = bin < frame.length ? (frame[bin] ?? 0) : 0;

        // Normalize to [0, 1]
        const normalized = (value - effectiveMin) / effectiveRange;
        const t = Math.max(0, Math.min(1, normalized));

        // Map to color using LUT
        const lutIdx = Math.floor(t * 255);
        const base = (x + y * texW) * 4;
        rgba[base + 0] = this.colorLUT[lutIdx * 3] ?? 0;
        rgba[base + 1] = this.colorLUT[lutIdx * 3 + 1] ?? 0;
        rgba[base + 2] = this.colorLUT[lutIdx * 3 + 2] ?? 0;
        rgba[base + 3] = 255;
      }
    }

    // Create or update texture
    if (
      !this.texture ||
      !this.lastTexSize ||
      this.lastTexSize.w !== texW ||
      this.lastTexSize.h !== texH
    ) {
      if (this.texture) {
        gl.deleteTexture(this.texture);
      }
      this.texture = this.createTextureRGBA(texW, texH, rgba);
      this.lastTexSize = { w: texW, h: texH };
    } else {
      this.updateTextureRGBA(this.texture, texW, texH, rgba);
    }

    // Setup viewport and clear
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.04, 0.06, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    const uTex = gl.getUniformLocation(this.program, "u_texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(uTex, 0);

    // Set attributes
    const aPos = gl.getAttribLocation(this.program, "a_position");
    const aUV = gl.getAttribLocation(this.program, "a_texCoord");

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVBO);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return true;
  }

  cleanup(): void {
    if (this.gl) {
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
      if (this.quadVBO) {
        this.gl.deleteBuffer(this.quadVBO);
      }
      if (this.uvVBO) {
        this.gl.deleteBuffer(this.uvVBO);
      }
      if (this.texture) {
        this.gl.deleteTexture(this.texture);
      }
    }
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.quadVBO = null;
    this.uvVBO = null;
    this.texture = null;
    this.lastTexSize = null;
    this.colorLUT = null;
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

  private createTextureRGBA(
    width: number,
    height: number,
    data: Uint8Array,
  ): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) {
      return null;
    }

    const texture = gl.createTexture();
    if (!texture) {
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  private updateTextureRGBA(
    texture: WebGLTexture,
    width: number,
    height: number,
    data: Uint8Array,
  ): void {
    const gl = this.gl;
    if (!gl) {
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
  }

  private buildColorLUT(): void {
    // Build 256-entry RGB lookup table via linear interpolation
    const lut = new Uint8Array(256 * 3);
    const numStops = VIRIDIS_STOPS.length;

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const segment = t * (numStops - 1);
      const idx = Math.floor(segment);
      const frac = segment - idx;

      const c0 = VIRIDIS_STOPS[idx] ?? [0, 0, 0];
      const c1 = VIRIDIS_STOPS[Math.min(idx + 1, numStops - 1)] ?? [0, 0, 0];

      lut[i * 3 + 0] = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
      lut[i * 3 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
      lut[i * 3 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
    }

    this.colorLUT = lut;
  }
}
