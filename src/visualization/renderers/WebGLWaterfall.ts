import { WATERFALL_COLORMAPS } from "../../constants";
import * as webgl from "../../utils/webgl";
import type { Renderer } from "./types";

const WATERFALL_FS = `
precision mediump float;
uniform sampler2D uColormap;
uniform sampler2D uSpectrogram;
uniform float uGain;
uniform float uOffset;
varying vec2 v_texCoord;

void main() {
  float power = texture2D(uSpectrogram, v_texCoord).r;
  power = power * uGain + uOffset;
  gl_FragColor = texture2D(uColormap, vec2(power, 0.5));
}
`;

// Default texture dimensions for spectrogram data
const DEFAULT_SPECTROGRAM_WIDTH = 2048;
const DEFAULT_SPECTROGRAM_HEIGHT = 512;

export class WebGLWaterfall implements Renderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private aPosition = -1;
  private aTexCoord = -1;
  private uColormap: WebGLUniformLocation | null = null;
  private uSpectrogram: WebGLUniformLocation | null = null;
  private uGain: WebGLUniformLocation | null = null;
  private uOffset: WebGLUniformLocation | null = null;
  private spectrogramTexture: WebGLTexture | null = null;
  private colormapTexture: WebGLTexture | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private textureBuffer: WebGLBuffer | null = null;
  private textureSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  private currentRow = 0;

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      this.gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });

      if (!this.gl) {
        this.error("Failed to get WebGL context");
        return false;
      }

      const { gl } = this;
      this.program = webgl.createProgram(gl, webgl.FULLSCREEN_VS, WATERFALL_FS);

      this.aPosition = gl.getAttribLocation(this.program, "a_position");
      this.aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
      this.uColormap = gl.getUniformLocation(this.program, "uColormap");
      this.uSpectrogram = gl.getUniformLocation(this.program, "uSpectrogram");
      this.uGain = gl.getUniformLocation(this.program, "uGain");
      this.uOffset = gl.getUniformLocation(this.program, "uOffset");

      this.textureSize = {
        width: DEFAULT_SPECTROGRAM_WIDTH,
        height: DEFAULT_SPECTROGRAM_HEIGHT,
      };
      this.spectrogramTexture = webgl.createTextureLuminanceF32(
        gl,
        this.textureSize.width,
        this.textureSize.height,
        null,
      );
      this.colormapTexture = webgl.createTextureRGBA(gl, 256, 1, null);

      this.vertexBuffer = webgl.createBuffer(gl, webgl.QUAD_VERTICES);
      this.textureBuffer = webgl.createBuffer(gl, webgl.TEX_COORDS);

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
    const colormapRGBA = new Uint8Array(colormapData.length * 4);
    for (let i = 0; i < colormapData.length; i++) {
      const rgb = colormapData[i];
      if (!rgb || rgb.length < 3) {
        continue;
      }
      colormapRGBA[i * 4 + 0] = Math.round((rgb[0] ?? 0) * 255);
      colormapRGBA[i * 4 + 1] = Math.round((rgb[1] ?? 0) * 255);
      colormapRGBA[i * 4 + 2] = Math.round((rgb[2] ?? 0) * 255);
      colormapRGBA[i * 4 + 3] = 255; // Alpha
    }

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

    for (const row of spectrogram) {
      if (row.length !== this.textureSize.width) {
        // Resize texture if FFT size changes
        this.textureSize.width = row.length;
        if (this.spectrogramTexture) {
          gl.deleteTexture(this.spectrogramTexture);
        }
        this.spectrogramTexture = webgl.createTextureLuminanceF32(
          gl,
          this.textureSize.width,
          this.textureSize.height,
          null,
        );
        this.currentRow = 0;
        gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);
      }

      // Upload the new row to the current position in the texture
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        this.currentRow,
        this.textureSize.width,
        1,
        gl.LUMINANCE,
        gl.FLOAT,
        row,
      );
      this.currentRow = (this.currentRow + 1) % this.textureSize.height;
    }

    gl.uniform1i(this.uColormap, 0);
    gl.uniform1i(this.uSpectrogram, 1);
    gl.uniform1f(this.uGain, gain);
    gl.uniform1f(this.uOffset, offset);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colormapTexture);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aPosition);

    // We need to adjust texture coordinates to achieve the scrolling effect
    const y = this.currentRow / this.textureSize.height;
    const textureCoords = new Float32Array([0, y, 1, y, 0, y - 1, 1, y - 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aTexCoord);

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
