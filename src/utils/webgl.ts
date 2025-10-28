/*
 WebGL utilities for rad.io visualizations
 - Safe context creation (WebGL2 preferred, fallback to WebGL1)
 - Shader/program compilation helpers
 - Texture helpers
 - Viridis colormap utilities (CPU + 1D LUT data)
*/

export type GL = WebGL2RenderingContext | WebGLRenderingContext;

export function getGL(canvas: HTMLCanvasElement): {
  gl: GL | null;
  isWebGL2: boolean;
} {
  // Prefer WebGL2
  const gl2 = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    desynchronized: true as unknown as boolean,
  });
  if (gl2) {
    return { gl: gl2, isWebGL2: true };
  }

  const gl = (canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    desynchronized: true as unknown as boolean,
  }) ??
    canvas.getContext("experimental-webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    })) as WebGLRenderingContext | null;
  return { gl, isWebGL2: false };
}

export function createShader(
  gl: GL,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create WebGL shader (context lost?)");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(msg);
  }
  return shader;
}

export function createProgram(
  gl: GL,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram() as WebGLProgram | null;
  if (prog === null) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error("Failed to create WebGL program (context lost?)");
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  // getProgramParameter can return GLboolean (number) or boolean depending on the parameter
  // For LINK_STATUS, it returns GLboolean (0 or 1), but TypeScript types it as any
  // We cast to boolean to satisfy type checking
  const linkStatus = Boolean(gl.getProgramParameter(prog, gl.LINK_STATUS));
  if (!linkStatus) {
    const msg = gl.getProgramInfoLog(prog) ?? "Unknown program link error";
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(msg);
  }
  // shaders can be deleted after linking
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

export function createBuffer(
  gl: GL,
  data: Float32Array | Uint16Array,
  target: number = gl.ARRAY_BUFFER,
  usage: number = gl.STATIC_DRAW,
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to create WebGL buffer");
  }
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  return buffer;
}

export function createTextureLuminanceF32(
  gl: GL,
  width: number,
  height: number,
  data: Float32Array | null,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) {
    throw new Error("Failed to create WebGL texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // Use FLOAT texture extension if available
  const ext = gl.getExtension("OES_texture_float");
  const internalFormat = gl instanceof WebGL2RenderingContext ? gl.R32F : gl.LUMINANCE;
  const srcFormat = gl instanceof WebGL2RenderingContext ? gl.RED : gl.LUMINANCE;
  const type = ext ? gl.FLOAT : gl.UNSIGNED_BYTE;
  const dataForUpload = type === gl.FLOAT ? data : (data ? new Uint8Array(data.buffer) : null);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    srcFormat,
    type,
    dataForUpload,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function createTextureRGBA(
  gl: GL,
  width: number,
  height: number,
  data: Uint8Array | null,
): WebGLTexture {
  const tex = gl.createTexture() as WebGLTexture | null;
  if (!tex) {
    throw new Error("Failed to create WebGL texture (context lost?)");
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Use nearest to avoid blurring small pixels
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
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
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function updateTextureRGBA(
  gl: GL,
  tex: WebGLTexture,
  width: number,
  height: number,
  data: Uint8Array,
): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
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
  gl.bindTexture(gl.TEXTURE_2D, null);
}

// Fullscreen quad positions
export const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

export const TEX_COORDS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

export const FULLSCREEN_VS = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const TEXTURE_FS = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
void main() {
  gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;

// Viridis 256-point lookup table (approximate). Values from matplotlib viridis.
// Stored as Uint8 RGBA for direct texture use or CPU mapping.
export function viridisLUT256(): Uint8Array {
  // Small compressed table for key stops; we'll interpolate to 256.
  const stops: Array<[number, number, number]> = [
    [68, 1, 84],
    [71, 44, 122],
    [59, 81, 139],
    [44, 113, 142],
    [33, 144, 141],
    [39, 173, 129],
    [92, 200, 99],
    [170, 220, 50],
    [253, 231, 37],
  ];
  const n = 256;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = t * (stops.length - 1);
    const i0 = Math.floor(x);
    const i1 = Math.min(stops.length - 1, i0 + 1);
    const f = x - i0;
    const stop0 = stops[i0];
    const stop1 = stops[i1];
    if (!stop0 || !stop1) {
      throw new Error("Invalid colormap stop index");
    }
    const [r0, g0, b0] = stop0;
    const [r1, g1, b1] = stop1;
    const r = Math.round(r0 + (r1 - r0) * f);
    const g = Math.round(g0 + (g1 - g0) * f);
    const b = Math.round(b0 + (b1 - b0) * f);
    out[i * 4 + 0] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function viridisMapScalarToRGBA(
  t: number,
): [number, number, number, number] {
  const lut = viridisLUT256();
  const idx = Math.max(0, Math.min(255, Math.round(t * 255)));
  const base = (idx << 2) >>> 0;
  const r = lut[base] ?? 0;
  const g = lut[base + 1] ?? 0;
  const b = lut[base + 2] ?? 0;
  return [r, g, b, 255];
}

// Additional colormaps (approximate) and a unified accessor.
// These are intentionally lightweight approximations suitable for visualization.
export function infernoLUT256(): Uint8Array {
  const stops: Array<[number, number, number]> = [
    [0, 0, 4],
    [31, 12, 72],
    [85, 15, 109],
    [136, 34, 106],
    [186, 54, 85],
    [227, 89, 51],
    [249, 140, 10],
    [252, 195, 58],
    [252, 255, 164],
  ];
  const n = 256;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = t * (stops.length - 1);
    const i0 = Math.floor(x);
    const i1 = Math.min(stops.length - 1, i0 + 1);
    const f = x - i0;
    const [r0, g0, b0] = stops[i0] ?? [0, 0, 0];
    const [r1, g1, b1] = stops[i1] ?? [0, 0, 0];
    out[i * 4 + 0] = Math.round(r0 + (r1 - r0) * f);
    out[i * 4 + 1] = Math.round(g0 + (g1 - g0) * f);
    out[i * 4 + 2] = Math.round(b0 + (b1 - b0) * f);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function turboLUT256(): Uint8Array {
  // Turbo approximation via key stops (Google Turbo colormap)
  const stops: Array<[number, number, number]> = [
    [48, 18, 59],
    [59, 32, 134],
    [33, 144, 141],
    [67, 190, 112],
    [144, 215, 67],
    [218, 226, 25],
    [245, 181, 0],
    [245, 96, 0],
    [204, 0, 0],
  ];
  const n = 256;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = t * (stops.length - 1);
    const i0 = Math.floor(x);
    const i1 = Math.min(stops.length - 1, i0 + 1);
    const f = x - i0;
    const [r0, g0, b0] = stops[i0] ?? [0, 0, 0];
    const [r1, g1, b1] = stops[i1] ?? [0, 0, 0];
    out[i * 4 + 0] = Math.round(r0 + (r1 - r0) * f);
    out[i * 4 + 1] = Math.round(g0 + (g1 - g0) * f);
    out[i * 4 + 2] = Math.round(b0 + (b1 - b0) * f);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function grayscaleLUT256(): Uint8Array {
  const n = 256;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = i;
    const base = i * 4;
    out[base + 0] = v;
    out[base + 1] = v;
    out[base + 2] = v;
    out[base + 3] = 255;
  }
  return out;
}

export type ColormapName = "viridis" | "inferno" | "turbo" | "gray";

export function getColormapLUT256(name: ColormapName): Uint8Array {
  switch (name) {
    case "inferno":
      return infernoLUT256();
    case "turbo":
      return turboLUT256();
    case "gray":
      return grayscaleLUT256();
    case "viridis":
    default:
      return viridisLUT256();
  }
}

export function setGLViewportForCanvas(
  gl: GL,
  width: number,
  height: number,
): void {
  gl.viewport(0, 0, width, height);
}
