// Worker handling for visualization rendering using OffscreenCanvas
// Enhanced with backpressure handling and frame drop policy

// Frame queue management for backpressure
const MAX_QUEUE_SIZE = 3;
type QueuedFrame = {
  type: "render";
  data: MessageRender["data"];
  timestamp: number;
};
const frameQueue: QueuedFrame[] = [];
let isRendering = false;
let droppedFrames = 0;
let renderedFrames = 0;

type MessageInit = {
  type: "init";
  canvas: OffscreenCanvas;
  vizType: "spectrogram" | "constellation" | "waveform";
  width: number;
  height: number;
  dpr?: number;
  freqMin?: number;
  freqMax?: number;
};

type Sample = {
  I: number;
  Q: number;
};

type WaveformSample =
  | {
      value: number;
    }
  | Sample;

type ViewTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type MessageRender = {
  type: "render";
  data: {
    samples?: Sample[];
    fftData?: Float32Array[];
    freqMin?: number;
    freqMax?: number;
    transform?: ViewTransform;
  };
};

type MessageResize = {
  type: "resize";
  width: number;
  height: number;
  dpr?: number;
};

import { DEFAULT_MARGIN, WATERFALL_MARGIN } from "../visualization/grid";

let offscreen: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let vizType: MessageInit["vizType"] | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let freqMin = 0;
let freqMax = 0;

function setup(
  canvas: OffscreenCanvas,
  w: number,
  h: number,
  devicePixelRatio: number,
): void {
  offscreen = canvas;
  width = w;
  height = h;
  dpr = devicePixelRatio;
  const context: OffscreenCanvasRenderingContext2D | null =
    offscreen.getContext("2d", {
      alpha: false,
    });
  if (!context) {
    postMessage({
      type: "error",
      message: "Could not get 2D context in worker",
    });
    return;
  }
  ctx = context;
  // Canvas dimensions are already set on main thread before transfer
  // Just need to apply scaling for logical coordinates
  const ctxReset = ctx as { reset?: () => void };
  if (typeof ctxReset.reset === "function") {
    ctxReset.reset();
  }
  ctx.scale(dpr, dpr);
}

function clearBackground(): void {
  if (!ctx) {
    return;
  }
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, width, height);
}

function drawConstellation(samples: Sample[], transform?: ViewTransform): void {
  if (!ctx) {
    return;
  }
  const c = ctx;
  const start = performance.now();
  clearBackground();

  // Apply user interaction transform (pan and zoom)
  if (transform) {
    c.save();
    c.translate(transform.offsetX, transform.offsetY);
    c.scale(transform.scale, transform.scale);
  }
  const margin = DEFAULT_MARGIN;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const iValues = samples.map((s): number => s.I);
  const qValues = samples.map((s): number => s.Q);
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

  // draw axes
  ctx.strokeStyle = "#5aa3e8";
  ctx.lineWidth = 2.5;
  const centerX = scaleI(0);
  ctx.beginPath();
  ctx.moveTo(centerX, margin.top);
  ctx.lineTo(centerX, margin.top + chartHeight);
  ctx.stroke();
  const centerY = scaleQ(0);
  ctx.beginPath();
  ctx.moveTo(margin.left, centerY);
  ctx.lineTo(margin.left + chartWidth, centerY);
  ctx.stroke();

  // simple density draw: draw points sorted by density (approximate)
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
    c.fillStyle = `rgba(80,200,255,${alpha})`;
    c.beginPath();
    c.arc(x, y, density > 0.5 ? 2.5 : 2, 0, Math.PI * 2);
    c.fill();
  });

  // Restore context state after transform
  if (transform) {
    c.restore();
  }

  const end = performance.now();
  postMessage({
    type: "metrics",
    viz: "constellation",
    renderTimeMs: end - start,
  });
}

function drawSpectrogram(
  fftData: Float32Array[],
  freqMinLocal: number,
  freqMaxLocal: number,
): void {
  if (!ctx) {
    return;
  }
  const c = ctx;
  const start = performance.now();
  clearBackground();
  const margin = WATERFALL_MARGIN;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const numFrames = fftData.length;
  const frameWidth = Math.max(1, chartWidth / Math.max(1, numFrames));

  // compute global min/max
  let gmin = Infinity;
  let gmax = -Infinity;
  for (const row of fftData) {
    for (let b = freqMinLocal; b < freqMaxLocal && b < row.length; b++) {
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
    for (
      let bin = freqMinLocal;
      bin < freqMaxLocal && bin < row.length;
      bin++
    ) {
      const v = row[bin];
      if (!(typeof v === "number") || !isFinite(v)) {
        continue;
      }
      const norm = (v - effMin) / (gmax - effMin || 1);
      const clamped = Math.max(0, Math.min(1, norm));
      // simple viridis-like interpolation
      const r = Math.round(68 + 185 * clamped);
      const g = Math.round(1 + 220 * clamped);
      const b = Math.round(84 - 50 * clamped);
      c.fillStyle = `rgb(${r},${g},${b})`;
      const binHeight = chartHeight / Math.max(1, freqMaxLocal - freqMinLocal);
      const y = margin.top + chartHeight - (bin - freqMinLocal) * binHeight;
      c.fillRect(x, y - binHeight, frameWidth + 0.5, binHeight + 0.5);
    }
  }

  const end = performance.now();
  postMessage({
    type: "metrics",
    viz: "spectrogram",
    renderTimeMs: end - start,
  });
}

function drawWaveform(samples: WaveformSample[]): void {
  if (!ctx) {
    return;
  }
  const c = ctx;
  const start = performance.now();
  clearBackground();
  const margin = DEFAULT_MARGIN;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // If samples are objects with I/Q, calculate amplitude
  const amps =
    samples.length && typeof samples[0] === "object" && "I" in samples[0]
      ? samples.map((s: WaveformSample): number => {
          if ("I" in s && "Q" in s) {
            return Math.sqrt((s.I || 0) ** 2 + (s.Q || 0) ** 2);
          }
          return 0;
        })
      : samples.map((s: WaveformSample): number =>
          typeof s === "number" ? s : "value" in s ? s.value : 0,
        );

  const maxAmp = Math.max(...amps, 1);
  const minAmp = Math.min(...amps, 0);
  const padding = (maxAmp - minAmp) * 0.1;
  const displayMin = minAmp - padding;
  const displayMax = maxAmp + padding;
  const displayRange = displayMax - displayMin || 1;

  // downsample
  const maxPoints = Math.max(100, Math.round(chartWidth * 2));
  const step = Math.max(1, Math.floor(amps.length / maxPoints));

  c.beginPath();
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
      c.moveTo(x, y);
    } else {
      c.lineTo(x, y);
    }
  }
  c.lineWidth = 2;
  c.strokeStyle = "rgba(100,220,255,0.9)";
  c.stroke();

  const end = performance.now();
  postMessage({ type: "metrics", viz: "waveform", renderTimeMs: end - start });
}

function processNextFrame(): void {
  // Guard against race conditions: check and set flag in same tick
  // Workers are single-threaded, but setTimeout can schedule multiple calls
  if (isRendering || frameQueue.length === 0) {
    return;
  }

  isRendering = true;
  const frame = frameQueue.shift();
  if (!frame) {
    isRendering = false;
    return;
  }
  const start = performance.now();

  try {
    const msg = frame.data;
    if (!ctx) {
      return;
    }

    if (vizType === "constellation") {
      drawConstellation(msg.samples ?? [], msg.transform);
    } else if (vizType === "spectrogram") {
      drawSpectrogram(
        msg.fftData ?? [],
        msg.freqMin ?? freqMin,
        msg.freqMax ?? freqMax,
      );
    } else if (vizType === "waveform") {
      drawWaveform(msg.samples ?? []);
    }

    const end = performance.now();
    renderedFrames++;

    // Report metrics
    postMessage({
      type: "metrics",
      viz: vizType,
      renderTimeMs: end - start,
      queueSize: frameQueue.length,
      droppedFrames,
      renderedFrames,
    });
  } catch (err) {
    console.error("Rendering error:", err);
  } finally {
    isRendering = false;
    // Process next frame if available (async to avoid stack overflow)
    if (frameQueue.length > 0) {
      setTimeout(processNextFrame, 0);
    }
  }
}

function enqueueFrame(data: MessageRender["data"]): void {
  // Implement backpressure: drop oldest frames if queue is full
  if (frameQueue.length >= MAX_QUEUE_SIZE) {
    const dropped = frameQueue.shift();
    if (dropped) {
      droppedFrames++;
      postMessage({
        type: "frameDropped",
        reason: "queue_full",
        queueSize: frameQueue.length,
        droppedFrames,
      });
    }
  }

  frameQueue.push({
    type: "render",
    data,
    timestamp: performance.now(),
  });

  // Only trigger processing if not already in progress
  // The isRendering flag prevents concurrent execution
  if (!isRendering) {
    processNextFrame();
  }
}

self.onmessage = (
  ev: MessageEvent<
    MessageInit | MessageRender | MessageResize | { type: "dispose" }
  >,
): void => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      vizType = msg.vizType;
      freqMin = msg.freqMin ?? 0;
      freqMax = msg.freqMax ?? 0;
      setup(msg.canvas, msg.width, msg.height, msg.dpr ?? 1);
      return;
    }

    if (msg.type === "resize") {
      width = msg.width;
      height = msg.height;
      if (msg.dpr !== undefined) {
        dpr = msg.dpr;
      }
      if (offscreen && ctx) {
        offscreen.width = Math.round(width * dpr);
        offscreen.height = Math.round(height * dpr);
        const ctxReset = ctx as { reset?: () => void };
        if (typeof ctxReset.reset === "function") {
          ctxReset.reset();
        }
        ctx.scale(dpr, dpr);
      }
      return;
    }

    if (msg.type === "render") {
      // Use frame queue for backpressure handling
      enqueueFrame(msg.data);
      return;
    }

    // msg.type === "dispose" at this point (exhaustive check)
    // Clear frame queue and let GC collect
    frameQueue.length = 0;
    offscreen = null;
    ctx = null;
    vizType = null;
    close();
  } catch (e) {
    postMessage({ type: "error", message: (e as Error).message });
  }
};
