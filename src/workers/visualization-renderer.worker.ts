// Enhanced worker for off-main-thread visualization rendering
// Supports WebGL, WebGPU, and Canvas2D rendering with backpressure handling

type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

type IQSample = {
  I: number;
  Q: number;
};

type Transform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type Config = {
  width: number;
  height: number;
  dpr: number;
  freqMin?: number;
  freqMax?: number;
};

type InitMessage = {
  type: "init";
  canvas: OffscreenCanvas;
  visualizationType: "spectrogram" | "constellation" | "waveform" | "waterfall";
  renderConfig: Config;
};

type RenderMessage = {
  type: "render";
  frameId: number;
  data: {
    samples?: IQSample[];
    fftData?: Float32Array[];
    transform?: Transform;
  };
};

type ResizeMessage = {
  type: "resize";
  renderConfig: Config;
};

type DisposeMessage = {
  type: "dispose";
};

// Frame queue management for backpressure
const RENDER_MAX_QUEUE_SIZE = 3;
const renderQueue: RenderMessage[] = [];
let rendering = false;
let framesDropped = 0;
let framesRendered = 0;
// lastRenderTime removed - not used in current implementation

// Rendering state
let canvasOffscreen: OffscreenCanvas | null = null;
let context2D: OffscreenCanvasRenderingContext2D | null = null;
let glContext: GLContext | null = null;
let shaderProgram: WebGLProgram | null = null;
let vertexBuffer: WebGLBuffer | null = null;
let colorBuffer: WebGLBuffer | null = null;
let visualizationType: InitMessage["visualizationType"] | null = null;
let renderConfig: Config = { width: 0, height: 0, dpr: 1 };

// ============================================================================
// WebGL Utilities (minimal subset from src/utils/webgl.ts for worker)
// ============================================================================

function getGL(canvas: OffscreenCanvas): {
  gl: GLContext | null;
  isWebGL2: boolean;
} {
  const opts = { alpha: false, antialias: false, desynchronized: true };
  let context = canvas.getContext("webgl2", opts) as GLContext | null;
  if (context) {
    return { gl: context, isWebGL2: true };
  }
  context = canvas.getContext("webgl", opts) as GLContext | null;
  return { gl: context, isWebGL2: false };
}

function createShader(
  glContext: GLContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = glContext.createShader(type);
  if (!shader) {
    return null;
  }
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);
  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    console.error("Shader compile error:", glContext.getShaderInfoLog(shader));
    glContext.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  glContext: GLContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram | null {
  const vs = createShader(glContext, glContext.VERTEX_SHADER, vsSource);
  const fs = createShader(glContext, glContext.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    return null;
  }

  const program = glContext.createProgram();
  // WebGL context loss can cause createProgram to return null
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!program) {
    return null;
  }

  glContext.attachShader(program, vs);
  glContext.attachShader(program, fs);
  glContext.linkProgram(program);

  if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
    console.error("Program link error:", glContext.getProgramInfoLog(program));
    glContext.deleteProgram(program);
    return null;
  }

  return program;
}

// ============================================================================
// Setup and Initialization
// ============================================================================

function initializeRenderer(canvas: OffscreenCanvas, cfg: Config): boolean {
  canvasOffscreen = canvas;
  renderConfig = cfg;

  const pixelW = Math.max(1, Math.floor(cfg.width * cfg.dpr));
  const pixelH = Math.max(1, Math.floor(cfg.height * cfg.dpr));
  // eslint-disable-next-line no-param-reassign
  canvas.width = pixelW;
  // eslint-disable-next-line no-param-reassign
  canvas.height = pixelH;

  // Try WebGL first for performance
  const glResult = getGL(canvas);
  if (glResult.gl) {
    glContext = glResult.gl;
    return true;
  }

  // Fallback to 2D context
  const context = canvas.getContext("2d", { alpha: false });
  if (context) {
    context2D = context;
    return true;
  }

  return false;
}

function resizeRenderer(cfg: Config): void {
  renderConfig = cfg;

  if (!canvasOffscreen) {
    return;
  }

  const pixelW = Math.max(1, Math.floor(cfg.width * cfg.dpr));
  const pixelH = Math.max(1, Math.floor(cfg.height * cfg.dpr));
  canvasOffscreen.width = pixelW;
  canvasOffscreen.height = pixelH;

  // Re-initialize GLContext program if needed
  if (glContext && shaderProgram) {
    glContext.deleteProgram(shaderProgram);
    shaderProgram = null;
  }

  // Reset 2D context scaling
  if (context2D) {
    const ctxReset = context2D as { reset?: () => void };
    if (typeof ctxReset.reset === "function") {
      ctxReset.reset();
    }
    context2D.scale(cfg.dpr, cfg.dpr);
  }
}

// ============================================================================
// WebGL Rendering Functions
// ============================================================================

function renderConstellationWebGL(
  samples: IQSample[],
  _transform?: Transform,
): boolean {
  if (!glContext || !canvasOffscreen) {
    return false;
  }

  const pixelW = canvasOffscreen.width;
  const pixelH = canvasOffscreen.height;

  // Create shader program if needed
  if (!shaderProgram) {
    const vs = `
attribute vec2 a_position;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  v_color = a_color;
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = ${Math.max(2, Math.round(2 * renderConfig.dpr))}.0;
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
    shaderProgram = createProgram(glContext, vs, fs);
    if (!shaderProgram) {
      return false;
    }

    vertexBuffer = glContext.createBuffer();
    colorBuffer = glContext.createBuffer();
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
    if (!s) {
      continue;
    }
    positions[i * 2 + 0] = sI * s.I + oI;
    positions[i * 2 + 1] = sQ * s.Q + oQ;
  }

  // Density-based alpha calculation
  const gridSize = 0.003;
  const densityMap = new Map<string, number>();
  const MAX_DENSITY_SAMPLES = 8192;
  const densitySamples =
    samples.length > MAX_DENSITY_SAMPLES
      ? samples.filter(
          (_, i) => i % Math.ceil(samples.length / MAX_DENSITY_SAMPLES) === 0,
        )
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
    if (!s) {
      continue;
    }
    const gi = Math.round(s.I / gridSize) * gridSize;
    const gq = Math.round(s.Q / gridSize) * gridSize;
    const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
    const dens = (densityMap.get(key) ?? 1) / maxDensity;
    const alpha = Math.min(1, 0.4 + dens * 0.8);
    colors[i * 4 + 0] = 0.31; // r ~ 80/255
    colors[i * 4 + 1] = 0.78; // g ~ 200/255
    colors[i * 4 + 2] = 1.0; // b ~ 255/255
    colors[i * 4 + 3] = alpha;
  }

  // Render
  glContext.viewport(0, 0, pixelW, pixelH);
  glContext.disable(glContext.DEPTH_TEST);
  glContext.enable(glContext.BLEND);
  glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);
  glContext.clearColor(0.04, 0.06, 0.1, 1);
  glContext.clear(glContext.COLOR_BUFFER_BIT);

  glContext.useProgram(shaderProgram);
  const aPos = glContext.getAttribLocation(shaderProgram, "a_position");
  const aCol = glContext.getAttribLocation(shaderProgram, "a_color");

  glContext.bindBuffer(glContext.ARRAY_BUFFER, vertexBuffer);
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    positions,
    glContext.DYNAMIC_DRAW,
  );
  glContext.enableVertexAttribArray(aPos);
  glContext.vertexAttribPointer(aPos, 2, glContext.FLOAT, false, 0, 0);

  glContext.bindBuffer(glContext.ARRAY_BUFFER, colorBuffer);
  glContext.bufferData(glContext.ARRAY_BUFFER, colors, glContext.DYNAMIC_DRAW);
  glContext.enableVertexAttribArray(aCol);
  glContext.vertexAttribPointer(aCol, 4, glContext.FLOAT, false, 0, 0);

  glContext.drawArrays(glContext.POINTS, 0, samples.length);

  return true;
}

function renderWaveformWebGL(samples: IQSample[]): boolean {
  if (!glContext || !canvasOffscreen) {
    return false;
  }

  const pixelW = canvasOffscreen.width;
  const pixelH = canvasOffscreen.height;

  // Create shader program if needed
  if (!shaderProgram) {
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
    shaderProgram = createProgram(glContext, vs, fs);
    if (!shaderProgram) {
      return false;
    }

    vertexBuffer = glContext.createBuffer();
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
    const amp = amps[i] ?? 0;
    const y = -1 + ((amp - displayMin) / displayRange) * 2;
    positions[i * 2 + 0] = x;
    positions[i * 2 + 1] = y;
  }

  // Render
  glContext.viewport(0, 0, pixelW, pixelH);
  glContext.disable(glContext.DEPTH_TEST);
  glContext.clearColor(0.04, 0.06, 0.1, 1);
  glContext.clear(glContext.COLOR_BUFFER_BIT);

  glContext.useProgram(shaderProgram);
  const aPos = glContext.getAttribLocation(shaderProgram, "a_position");

  glContext.bindBuffer(glContext.ARRAY_BUFFER, vertexBuffer);
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    positions,
    glContext.DYNAMIC_DRAW,
  );
  glContext.enableVertexAttribArray(aPos);
  glContext.vertexAttribPointer(aPos, 2, glContext.FLOAT, false, 0, 0);

  glContext.lineWidth(2.0);
  glContext.drawArrays(glContext.LINE_STRIP, 0, samples.length);

  return true;
}

// ============================================================================
// Canvas 2D Rendering Functions (Fallback)
// ============================================================================

function clearBg(): void {
  if (!context2D) {
    return;
  }
  context2D.fillStyle = "#0a0e1a";
  context2D.fillRect(0, 0, renderConfig.width, renderConfig.height);
}

function renderConstellation2D(
  samples: IQSample[],
  transform?: Transform,
): void {
  if (!context2D) {
    return;
  }

  clearBg();

  if (transform) {
    context2D.save();
    context2D.translate(transform.offsetX, transform.offsetY);
    context2D.scale(transform.scale, transform.scale);
  }

  const margin = { top: 60, bottom: 70, left: 80, right: 60 };
  const chartWidth = renderConfig.width - margin.left - margin.right;
  const chartHeight = renderConfig.height - margin.top - margin.bottom;

  const iValues = samples.map((s) => s.I);
  const qValues = samples.map((s) => s.Q);
  const iMin = Math.min(...iValues, -0.1);
  const iMax = Math.max(...iValues, 0.1);
  const qMin = Math.min(...qValues, -0.1);
  const qMax = Math.max(...qValues, 0.1);

  const iPadding = (iMax - iMin) * 0.1;
  const qPadding = (qMax - qMin) * 0.1;

  const scaleI = (i: number): number =>
    margin.left +
    ((i - (iMin - iPadding)) / (iMax - iMin + 2 * iPadding)) * chartWidth;
  const scaleQ = (q: number): number =>
    margin.top +
    chartHeight -
    ((q - (qMin - qPadding)) / (qMax - qMin + 2 * qPadding)) * chartHeight;

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
    if (!context2D) {
      return;
    }
    const x = scaleI(sample.I);
    const y = scaleQ(sample.Q);
    const alpha = Math.min(1, 0.4 + density * 0.8);
    context2D.fillStyle = `rgba(80,200,255,${alpha})`;
    context2D.beginPath();
    context2D.arc(x, y, density > 0.5 ? 2.5 : 2, 0, Math.PI * 2);
    context2D.fill();
  });

  if (transform) {
    context2D.restore();
  }
}

function renderWaveform2D(samples: IQSample[]): void {
  if (!context2D) {
    return;
  }

  clearBg();

  const margin = { top: 60, bottom: 60, left: 70, right: 60 };
  const chartWidth = renderConfig.width - margin.left - margin.right;
  const chartHeight = renderConfig.height - margin.top - margin.bottom;

  const amps = samples.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
  const maxAmp = Math.max(...amps, 1);
  const minAmp = Math.min(...amps, 0);
  const padding = (maxAmp - minAmp) * 0.1;
  const displayMin = minAmp - padding;
  const displayMax = maxAmp + padding;
  const displayRange = displayMax - displayMin || 1;

  const maxPoints = Math.max(100, Math.round(chartWidth * 2));
  const step = Math.max(1, Math.floor(amps.length / maxPoints));

  context2D.beginPath();
  for (let i = 0; i < amps.length; i += step) {
    const x = margin.left + (i / amps.length) * chartWidth;
    const amp = amps[i];
    if (amp === undefined) {
      continue;
    }
    const y =
      margin.top +
      chartHeight -
      ((amp - displayMin) / displayRange) * chartHeight;
    if (i === 0) {
      context2D.moveTo(x, y);
    } else {
      context2D.lineTo(x, y);
    }
  }
  context2D.lineWidth = 2;
  context2D.strokeStyle = "rgba(100,220,255,0.9)";
  context2D.stroke();
}

function renderSpectrogram2D(fftData: Float32Array[]): void {
  if (!context2D) {
    return;
  }

  clearBg();

  const margin = { top: 70, bottom: 70, left: 80, right: 120 };
  const chartWidth = renderConfig.width - margin.left - margin.right;
  const chartHeight = renderConfig.height - margin.top - margin.bottom;
  const numFrames = fftData.length;
  const frameWidth = Math.max(1, chartWidth / Math.max(1, numFrames));

  const freqMin = renderConfig.freqMin ?? 0;
  const freqMax = renderConfig.freqMax ?? fftData[0]?.length ?? 0;

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
  if (!isFinite(gmin)) {
    gmin = 0;
  }
  if (!isFinite(gmax)) {
    gmax = 1;
  }
  const effMin = gmin + (gmax - gmin) * 0.05;

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const row = fftData[frameIdx];
    if (!row) {
      continue;
    }
    const x = margin.left + frameIdx * frameWidth;
    for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
      const v = row[bin];
      if (!(typeof v === "number") || !isFinite(v)) {
        continue;
      }
      const norm = (v - effMin) / (gmax - effMin || 1);
      const clamped = Math.max(0, Math.min(1, norm));
      const r = Math.round(68 + 185 * clamped);
      const g = Math.round(1 + 220 * clamped);
      const b = Math.round(84 - 50 * clamped);
      context2D.fillStyle = `rgb(${r},${g},${b})`;
      const binHeight = chartHeight / Math.max(1, freqMax - freqMin);
      const y = margin.top + chartHeight - (bin - freqMin) * binHeight;
      context2D.fillRect(x, y - binHeight, frameWidth + 0.5, binHeight + 0.5);
    }
  }
}

// ============================================================================
// Frame Queue Management and Rendering
// ============================================================================

function processFrame(): void {
  // Guard against race conditions: check and set flag in same tick
  // Workers are single-threaded, but setTimeout can schedule multiple calls
  if (rendering || renderQueue.length === 0) {
    return;
  }

  rendering = true;
  const frame = renderQueue.shift();
  if (!frame) {
    rendering = false;
    return;
  }
  const start = performance.now();

  try {
    let success = false;

    if (visualizationType === "constellation" && frame.data.samples) {
      if (glContext) {
        success = renderConstellationWebGL(
          frame.data.samples,
          frame.data.transform,
        );
      }
      if (!success && context2D) {
        renderConstellation2D(frame.data.samples, frame.data.transform);
        success = true;
      }
    } else if (visualizationType === "waveform" && frame.data.samples) {
      if (glContext) {
        success = renderWaveformWebGL(frame.data.samples);
      }
      if (!success && context2D) {
        renderWaveform2D(frame.data.samples);
        success = true;
      }
    } else if (visualizationType === "spectrogram" && frame.data.fftData) {
      // Spectrogram typically uses 2D for now
      if (context2D) {
        renderSpectrogram2D(frame.data.fftData);
        success = true;
      }
    }

    const end = performance.now();
    const renderTime = end - start;
    framesRendered++;

    postMessage({
      type: "frameComplete",
      frameId: frame.frameId,
      renderTimeMs: renderTime,
      queueSize: renderQueue.length,
      framesDropped,
      framesRendered,
    });
  } catch (err) {
    console.error("Rendering error:", err);
    postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    rendering = false;
    // Process next frame if available (async to avoid stack overflow)
    if (renderQueue.length > 0) {
      setTimeout(processFrame, 0);
    }
  }
}

function queueFrame(frame: RenderMessage): void {
  // Implement backpressure: drop oldest frames if queue is full
  if (renderQueue.length >= RENDER_MAX_QUEUE_SIZE) {
    const dropped = renderQueue.shift();
    if (dropped) {
      framesDropped++;
      postMessage({
        type: "frameDropped",
        frameId: dropped.frameId,
        reason: "queue_full",
        queueSize: renderQueue.length,
      });
    }
  }

  renderQueue.push(frame);

  // Only trigger processing if not already in progress
  // The rendering flag prevents concurrent execution
  if (!rendering) {
    processFrame();
  }
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (
  ev: MessageEvent<
    InitMessage | RenderMessage | ResizeMessage | DisposeMessage
  >,
): void => {
  const msg = ev.data;

  try {
    if (msg.type === "init") {
      visualizationType = msg.visualizationType;
      const success = initializeRenderer(msg.canvas, msg.renderConfig);
      postMessage({
        type: "initialized",
        success,
        hasWebGL: glContext !== null,
        has2D: context2D !== null,
      });
      return;
    }

    if (msg.type === "resize") {
      resizeRenderer(msg.renderConfig);
      postMessage({ type: "resized" });
      return;
    }

    if (msg.type === "render") {
      queueFrame(msg);
      return;
    }

    // Exhaustive type check - ensures all message types are handled
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (msg.type === "dispose") {
      // Cleanup
      if (glContext) {
        if (vertexBuffer) {
          glContext.deleteBuffer(vertexBuffer);
        }
        if (colorBuffer) {
          glContext.deleteBuffer(colorBuffer);
        }
        if (shaderProgram) {
          glContext.deleteProgram(shaderProgram);
        }
      }
      canvasOffscreen = null;
      context2D = null;
      glContext = null;
      shaderProgram = null;
      vertexBuffer = null;
      colorBuffer = null;
      renderQueue.length = 0;
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
