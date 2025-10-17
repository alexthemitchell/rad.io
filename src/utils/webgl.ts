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
  }) as WebGL2RenderingContext | null;
  if (gl2) {
    return { gl: gl2, isWebGL2: true };
  }

  const gl = (canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    desynchronized: true as unknown as boolean,
  }) ||
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
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
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
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const msg = gl.getProgramInfoLog(prog) || "Unknown program link error";
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

export function createTextureRGBA(
  gl: GL,
  width: number,
  height: number,
  data: Uint8Array | null,
): WebGLTexture {
  const tex = gl.createTexture()!;
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
    const [r0, g0, b0] = stops[i0]!;
    const [r1, g1, b1] = stops[i1]!;
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

export function setGLViewportForCanvas(
  gl: GL,
  width: number,
  height: number,
): void {
  gl.viewport(0, 0, width, height);
}
