import { useEffect, useRef } from 'react';

interface AudioScopeCanvasProps {
  samples: Float32Array;
  sampleRateHz?: number;
}

const GRID_X_DIVISIONS = 9;
const GRID_Y_DIVISIONS = 7;

export function AudioScopeCanvas({ samples, sampleRateHz = 50_000 }: AudioScopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const leftPad = Math.floor(width * 0.08);
    const rightPad = Math.floor(width * 0.015);
    const topPad = Math.floor(height * 0.08);
    const bottomPad = Math.floor(height * 0.18);
    const plotWidth = Math.max(1, width - leftPad - rightPad);
    const plotHeight = Math.max(1, height - topPad - bottomPad);

    ctx.fillStyle = '#090f13';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111e2a';
    ctx.fillRect(leftPad, topPad, plotWidth, plotHeight);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
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

    const centerY = topPad + Math.floor(plotHeight / 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.beginPath();
    ctx.moveTo(leftPad, centerY + 0.5);
    ctx.lineTo(leftPad + plotWidth, centerY + 0.5);
    ctx.stroke();

    if (samples.length > 0) {
      let start = 0;
      for (let i = 1; i < samples.length; i += 1) {
        if (samples[i - 1] <= 0 && samples[i] > 0) {
          start = i;
          break;
        }
      }

      const visible = Math.min(samples.length, Math.max(64, Math.floor(samples.length * 0.9)));
      const end = Math.min(samples.length, start + visible);
      const sampleCount = Math.max(1, end - start);

      const xFor = (idx: number) => leftPad + Math.floor((idx / Math.max(1, sampleCount - 1)) * plotWidth);
      const yFor = (sample: number) => {
        const clamped = Math.max(-1, Math.min(1, sample));
        return topPad + Math.floor((1 - (clamped + 1) * 0.5) * plotHeight);
      };

      const fillGradient = ctx.createLinearGradient(0, topPad, 0, topPad + plotHeight);
      fillGradient.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      fillGradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

      ctx.beginPath();
      ctx.moveTo(xFor(0), centerY);
      for (let i = 0; i < sampleCount; i += 1) {
        const x = xFor(i);
        const y = yFor(samples[start + i]);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(xFor(sampleCount - 1), centerY);
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < sampleCount; i += 1) {
        const x = xFor(i);
        const y = yFor(samples[start + i]);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      let peak = 0;
      let sumSq = 0;
      let clippingSamples = 0;
      for (let i = 0; i < sampleCount; i += 1) {
        const value = samples[start + i];
        peak = Math.max(peak, Math.abs(value));
        sumSq += value * value;
        if (Math.abs(value) >= 0.98) {
          clippingSamples += 1;
        }
      }
      const rms = Math.sqrt(sumSq / sampleCount);
      const crest = rms > 1e-6 ? peak / rms : 0;
      const windowMs = (sampleCount / sampleRateHz) * 1000;

      ctx.font = `${Math.max(11, Math.floor(height * 0.05))}px ui-monospace, Consolas, monospace`;
      ctx.fillStyle = 'rgba(231, 245, 255, 0.95)';
      ctx.fillText(
        `Window: ${windowMs.toFixed(1)} ms | Peak: ${peak.toFixed(3)} | RMS: ${rms.toFixed(3)} | Crest: ${crest.toFixed(2)}`,
        leftPad,
        Math.floor(topPad * 0.65)
      );

      if (clippingSamples > 0) {
        const clipRate = (clippingSamples / sampleCount) * 100;
        ctx.fillStyle = 'rgba(127, 29, 29, 0.9)';
        const warningText = `CLIPPING ${clipRate.toFixed(1)}%`;
        const warningWidth = Math.ceil(ctx.measureText(warningText).width) + 10;
        const warningX = leftPad + plotWidth - warningWidth;
        const warningY = topPad + 6;
        ctx.fillRect(warningX, warningY, warningWidth, Math.floor(height * 0.075));
        ctx.fillStyle = 'rgba(254, 226, 226, 0.98)';
        ctx.fillText(warningText, warningX + 5, warningY + Math.floor(height * 0.05));
      }

      ctx.fillStyle = 'rgba(189, 211, 224, 0.85)';
      for (let i = 0; i < GRID_X_DIVISIONS; i += 2) {
        const ratio = i / (GRID_X_DIVISIONS - 1);
        const timeMs = ratio * windowMs;
        const x = leftPad + Math.floor(ratio * plotWidth);
        const label = `${timeMs.toFixed(1)} ms`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillText(label, x - Math.floor(textWidth / 2), topPad + plotHeight + Math.floor(bottomPad * 0.6));
      }

      for (let i = 0; i < GRID_Y_DIVISIONS; i += 2) {
        const ratio = i / (GRID_Y_DIVISIONS - 1);
        const amp = 1 - ratio * 2;
        const y = topPad + Math.floor(ratio * plotHeight);
        ctx.fillText(amp.toFixed(1), 8, y + 4);
      }
    }
  }, [samples, sampleRateHz]);

  return <canvas ref={canvasRef} width={1200} height={320} className="viz-canvas" />;
}
