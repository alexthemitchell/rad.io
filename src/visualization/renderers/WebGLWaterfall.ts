import * as webgl from "../../utils/webgl";
import { WATERFALL_COLORMAPS } from "../../constants";
import type { Renderer } from "./types";

const WATERFALL_FS = `
precision mediump float;
uniform sampler2D uColormap;
uniform sampler2D uSpectrogram;
uniform float uGain;
uniform float uOffset;
varying vec2 vTexCoord;

void main() {
  float power = texture2D(uSpectrogram, vTexCoord).r;
  power = power * uGain + uOffset;
  gl_FragColor = texture2D(uColormap, vec2(power, 0.5));
}
`;

export class WebGLWaterfall implements Renderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private aPosition: number = -1;
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

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
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
    if (!this.program) {
      this.error("Failed to create WebGL program");
      return false;
    }

    this.aPosition = gl.getAttribLocation(this.program, "aPosition");
    this.uColormap = gl.getUniformLocation(this.program, "uColormap");
    this.uSpectrogram = gl.getUniformLocation(this.program, "uSpectrogram");
    this.uGain = gl.getUniformLocation(this.program, "uGain");
    this.uOffset = gl.getUniformLocation(this.program, "uOffset");

    this.textureSize = { width: 2048, height: 512 }; // Default size
    this.spectrogramTexture = webgl.createTexture(
      gl,
      gl.LUMINANCE,
      this.textureSize.width,
      this.textureSize.height,
    );
    this.colormapTexture = webgl.createTexture(gl, gl.RGBA, 256, 1);

    this.vertexBuffer = webgl.createBuffer(gl, webgl.FULLSCREEN_VERTICES);
    this.textureBuffer = webgl.createBuffer(
      gl,
      webgl.FULLSCREEN_TEXTURE_COORDS,
    );

    return true;
  }

  isReady(): boolean {
    return this.gl !== null && this.program !== null;
  }

  render(data: {
    spectrogram: Float32Array[];
    colormapName: keyof typeof WATERFALL_COLORMAPS;
    gain: number;
    offset: number;
  }): boolean {
    const { gl, program } = this;
    if (!gl || !program || !data.spectrogram || data.spectrogram.length === 0) {
      return false;
    }

    const { spectrogram, colormapName, gain, offset } = data;

    gl.useProgram(program);

    webgl.updateTexture(
      gl,
      this.colormapTexture,
      WATERFALL_COLORMAPS[colormapName],
      gl.RGBA,
      256,
      1,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.spectrogramTexture);

    for (const row of spectrogram) {
      if (row.length !== this.textureSize.width) {
        // Resize texture if FFT size changes
        this.textureSize.width = row.length;
        if (this.spectrogramTexture) gl.deleteTexture(this.spectrogramTexture);
        this.spectrogramTexture = webgl.createTexture(
          gl,
          gl.LUMINANCE,
          this.textureSize.width,
          this.textureSize.height,
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
    const textureCoords = new Float32Array([
      0, y, 1, y, 0, y - 1, 1, y - 1,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return true;
  }

  cleanup(): void {
    const { gl } = this;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.spectrogramTexture) gl.deleteTexture(this.spectrogramTexture);
    if (this.colormapTexture) gl.deleteTexture(this.colormapTexture);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.textureBuffer) gl.deleteBuffer(this.textureBuffer);
  }

  private error(message: string): void {
    console.error(`[WebGLWaterfall] ${message}`);
  }
}
