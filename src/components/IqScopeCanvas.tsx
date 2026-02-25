import { useEffect, useMemo, useRef } from 'react';
import { deriveIqSummary } from './iqViewUtils';

interface IqScopeCanvasProps {
  samples: Float32Array;
}

export function IqScopeCanvas({ samples }: IqScopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const summary = useMemo(() => deriveIqSummary(samples, 640), [samples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

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
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const leftPad = Math.floor(width * 0.08);
    const rightPad = Math.floor(width * 0.015);
    const topPad = Math.floor(height * 0.1);
    const bottomPad = Math.floor(height * 0.18);
    const plotWidth = Math.max(1, width - leftPad - rightPad);
    const plotHeight = Math.max(1, height - topPad - bottomPad);

    ctx.fillStyle = '#090f13';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#11202a';
    ctx.fillRect(leftPad, topPad, plotWidth, plotHeight);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 6; i += 1) {
      const y = topPad + Math.floor((i / 6) * plotHeight);
      ctx.beginPath();
      ctx.moveTo(leftPad, y + 0.5);
      ctx.lineTo(leftPad + plotWidth, y + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i <= 8; i += 1) {
      const x = leftPad + Math.floor((i / 8) * plotWidth);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, topPad);
      ctx.lineTo(x + 0.5, topPad + plotHeight);
      ctx.stroke();
    }

    const centerY = topPad + Math.floor(plotHeight / 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.beginPath();
    ctx.moveTo(leftPad, centerY + 0.5);
    ctx.lineTo(leftPad + plotWidth, centerY + 0.5);
    ctx.stroke();

    const xFor = (idx: number, count: number) => leftPad + Math.floor((idx / Math.max(1, count - 1)) * plotWidth);
    const yFor = (value: number) => {
      const clamped = Math.max(-1, Math.min(1, value));
      return topPad + Math.floor((1 - (clamped + 1) * 0.5) * plotHeight);
    };

    if (summary.points.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < summary.points.length; i += 1) {
        const y = yFor(summary.points[i].i);
        const x = xFor(i, summary.points.length);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < summary.points.length; i += 1) {
        const y = yFor(summary.points[i].q);
        const x = xFor(i, summary.points.length);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.font = `${Math.max(11, Math.floor(height * 0.05))}px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = 'rgba(231, 245, 255, 0.95)';
    ctx.fillText(
      `I/Q Scope | I DC ${summary.dcI.toFixed(3)} | Q DC ${summary.dcQ.toFixed(3)} | RMS ${summary.rms.toFixed(3)} | Clip ${summary.clipRatePercent.toFixed(1)}%`,
      leftPad,
      Math.floor(topPad * 0.7)
    );

    ctx.fillStyle = 'rgba(45, 212, 191, 0.95)';
    ctx.fillText('I', leftPad + 8, topPad + 16);
    ctx.fillStyle = 'rgba(96, 165, 250, 0.95)';
    ctx.fillText('Q', leftPad + 26, topPad + 16);
  }, [summary]);

  return <canvas ref={canvasRef} width={1200} height={320} className="viz-canvas" aria-label="I/Q scope view" />;
}
