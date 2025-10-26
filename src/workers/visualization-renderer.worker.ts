// Enhanced worker for off-main-thread visualization rendering
// Supports WebGL, WebGPU, and Canvas2D rendering with backpressure handling

type GL = WebGLRenderingContext | WebGL2RenderingContext;

type Sample = {
  I: number;
  Q: number;
};

type ViewTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type RenderConfig = {
  width: number;
  height: number;
  dpr: number;
  freqMin?: number;
  freqMax?: number;
};

type MessageInit = {
  type: "init";
  canvas: OffscreenCanvas;
  vizType: "spectrogram" | "constellation" | "waveform" | "waterfall";
  config: RenderConfig;
};

type MessageRender = {
  type: "render";
  frameId: number;
  data: {
    samples?: Sample[];
    fftData?: Float32Array[];
    transform?: ViewTransform;
  };
};

type MessageResize = {
  type: "resize";
  config: RenderConfig;
};

type MessageDispose = {
  type: "dispose";
};

// Frame queue management for backpressure
const MAX_QUEUE_SIZE = 3;
const frameQueue: MessageRender[] = [];
let isRendering = false;
let droppedFrames = 0;
let renderedFrames = 0;
let lastFrameTime = 0;

// Rendering state
let offscreen: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let gl: GL | null = null;
let glProgram: WebGLProgram | null = null;
let glVBO: WebGLBuffer | null = null;
let glColorVBO: WebGLBuffer | null = null;
let vizType: MessageInit["vizType"] | null = null;
let config: RenderConfig = { width: 0, height: 0, dpr: 1 };

// ============================================================================
// WebGL Utilities (minimal subset from src/utils/webgl.ts for worker)
// ============================================================================

function getGL(canvas: OffscreenCanvas): { gl: GL | null; isWebGL2: boolean } {
  const opts = { alpha: false, antialias: false, desynchronized: true };
  let context = canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null;
  if (context) {
    return { gl: context, isWebGL2: true };
  }
  context = canvas.getContext("webgl", opts) as WebGLRenderingContext | null;
  return { gl: context, isWebGL2: false };
}

function createShader(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: GL, vsSource: string, fsSource: string): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
}

// ============================================================================
// Setup and Initialization
// ============================================================================

function initializeRenderer(canvas: OffscreenCanvas, cfg: RenderConfig): boolean {
  offscreen = canvas;
  config = cfg;
  
  const pixelW = Math.max(1, Math.floor(cfg.width * cfg.dpr));
  const pixelH = Math.max(1, Math.floor(cfg.height * cfg.dpr));
  canvas.width = pixelW;
  canvas.height = pixelH;
  
  // Try WebGL first for performance
  const glResult = getGL(canvas);
  if (glResult.gl) {
    gl = glResult.gl;
    return true;
  }
  
  // Fallback to 2D context
  const context = canvas.getContext("2d", { alpha: false }) as OffscreenCanvasRenderingContext2D | null;
  if (context) {
    ctx = context;
    return true;
  }
  
  return false;
}

function resizeRenderer(cfg: RenderConfig): void {
  config = cfg;
  
  if (!offscreen) return;
  
  const pixelW = Math.max(1, Math.floor(cfg.width * cfg.dpr));
  const pixelH = Math.max(1, Math.floor(cfg.height * cfg.dpr));
  offscreen.width = pixelW;
  offscreen.height = pixelH;
  
  // Re-initialize GL program if needed
  if (gl && glProgram) {
    gl.deleteProgram(glProgram);
    glProgram = null;
  }
  
  // Reset 2D context scaling
  if (ctx) {
    const ctxReset = ctx as { reset?: () => void };
    if (typeof ctxReset.reset === "function") {
      ctxReset.reset();
    }
    ctx.scale(cfg.dpr, cfg.dpr);
  }
}

// ============================================================================
// WebGL Rendering Functions
// ============================================================================

function renderConstellationWebGL(samples: Sample[], transform?: ViewTransform): boolean {
  if (!gl || !offscreen) return false;
  
  const pixelW = offscreen.width;
  const pixelH = offscreen.height;
  
  // Create shader program if needed
  if (!glProgram) {
    const vs = `
attribute vec2 a_position;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  v_color = a_color;
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = ${Math.max(2, Math.round(2 * config.dpr))}.0;
}`;
    const fs = `
precision mediump float;
varying vec4 v_color;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  gl_FragColor = v_color;
}`;
    glProgram = createProgram(gl, vs, fs);
    if (!glProgram) return false;
    
    glVBO = gl.createBuffer();
    glColorVBO = gl.createBuffer();
  }
  
  // Build positions in NDC [-1,1]
  const iValues = samples.map((s) => s.I);
  const qValues = samples.map((s) => s.Q);
  const iMin = Math.min(...iValues, -0.1);
  const iMax = Math.max(...iValues, 0.1);
  const qMin = Math.min(...qValues, -0.1);
  const qMax = Math.max(...qValues, 0.1);
  const padI = (iMax - iMin) * 0.1;
  const padQ = (qMax - qMin) * 0.1;
  const sI = 2 / (iMax - iMin + 2 * padI);
  const sQ = 2 / (qMax - qMin + 2 * padQ);
  const oI = -1 - sI * (iMin - padI);
  const oQ = -1 - sQ * (qMin - padQ);
  
  const positions = new Float32Array(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s) continue;
    positions[i * 2 + 0] = sI * s.I + oI;
    positions[i * 2 + 1] = sQ * s.Q + oQ;
  }
  
  // Density-based alpha calculation
  const gridSize = 0.003;
  const densityMap = new Map<string, number>();
  const MAX_DENSITY_SAMPLES = 8192;
  const densitySamples = samples.length > MAX_DENSITY_SAMPLES
    ? samples.filter((_, i) => i % Math.ceil(samples.length / MAX_DENSITY_SAMPLES) === 0)
    : samples;
  
  for (const s of densitySamples) {
    const gi = Math.round(s.I / gridSize) * gridSize;
    const gq = Math.round(s.Q / gridSize) * gridSize;
    const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
    densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
  }
  const maxDensity = Math.max(...Array.from(densityMap.values()), 1);
  
  const colors = new Float32Array(samples.length * 4);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s) continue;
    const gi = Math.round(s.I / gridSize) * gridSize;
    const gq = Math.round(s.Q / gridSize) * gridSize;
    const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
    const dens = (densityMap.get(key) ?? 1) / maxDensity;
    const alpha = Math.min(1, 0.4 + dens * 0.8);
    colors[i * 4 + 0] = 0.31; // r ~ 80/255
    colors[i * 4 + 1] = 0.78; // g ~ 200/255
    colors[i * 4 + 2] = 1.0;  // b ~ 255/255
    colors[i * 4 + 3] = alpha;
  }
  
  // Render
  gl.viewport(0, 0, pixelW, pixelH);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.04, 0.06, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  gl.useProgram(glProgram);
  const aPos = gl.getAttribLocation(glProgram, "a_position");
  const aCol = gl.getAttribLocation(glProgram, "a_color");
  
  gl.bindBuffer(gl.ARRAY_BUFFER, glVBO);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, glColorVBO);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aCol);
  gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);
  
  gl.drawArrays(gl.POINTS, 0, samples.length);
  
  return true;
}

function renderWaveformWebGL(samples: Sample[]): boolean {
  if (!gl || !offscreen) return false;
  
  const pixelW = offscreen.width;
  const pixelH = offscreen.height;
  
  // Create shader program if needed
  if (!glProgram) {
    const vs = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
    const fs = `
precision mediump float;
void main() {
  gl_FragColor = vec4(0.39, 0.86, 1.0, 0.9);
}`;
    glProgram = createProgram(gl, vs, fs);
    if (!glProgram) return false;
    
    glVBO = gl.createBuffer();
  }
  
  // Calculate amplitudes
  const amps = samples.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
  const maxAmp = Math.max(...amps, 1);
  const minAmp = Math.min(...amps, 0);
  const padding = (maxAmp - minAmp) * 0.1;
  const displayMin = minAmp - padding;
  const displayMax = maxAmp + padding;
  const displayRange = displayMax - displayMin || 1;
  
  // Build line strip in NDC
  const positions = new Float32Array(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const x = -1 + (i / samples.length) * 2;
    const y = -1 + ((amps[i] - displayMin) / displayRange) * 2;
    positions[i * 2 + 0] = x;
    positions[i * 2 + 1] = y;
  }
  
  // Render
  gl.viewport(0, 0, pixelW, pixelH);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0.04, 0.06, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  gl.useProgram(glProgram);
  const aPos = gl.getAttribLocation(glProgram, "a_position");
  
  gl.bindBuffer(gl.ARRAY_BUFFER, glVBO);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  
  gl.lineWidth(2.0);
  gl.drawArrays(gl.LINE_STRIP, 0, samples.length);
  
  return true;
}

// ============================================================================
// Canvas 2D Rendering Functions (Fallback)
// ============================================================================

function clearBackground(): void {
  if (!ctx) return;
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, config.width, config.height);
}

function renderConstellation2D(samples: Sample[], transform?: ViewTransform): void {
  if (!ctx) return;
  
  clearBackground();
  
  if (transform) {
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);
  }
  
  const margin = { top: 60, bottom: 70, left: 80, right: 60 };
  const chartWidth = config.width - margin.left - margin.right;
  const chartHeight = config.height - margin.top - margin.bottom;
  
  const iValues = samples.map((s) => s.I);
  const qValues = samples.map((s) => s.Q);
  const iMin = Math.min(...iValues, -0.1);
  const iMax = Math.max(...iValues, 0.1);
  const qMin = Math.min(...qValues, -0.1);
  const qMax = Math.max(...qValues, 0.1);
  
  const iPadding = (iMax - iMin) * 0.1;
  const qPadding = (qMax - qMin) * 0.1;
  
  const scaleI = (i: number): number =>
    margin.left + ((i - (iMin - iPadding)) / (iMax - iMin + 2 * iPadding)) * chartWidth;
  const scaleQ = (q: number): number =>
    margin.top + chartHeight - ((q - (qMin - qPadding)) / (qMax - qMin + 2 * qPadding)) * chartHeight;
  
  // Density calculation
  const gridSize = 0.003;
  const densityMap = new Map<string, number>();
  samples.forEach((s) => {
    const gi = Math.round(s.I / gridSize) * gridSize;
    const gq = Math.round(s.Q / gridSize) * gridSize;
    const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
    densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
  });
  const maxDensity = Math.max(...Array.from(densityMap.values()), 1);
  
  const samplesWithDensity = samples.map((sample) => {
    const gi = Math.round(sample.I / gridSize) * gridSize;
    const gq = Math.round(sample.Q / gridSize) * gridSize;
    const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
    const density = (densityMap.get(key) ?? 1) / maxDensity;
    return { sample, density };
  });
  samplesWithDensity.sort((a, b) => a.density - b.density);
  
  samplesWithDensity.forEach(({ sample, density }) => {
    const x = scaleI(sample.I);
    const y = scaleQ(sample.Q);
    const alpha = Math.min(1, 0.4 + density * 0.8);
    ctx.fillStyle = `rgba(80,200,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, density > 0.5 ? 2.5 : 2, 0, Math.PI * 2);
    ctx.fill();
  });
  
  if (transform) {
    ctx.restore();
  }
}

function renderWaveform2D(samples: Sample[]): void {
  if (!ctx) return;
  
  clearBackground();
  
  const margin = { top: 60, bottom: 60, left: 70, right: 60 };
  const chartWidth = config.width - margin.left - margin.right;
  const chartHeight = config.height - margin.top - margin.bottom;
  
  const amps = samples.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
  const maxAmp = Math.max(...amps, 1);
  const minAmp = Math.min(...amps, 0);
  const padding = (maxAmp - minAmp) * 0.1;
  const displayMin = minAmp - padding;
  const displayMax = maxAmp + padding;
  const displayRange = displayMax - displayMin || 1;
  
  const maxPoints = Math.max(100, Math.round(chartWidth * 2));
  const step = Math.max(1, Math.floor(amps.length / maxPoints));
  
  ctx.beginPath();
  for (let i = 0; i < amps.length; i += step) {
    const x = margin.left + (i / amps.length) * chartWidth;
    const amp = amps[i];
    if (amp === undefined) continue;
    const y = margin.top + chartHeight - ((amp - displayMin) / displayRange) * chartHeight;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(100,220,255,0.9)";
  ctx.stroke();
}

function renderSpectrogram2D(fftData: Float32Array[]): void {
  if (!ctx) return;
  
  clearBackground();
  
  const margin = { top: 70, bottom: 70, left: 80, right: 120 };
  const chartWidth = config.width - margin.left - margin.right;
  const chartHeight = config.height - margin.top - margin.bottom;
  const numFrames = fftData.length;
  const frameWidth = Math.max(1, chartWidth / Math.max(1, numFrames));
  
  const freqMin = config.freqMin ?? 0;
  const freqMax = config.freqMax ?? (fftData[0]?.length ?? 0);
  
  // Compute global min/max
  let gmin = Infinity;
  let gmax = -Infinity;
  for (const row of fftData) {
    for (let b = freqMin; b < freqMax && b < row.length; b++) {
      const v = row[b];
      if (typeof v === "number" && isFinite(v)) {
        gmin = Math.min(gmin, v);
        gmax = Math.max(gmax, v);
      }
    }
  }
  if (!isFinite(gmin)) gmin = 0;
  if (!isFinite(gmax)) gmax = 1;
  const effMin = gmin + (gmax - gmin) * 0.05;
  
  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const row = fftData[frameIdx];
    if (!row) continue;
    const x = margin.left + frameIdx * frameWidth;
    for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
      const v = row[bin];
      if (!(typeof v === "number") || !isFinite(v)) continue;
      const norm = (v - effMin) / (gmax - effMin || 1);
      const clamped = Math.max(0, Math.min(1, norm));
      const r = Math.round(68 + 185 * clamped);
      const g = Math.round(1 + 220 * clamped);
      const b = Math.round(84 - 50 * clamped);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const binHeight = chartHeight / Math.max(1, freqMax - freqMin);
      const y = margin.top + chartHeight - (bin - freqMin) * binHeight;
      ctx.fillRect(x, y - binHeight, frameWidth + 0.5, binHeight + 0.5);
    }
  }
}

// ============================================================================
// Frame Queue Management and Rendering
// ============================================================================

function processNextFrame(): void {
  if (isRendering || frameQueue.length === 0) {
    return;
  }
  
  isRendering = true;
  const frame = frameQueue.shift()!;
  const start = performance.now();
  
  try {
    let success = false;
    
    if (vizType === "constellation" && frame.data.samples) {
      if (gl) {
        success = renderConstellationWebGL(frame.data.samples, frame.data.transform);
      }
      if (!success && ctx) {
        renderConstellation2D(frame.data.samples, frame.data.transform);
        success = true;
      }
    } else if (vizType === "waveform" && frame.data.samples) {
      if (gl) {
        success = renderWaveformWebGL(frame.data.samples);
      }
      if (!success && ctx) {
        renderWaveform2D(frame.data.samples);
        success = true;
      }
    } else if (vizType === "spectrogram" && frame.data.fftData) {
      // Spectrogram typically uses 2D for now
      if (ctx) {
        renderSpectrogram2D(frame.data.fftData);
        success = true;
      }
    }
    
    const end = performance.now();
    const renderTime = end - start;
    lastFrameTime = end;
    renderedFrames++;
    
    postMessage({
      type: "frameComplete",
      frameId: frame.frameId,
      renderTimeMs: renderTime,
      queueSize: frameQueue.length,
      droppedFrames,
      renderedFrames,
    });
  } catch (err) {
    console.error("Rendering error:", err);
    postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isRendering = false;
    // Process next frame if available
    if (frameQueue.length > 0) {
      setTimeout(processNextFrame, 0);
    }
  }
}

function enqueueFrame(frame: MessageRender): void {
  // Implement backpressure: drop oldest frames if queue is full
  if (frameQueue.length >= MAX_QUEUE_SIZE) {
    const dropped = frameQueue.shift();
    if (dropped) {
      droppedFrames++;
      postMessage({
        type: "frameDropped",
        frameId: dropped.frameId,
        reason: "queue_full",
        queueSize: frameQueue.length,
      });
    }
  }
  
  frameQueue.push(frame);
  processNextFrame();
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (ev: MessageEvent<MessageInit | MessageRender | MessageResize | MessageDispose>): void => {
  const msg = ev.data;
  
  try {
    if (msg.type === "init") {
      vizType = msg.vizType;
      const success = initializeRenderer(msg.canvas, msg.config);
      postMessage({
        type: "initialized",
        success,
        hasWebGL: gl !== null,
        has2D: ctx !== null,
      });
      return;
    }
    
    if (msg.type === "resize") {
      resizeRenderer(msg.config);
      postMessage({ type: "resized" });
      return;
    }
    
    if (msg.type === "render") {
      enqueueFrame(msg);
      return;
    }
    
    if (msg.type === "dispose") {
      // Cleanup
      if (gl) {
        if (glVBO) gl.deleteBuffer(glVBO);
        if (glColorVBO) gl.deleteBuffer(glColorVBO);
        if (glProgram) gl.deleteProgram(glProgram);
      }
      offscreen = null;
      ctx = null;
      gl = null;
      glProgram = null;
      glVBO = null;
      glColorVBO = null;
      frameQueue.length = 0;
      close();
      return;
    }
  } catch (err) {
    postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
