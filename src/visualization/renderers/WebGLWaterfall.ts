import { WATERFALL_COLORMAPS } from "../../constants";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import * as webgl from "../../utils/webgl";
import type { Renderer } from "./types";
import type { GL } from "../../utils/webgl";

const WATERFALL_FS = `
precision highp float;
uniform sampler2D uColormap;
uniform sampler2D uSpectrogram;
uniform float uGain;
uniform float uOffset;
uniform float uBypassColormap; // 1.0 = show grayscale of power, 0.0 = use colormap
varying vec2 v_texCoord;

void main() {
  float power = texture2D(uSpectrogram, v_texCoord).r;
  power = clamp(power * uGain + uOffset, 0.0, 1.0);
  vec4 cmap = texture2D(uColormap, vec2(power, 0.5));
  vec4 gray = vec4(power, power, power, 1.0);
  gl_FragColor = (uBypassColormap > 0.5) ? gray : cmap;
}
`;

// Default texture dimensions for spectrogram data
const DEFAULT_SPECTROGRAM_WIDTH = 2048;
const DEFAULT_SPECTROGRAM_HEIGHT = 512;

export class WebGLWaterfall implements Renderer {
  private gl: GL | null = null;
  private program: WebGLProgram | null = null;
  private aPosition = -1;
  private aTexCoord = -1;
  private uColormap: WebGLUniformLocation | null = null;
  private uSpectrogram: WebGLUniformLocation | null = null;
  private uGain: WebGLUniformLocation | null = null;
  private uOffset: WebGLUniformLocation | null = null;
  private uBypassColormap: WebGLUniformLocation | null = null;
  private spectrogramTexture: WebGLTexture | null = null;
  private colormapTexture: WebGLTexture | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private textureBuffer: WebGLBuffer | null = null;
  private textureSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  private currentRow = 0;
  private spectrogramSrcFormat = 0;
  private colormapRGBACache: Uint8Array | null = null;
  private lastColormapName: string | null = null;
  private rowU8: Uint8Array | null = null;
  private preNormalized = true;

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      const glInfo = webgl.getGL(canvas);
      this.gl = glInfo.gl;

      if (!this.gl) {
        this.error("Failed to get WebGL context");
        return false;
      }

      const gl = this.gl;
      this.program = webgl.createProgram(gl, webgl.FULLSCREEN_VS, WATERFALL_FS);

      this.aPosition = gl.getAttribLocation(this.program, "a_position");
      this.aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
      this.uColormap = gl.getUniformLocation(this.program, "uColormap");
      this.uSpectrogram = gl.getUniformLocation(this.program, "uSpectrogram");
      this.uGain = gl.getUniformLocation(this.program, "uGain");
      this.uOffset = gl.getUniformLocation(this.program, "uOffset");
      this.uBypassColormap = gl.getUniformLocation(
        this.program,
        "uBypassColormap",
      );

      this.textureSize = {
        width: DEFAULT_SPECTROGRAM_WIDTH,
        height: DEFAULT_SPECTROGRAM_HEIGHT,
      };
      // Use 8-bit single channel texture for broad compatibility
      this.spectrogramTexture = webgl.createTextureLuminanceU8(
        gl,
        this.textureSize.width,
        this.textureSize.height,
        null,
      );
      // Determine source format for subsequent row updates based on context
      this.spectrogramSrcFormat =
        gl instanceof WebGL2RenderingContext ? gl.RED : gl.LUMINANCE;
      // Use linear filtering on the spectrogram to avoid visible vertical aliasing
      // when the texture width exceeds the canvas resolution.
      gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      // Power-of-two sizes allow REPEAT for smooth wrap scrolling
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.colormapTexture = webgl.createTextureRGBA(gl, 256, 1, null);
      // Smooth the 1D colormap to avoid visible quantization bands
      gl.bindTexture(gl.TEXTURE_2D, this.colormapTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, null);

      this.vertexBuffer = webgl.createBuffer(gl, webgl.QUAD_VERTICES);
      this.textureBuffer = webgl.createBuffer(gl, webgl.TEX_COORDS);

      // Report tier based on context
      try {
        const isWebGL2 =
          typeof WebGL2RenderingContext !== "undefined" &&
          gl instanceof WebGL2RenderingContext;
        renderTierManager.reportSuccess(
          isWebGL2 ? RenderTier.WebGL2 : RenderTier.WebGL1,
        );
      } catch {
        // ignore
      }
      return true;
    } catch (error) {
      this.error(
        `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  isReady(): boolean {
    return this.gl !== null && this.program !== null;
  }

  render(data: {
    spectrogram?: Float32Array[];
    frames?: Float32Array[];
    colormapName?: keyof typeof WATERFALL_COLORMAPS;
    gain?: number;
    offset?: number;
    freqMin?: number;
    freqMax?: number;
    transform?: unknown;
  }): boolean {
    const { gl, program } = this;
    const spectrogram = data.spectrogram ?? data.frames;
    if (!gl || !program || !spectrogram || spectrogram.length === 0) {
      return false;
    }

    const colormapName = data.colormapName ?? "viridis";
    const gain = data.gain ?? 1.0;
    const offset = data.offset ?? 0.0;

    gl.useProgram(program);

    // Convert colormap from 0-1 range to 0-255 range for updateTextureRGBA
    const colormapData = WATERFALL_COLORMAPS[colormapName];
    // Cache colormap buffer to avoid reallocating on every render
    if (
      !this.colormapRGBACache ||
      this.lastColormapName !== colormapName ||
      this.colormapRGBACache.length !== colormapData.length * 4
    ) {
      this.colormapRGBACache = new Uint8Array(colormapData.length * 4);
      this.lastColormapName = colormapName;
      for (let i = 0; i < colormapData.length; i++) {
        const rgb = colormapData[i];
        if (!rgb || rgb.length < 3) {
          continue;
        }
        this.colormapRGBACache[i * 4 + 0] = Math.round((rgb[0] ?? 0) * 255);
        this.colormapRGBACache[i * 4 + 1] = Math.round((rgb[1] ?? 0) * 255);
        this.colormapRGBACache[i * 4 + 2] = Math.round((rgb[2] ?? 0) * 255);
        this.colormapRGBACache[i * 4 + 3] = 255; // Alpha
      }
    }
    const colormapRGBA = this.colormapRGBACache;

    if (!this.colormapTexture) {
      return false;
    }

    webgl.updateTextureRGBA(
      gl,
      this.colormapTexture,
      colormapData.length,
      1,
      colormapRGBA,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    for (const row of spectrogram) {
      if (row.length !== this.textureSize.width) {
        // Resize texture if FFT size changes
        this.textureSize.width = row.length;
        if (this.spectrogramTexture) {
          gl.deleteTexture(this.spectrogramTexture);
        }
        this.spectrogramTexture = webgl.createTextureLuminanceU8(
          gl,
          this.textureSize.width,
          this.textureSize.height,
          null,
        );
        gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.currentRow = 0;
        gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);
        this.spectrogramSrcFormat =
          gl instanceof WebGL2RenderingContext ? gl.RED : gl.LUMINANCE;
        // Reset row buffer cache
        this.rowU8 = null;
      }

      // Map row to 8-bit [0,255] using provided gain/offset (power normalization)
      const width = this.textureSize.width;
      if (!this.rowU8 || this.rowU8.length !== width) {
        this.rowU8 = new Uint8Array(width);
      }
      const u8 = this.rowU8;
      for (let i = 0; i < width; i++) {
        const v = row[i] ?? 0;
        // Apply same normalization as the shader would: clamp(gain*v + offset)
        const t = Math.max(0, Math.min(1, v * gain + offset));
        u8[i] = Math.round(t * 255);
      }
      // Upload the new row to the current position in the texture as UNSIGNED_BYTE
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        this.currentRow,
        width,
        1,
        this.spectrogramSrcFormat,
        gl.UNSIGNED_BYTE,
        u8,
      );
      this.currentRow = (this.currentRow + 1) % this.textureSize.height;
    }

    gl.uniform1i(this.uColormap, 0);
    gl.uniform1i(this.uSpectrogram, 1);
    // If rows are pre-normalized to [0,1] in U8, use identity mapping in shader
    gl.uniform1f(this.uGain, this.preNormalized ? 1.0 : gain);
    gl.uniform1f(this.uOffset, this.preNormalized ? 0.0 : offset);
    // Use colormap (set to 0.0). For quick debug, toggle to 1.0.
    if (this.uBypassColormap) {
      gl.uniform1f(this.uBypassColormap, 0.0);
    }

    // Ensure textures are bound to the units matching the uniforms
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colormapTexture);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aPosition);

    // Adjust texture coordinates for scrolling with half-texel offset to avoid seams
    const texH = this.textureSize.height;
    const halfY = 0.5 / texH;
    const y = (this.currentRow + 0.5) / texH; // center of current row
    const textureCoords = new Float32Array([
      0,
      y + halfY,
      1,
      y + halfY,
      0,
      y - 1 + halfY,
      1,
      y - 1 + halfY,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aTexCoord);

    // Set viewport to current drawing buffer size and draw
    gl.viewport(
      0,
      0,
      (gl as WebGLRenderingContext).drawingBufferWidth,
      (gl as WebGLRenderingContext).drawingBufferHeight,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return true;
  }

  cleanup(): void {
    const { gl } = this;
    if (!gl) {
      return;
    }
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.spectrogramTexture) {
      gl.deleteTexture(this.spectrogramTexture);
    }
    if (this.colormapTexture) {
      gl.deleteTexture(this.colormapTexture);
    }
    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
    }
    if (this.textureBuffer) {
      gl.deleteBuffer(this.textureBuffer);
    }
    this.gl = null;
    this.program = null;
  }

  private error(message: string): void {
    console.error(`[WebGLWaterfall] ${message}`);
  }
}
