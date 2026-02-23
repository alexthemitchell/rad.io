import { useCallback, useEffect, useRef } from 'react';

interface WaterfallCanvasProps {
  data: Float32Array;
  minDb?: number;
  maxDb?: number;
  zoom?: number;
  centerFrequencyHz?: number;
  sampleRateHz?: number;
  autoScale?: boolean;
  palette?: 'cividis' | 'inferno';
}

const formatFrequency = (hz: number) => {
  const abs = Math.abs(hz);
  if (abs >= 1_000_000) {
    return `${(hz / 1_000_000).toFixed(3)} MHz`;
  }
  if (abs >= 1_000) {
    return `${(hz / 1_000).toFixed(1)} kHz`;
  }
  return `${hz.toFixed(0)} Hz`;
};

// Colorblind-safe, monotonic-lightness palette inspired by cividis.
const CIVIDIS_STOPS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [0, 34, 78] },
  { t: 0.2, rgb: [34, 63, 110] },
  { t: 0.4, rgb: [58, 93, 118] },
  { t: 0.6, rgb: [93, 124, 121] },
  { t: 0.8, rgb: [151, 159, 116] },
  { t: 1.0, rgb: [231, 200, 89] }
];

const INFERNO_STOPS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [10, 7, 35] },
  { t: 0.2, rgb: [73, 16, 107] },
  { t: 0.4, rgb: [149, 38, 103] },
  { t: 0.6, rgb: [219, 82, 59] },
  { t: 0.8, rgb: [245, 156, 65] },
  { t: 1.0, rgb: [252, 255, 164] }
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function WaterfallCanvas({
  data,
  minDb = -125,
  maxDb = -35,
  zoom = 1,
  centerFrequencyHz = 0,
  sampleRateHz = 2_000_000,
  autoScale = true,
  palette = 'cividis'
}: WaterfallCanvasProps) {
  const dataCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef<number>(1);
  const displayMinDbRef = useRef(minDb);
  const displayMaxDbRef = useRef(maxDb);

  const colormap = useRef<Uint32Array | null>(null);

  const drawOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const width = overlayCanvas.width;
    const height = overlayCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const leftPad = Math.floor(width * 0.08);
    const rightPad = Math.floor(width * 0.015);
    const topPad = Math.floor(height * 0.035);
    const bottomPad = Math.floor(height * 0.14);
    const plotWidth = Math.max(1, width - leftPad - rightPad);
    const plotHeight = Math.max(1, height - topPad - bottomPad);

    ctx.fillStyle = 'rgba(9, 17, 23, 0.28)';
    ctx.fillRect(leftPad, topPad, plotWidth, plotHeight);

    const xDivisions = 10;
    const yDivisions = 7;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.17)';

    for (let i = 0; i < yDivisions; i += 1) {
      const y = topPad + Math.floor((i / (yDivisions - 1)) * plotHeight);
      ctx.beginPath();
      ctx.moveTo(leftPad, y + 0.5);
      ctx.lineTo(leftPad + plotWidth, y + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i < xDivisions; i += 1) {
      const x = leftPad + Math.floor((i / (xDivisions - 1)) * plotWidth);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, topPad);
      ctx.lineTo(x + 0.5, topPad + plotHeight);
      ctx.stroke();
    }

    const centerX = leftPad + Math.floor(plotWidth / 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.beginPath();
    ctx.moveTo(centerX + 0.5, topPad);
    ctx.lineTo(centerX + 0.5, topPad + plotHeight);
    ctx.stroke();

    const displayMin = displayMinDbRef.current;
    const displayMax = displayMaxDbRef.current;
    const spanHz = sampleRateHz / Math.max(zoom, 1);

    ctx.font = `${Math.max(11, Math.floor(height * 0.038))}px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = 'rgba(203, 223, 236, 0.82)';

    for (let i = 0; i < yDivisions; i += 2) {
      const ratio = i / (yDivisions - 1);
      const db = displayMax - ratio * (displayMax - displayMin);
      const y = topPad + Math.floor(ratio * plotHeight);
      ctx.fillText(`${db.toFixed(0)} dB`, 6, y + 4);
    }

    for (let i = 0; i < xDivisions; i += 2) {
      const ratio = i / (xDivisions - 1);
      const hz = centerFrequencyHz + (ratio - 0.5) * spanHz;
      const x = leftPad + Math.floor(ratio * plotWidth);
      const label = formatFrequency(hz);
      const textWidth = ctx.measureText(label).width;
      ctx.fillText(label, x - Math.floor(textWidth / 2), topPad + plotHeight + Math.floor(bottomPad * 0.65));
    }

    ctx.fillStyle = 'rgba(236, 245, 252, 0.95)';
    ctx.fillText(
      `RF Waterfall (newest at top) | Range ${displayMin.toFixed(0)}..${displayMax.toFixed(0)} dB`,
      leftPad,
      Math.floor(topPad * 0.7)
    );
  }, [centerFrequencyHz, sampleRateHz, zoom]);

  useEffect(() => {
    colormap.current = new Uint32Array(256);
    const stops = palette === 'inferno' ? INFERNO_STOPS : CIVIDIS_STOPS;

    for (let i = 0; i < 256; i += 1) {
      const t = i / 255;
      let leftStop = stops[0];
      let rightStop = stops[stops.length - 1];

      for (let j = 0; j < stops.length - 1; j += 1) {
        if (t >= stops[j].t && t <= stops[j + 1].t) {
          leftStop = stops[j];
          rightStop = stops[j + 1];
          break;
        }
      }

      const localT = (t - leftStop.t) / Math.max(0.0001, rightStop.t - leftStop.t);
      const r = Math.floor(leftStop.rgb[0] + (rightStop.rgb[0] - leftStop.rgb[0]) * localT);
      const g = Math.floor(leftStop.rgb[1] + (rightStop.rgb[1] - leftStop.rgb[1]) * localT);
      const b = Math.floor(leftStop.rgb[2] + (rightStop.rgb[2] - leftStop.rgb[2]) * localT);

      colormap.current[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
  }, [palette]);

  useEffect(() => {
    displayMinDbRef.current = minDb;
    displayMaxDbRef.current = maxDb;
  }, [minDb, maxDb]);

  useEffect(() => {
    const dataCanvas = dataCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!dataCanvas || !overlayCanvas) return;

    const updateSize = () => {
      const rect = dataCanvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;

      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (dataCanvas.width !== width || dataCanvas.height !== height) {
        dataCanvas.width = width;
        dataCanvas.height = height;
      }
      if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
      }

      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement('canvas');
      }
      tempCanvasRef.current.width = width;
      tempCanvasRef.current.height = height;
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(dataCanvas);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    drawOverlay();
  }, [centerFrequencyHz, sampleRateHz, zoom, minDb, maxDb, drawOverlay]);

  useEffect(() => {
    const canvas = dataCanvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const temp = tempCanvasRef.current;
    if (!temp) return;

    const width = canvas.width;
    const height = canvas.height;
    const dpr = dprRef.current;

    const leftPad = Math.floor(width * 0.08);
    const rightPad = Math.floor(width * 0.015);
    const topPad = Math.floor(height * 0.035);
    const bottomPad = Math.floor(height * 0.14);
    const plotWidth = Math.max(1, width - leftPad - rightPad);
    const plotHeight = Math.max(1, height - topPad - bottomPad);

    const shiftRows = Math.max(1, Math.round(dpr));

    const tempCtx = temp.getContext('2d', { alpha: false });
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0);
      ctx.drawImage(
        temp,
        leftPad,
        topPad,
        plotWidth,
        plotHeight - shiftRows,
        leftPad,
        topPad + shiftRows,
        plotWidth,
        plotHeight - shiftRows
      );
    }

    const viewLen = Math.max(16, Math.floor(data.length / Math.max(zoom, 1)));
    const startIdx = Math.floor((data.length - viewLen) / 2);

    const histogram = new Uint16Array(256);
    const sampleCount = Math.min(viewLen, 1024);
    const sampleStep = Math.max(1, Math.floor(viewLen / sampleCount));
    for (let i = 0; i < viewLen; i += sampleStep) {
      const value = data[startIdx + i];
      const normalized = clamp01((value + 150) / 160);
      const bucket = Math.floor(normalized * 255);
      histogram[bucket] += 1;
    }

    const total = histogram.reduce((sum, v) => sum + v, 0);
    let running = 0;
    let p15Bucket = 0;
    let p99Bucket = 255;
    for (let i = 0; i < histogram.length; i += 1) {
      running += histogram[i];
      if (running >= total * 0.15) {
        p15Bucket = i;
        break;
      }
    }

    running = 0;
    for (let i = 0; i < histogram.length; i += 1) {
      running += histogram[i];
      if (running >= total * 0.99) {
        p99Bucket = i;
        break;
      }
    }

    if (autoScale) {
      const histogramDb = (bucket: number) => -150 + (bucket / 255) * 160;
      const targetMin = Math.max(-140, Math.min(-20, histogramDb(p15Bucket) - 8));
      const targetMax = Math.max(-120, Math.min(10, histogramDb(p99Bucket) + 3));

      displayMinDbRef.current += (targetMin - displayMinDbRef.current) * 0.06;
      displayMaxDbRef.current += (targetMax - displayMaxDbRef.current) * 0.06;
      if (displayMaxDbRef.current - displayMinDbRef.current < 25) {
        displayMaxDbRef.current = displayMinDbRef.current + 25;
      }
    } else {
      displayMinDbRef.current = minDb;
      displayMaxDbRef.current = maxDb;
    }

    const displayMin = displayMinDbRef.current;
    const displayMax = displayMaxDbRef.current;

    const imageData = ctx.createImageData(plotWidth, shiftRows);
    const pixels = new Uint32Array(imageData.data.buffer);
    const lut = colormap.current!;
    const rowStride = plotWidth;

    for (let x = 0; x < plotWidth; x += 1) {
      const rel = x / Math.max(1, plotWidth - 1);
      const fftIdx = startIdx + Math.floor(rel * (viewLen - 1));
      const db = data[fftIdx];
      const normalized = clamp01((db - displayMin) / Math.max(1e-6, displayMax - displayMin));
      const lutIndex = Math.floor(normalized * 255);
      const color = lut[lutIndex];

      for (let y = 0; y < shiftRows; y += 1) {
        pixels[y * rowStride + x] = color;
      }
    }

    ctx.putImageData(imageData, leftPad, topPad);
    drawOverlay();
  }, [autoScale, data, drawOverlay, maxDb, minDb, zoom]);

  return (
    <div className="waterfall-stack">
      <canvas
        ref={dataCanvasRef}
        width={1300}
        height={420}
        className="viz-canvas"
      />
      <canvas
        ref={overlayCanvasRef}
        width={1300}
        height={420}
        className="viz-canvas waterfall-overlay"
        aria-hidden="true"
      />
    </div>
  );
}
