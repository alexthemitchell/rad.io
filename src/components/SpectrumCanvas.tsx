import { useEffect, useRef, useState } from 'react';
import {
  blendAveragedTrace,
  type AnalyzerAveragingMode,
  getVisibleSpectrumBinRange,
  updatePeakHoldTrace
} from '../dsp/analyzerControls';

interface SpectrumCanvasProps {
  data: Float32Array;
  zoom?: number;
  onPointClick?: (binIndex: number) => void;
  centerFrequencyHz?: number;
  sampleRateHz?: number;
  tunedOffsetHz?: number;
  referenceLevelDb?: number;
  averagingMode?: AnalyzerAveragingMode;
  averagingValue?: number;
  peakHoldEnabled?: boolean;
  peakHoldResetToken?: number;
  markerFrequencyHz?: number | null;
}

const GRID_X_DIVISIONS = 10;
const GRID_Y_DIVISIONS = 11;

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

export function SpectrumCanvas({
  data,
  zoom = 1,
  onPointClick,
  centerFrequencyHz = 0,
  sampleRateHz = 2_000_000,
  tunedOffsetHz = 0,
  referenceLevelDb = -20,
  averagingMode = 'exp',
  averagingValue = 0.18,
  peakHoldEnabled = true,
  peakHoldResetToken = 0,
  markerFrequencyHz = null
}: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedRef = useRef<Float32Array | null>(null);
  const peakHoldRef = useRef<Float32Array | null>(null);
  const peakHoldResetTokenRef = useRef(peakHoldResetToken);
  const lastPaintRef = useRef<number>(performance.now());
  const [hoverBin, setHoverBin] = useState<number | null>(null);

  const getBinFromCanvasX = (x: number, canvasWidth: number): number => {
    const viewLen = Math.max(16, Math.floor(data.length / Math.max(zoom, 1)));
    const startIdx = Math.floor((data.length - viewLen) / 2);
    const leftPad = Math.floor(canvasWidth * 0.08);
    const rightPad = Math.floor(canvasWidth * 0.015);
    const plotWidth = Math.max(1, canvasWidth - leftPad - rightPad);
    const clampedX = Math.max(leftPad, Math.min(leftPad + plotWidth, x));
    const normalized = (clampedX - leftPad) / plotWidth;
    const relIdx = Math.max(0, Math.min(viewLen - 1, Math.round(normalized * Math.max(1, viewLen - 1))));
    return startIdx + relIdx;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);
  
  useEffect(() => {
    if (peakHoldResetTokenRef.current !== peakHoldResetToken) {
      peakHoldResetTokenRef.current = peakHoldResetToken;
      peakHoldRef.current = null;
    }
  }, [peakHoldResetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (data.length === 0) return;

    const now = performance.now();
    const elapsedSec = Math.max((now - lastPaintRef.current) / 1000, 0.001);
    lastPaintRef.current = now;

    const visibleRange = getVisibleSpectrumBinRange(data.length, zoom);
    const viewLen = visibleRange.endBinExclusive - visibleRange.startBinInclusive;
    const incomingView = data.subarray(visibleRange.startBinInclusive, visibleRange.endBinExclusive);

    smoothedRef.current = blendAveragedTrace(
      smoothedRef.current,
      incomingView,
      averagingMode,
      averagingValue
    );

    const smoothed = smoothedRef.current;
    peakHoldRef.current = updatePeakHoldTrace(
      peakHoldRef.current,
      smoothed,
      elapsedSec,
      peakHoldEnabled
    );
    const peakHold = peakHoldRef.current;

    const width = canvas.width;
    const height = canvas.height;
    const leftPad = Math.floor(width * 0.08);
    const rightPad = Math.floor(width * 0.015);
    const topPad = Math.floor(height * 0.08);
    const bottomPad = Math.floor(height * 0.16);
    const plotWidth = Math.max(1, width - leftPad - rightPad);
    const plotHeight = Math.max(1, height - topPad - bottomPad);
    const maxDb = referenceLevelDb;
    const minDb = maxDb - 110;

    const xForIndex = (idx: number) => leftPad + Math.floor((idx / (viewLen - 1 || 1)) * plotWidth);
    const yForDb = (db: number) => {
      const clamped = Math.min(maxDb, Math.max(minDb, db));
      const norm = (clamped - minDb) / (maxDb - minDb);
      return topPad + Math.floor((1 - norm) * plotHeight);
    };

    ctx.fillStyle = '#090f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0d1a23';
    ctx.fillRect(leftPad, topPad, plotWidth, plotHeight);

    ctx.strokeStyle = 'rgba(140, 175, 195, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_Y_DIVISIONS; i += 1) {
      const y = topPad + Math.floor((i / (GRID_Y_DIVISIONS - 1)) * plotHeight);
      ctx.beginPath();
      ctx.moveTo(leftPad, y + 0.5);
      ctx.lineTo(leftPad + plotWidth, y + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i < GRID_X_DIVISIONS; i += 1) {
      const x = leftPad + Math.floor((i / (GRID_X_DIVISIONS - 1)) * plotWidth);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, topPad);
      ctx.lineTo(x + 0.5, topPad + plotHeight);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, topPad, 0, topPad + plotHeight);
    gradient.addColorStop(0, 'rgba(94, 234, 212, 0.35)');
    gradient.addColorStop(1, 'rgba(94, 234, 212, 0.02)');

    ctx.beginPath();
    ctx.moveTo(xForIndex(0), topPad + plotHeight);
    for (let i = 0; i < viewLen; i += 1) {
      ctx.lineTo(xForIndex(i), yForDb(smoothed[i]));
    }
    ctx.lineTo(xForIndex(viewLen - 1), topPad + plotHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < viewLen; i += 1) {
      const x = xForIndex(i);
      const y = yForDb(smoothed[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    if (peakHoldEnabled && peakHold) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      for (let i = 0; i < viewLen; i += 1) {
        const x = xForIndex(i);
        const y = yForDb(peakHold[i]);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const centerX = leftPad + Math.floor(plotWidth / 2);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
    ctx.lineWidth = 1;
    ctx.moveTo(centerX + 0.5, topPad);
    ctx.lineTo(centerX + 0.5, topPad + plotHeight);
    ctx.stroke();

    const tunedRatio = 0.5 + tunedOffsetHz / (sampleRateHz / Math.max(zoom, 1));
    if (tunedRatio >= 0 && tunedRatio <= 1) {
      const tunedX = leftPad + Math.floor(tunedRatio * plotWidth);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.92)';
      ctx.lineWidth = 1;
      ctx.moveTo(tunedX + 0.5, topPad);
      ctx.lineTo(tunedX + 0.5, topPad + plotHeight);
      ctx.stroke();
    }

    ctx.font = `${Math.max(11, Math.floor(height * 0.05))}px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = 'rgba(189, 211, 224, 0.85)';
    for (let i = 0; i < GRID_Y_DIVISIONS; i += 2) {
      const ratio = i / (GRID_Y_DIVISIONS - 1);
      const db = maxDb - ratio * (maxDb - minDb);
      const y = topPad + Math.floor(ratio * plotHeight);
      ctx.fillText(`${db.toFixed(0)} dB`, 6, y + 4);
    }

    const spanHz = sampleRateHz / Math.max(zoom, 1);
    if (markerFrequencyHz !== null) {
      const markerRatio = 0.5 + (markerFrequencyHz - centerFrequencyHz) / spanHz;
      if (markerRatio >= 0 && markerRatio <= 1) {
        const markerX = leftPad + Math.floor(markerRatio * plotWidth);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.95)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(markerX + 0.5, topPad);
        ctx.lineTo(markerX + 0.5, topPad + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    for (let i = 0; i < GRID_X_DIVISIONS; i += 2) {
      const ratio = i / (GRID_X_DIVISIONS - 1);
      const hz = centerFrequencyHz + (ratio - 0.5) * spanHz;
      const x = leftPad + Math.floor(ratio * plotWidth);
      const label = formatFrequency(hz);
      const textWidth = ctx.measureText(label).width;
      ctx.fillText(label, x - Math.floor(textWidth / 2), topPad + plotHeight + Math.floor(bottomPad * 0.65));
    }

    const peakDb = smoothed.reduce((max, value) => Math.max(max, value), -Infinity);
    ctx.fillStyle = 'rgba(232, 244, 250, 0.95)';
    ctx.fillText(
      `Peak: ${peakDb.toFixed(1)} dBFS | Ref: ${referenceLevelDb.toFixed(1)} dBFS | Span: ${(spanHz / 1_000_000).toFixed(3)} MHz`,
      leftPad,
      Math.floor(topPad * 0.65)
    );

    if (hoverBin !== null && hoverBin >= visibleRange.startBinInclusive && hoverBin < visibleRange.endBinExclusive) {
      const relIndex = hoverBin - visibleRange.startBinInclusive;
      const hoverX = xForIndex(relIndex);
      const hoverDb = smoothed[relIndex];
      const hoverY = yForDb(hoverDb);
      const hoverOffsetHz = (hoverBin - Math.floor(data.length / 2)) * (sampleRateHz / data.length);
      const hoverHz = centerFrequencyHz + hoverOffsetHz;

      ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX + 0.5, topPad);
      ctx.lineTo(hoverX + 0.5, topPad + plotHeight);
      ctx.stroke();

      ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
      ctx.beginPath();
      ctx.arc(hoverX, hoverY, 3, 0, Math.PI * 2);
      ctx.fill();

      const readout = `${formatFrequency(hoverHz)} | ${hoverDb.toFixed(1)} dBFS | dTune ${(hoverOffsetHz - tunedOffsetHz).toFixed(0)} Hz`;
      ctx.fillStyle = 'rgba(7, 12, 18, 0.9)';
      const readoutWidth = Math.ceil(ctx.measureText(readout).width) + 12;
      const readoutHeight = Math.floor(height * 0.07);
      ctx.fillRect(leftPad, topPad + 6, readoutWidth, readoutHeight);
      ctx.fillStyle = 'rgba(255, 234, 234, 0.95)';
      ctx.fillText(readout, leftPad + 6, topPad + Math.floor(readoutHeight * 0.72));
    }
  }, [
    averagingMode,
    averagingValue,
    centerFrequencyHz,
    data,
    hoverBin,
    markerFrequencyHz,
    peakHoldEnabled,
    referenceLevelDb,
    sampleRateHz,
    tunedOffsetHz,
    zoom
  ]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onPointClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const absIdx = getBinFromCanvasX(x, rect.width);

      onPointClick(absIdx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverBin(getBinFromCanvasX(x, rect.width));
  };

  return (
    <canvas 
      ref={canvasRef} 
      width={1200}
      height={320}
      className="viz-canvas viz-canvas-interactive"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverBin(null)}
    />
  );
}
