import { useEffect, useMemo, useRef } from 'react';
import { deriveIqSummary } from './iqViewUtils';

interface ConstellationCanvasProps {
  samples: Float32Array;
}

export function ConstellationCanvas({ samples }: ConstellationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const summary = useMemo(() => deriveIqSummary(samples, 1400), [samples]);

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
    const leftPad = Math.floor(width * 0.12);
    const rightPad = Math.floor(width * 0.06);
    const topPad = Math.floor(height * 0.12);
    const bottomPad = Math.floor(height * 0.18);
    const plotWidth = Math.max(1, width - leftPad - rightPad);
    const plotHeight = Math.max(1, height - topPad - bottomPad);

    ctx.fillStyle = '#090f13';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#141f30';
    ctx.fillRect(leftPad, topPad, plotWidth, plotHeight);

    const centerX = leftPad + Math.floor(plotWidth / 2);
    const centerY = topPad + Math.floor(plotHeight / 2);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 1;

    for (let i = -2; i <= 2; i += 1) {
      const x = centerX + Math.floor((i / 2) * (plotWidth / 2));
      ctx.beginPath();
      ctx.moveTo(x + 0.5, topPad);
      ctx.lineTo(x + 0.5, topPad + plotHeight);
      ctx.stroke();
    }

    for (let i = -2; i <= 2; i += 1) {
      const y = centerY - Math.floor((i / 2) * (plotHeight / 2));
      ctx.beginPath();
      ctx.moveTo(leftPad, y + 0.5);
      ctx.lineTo(leftPad + plotWidth, y + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.beginPath();
    ctx.moveTo(centerX + 0.5, topPad);
    ctx.lineTo(centerX + 0.5, topPad + plotHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leftPad, centerY + 0.5);
    ctx.lineTo(leftPad + plotWidth, centerY + 0.5);
    ctx.stroke();

    const xFor = (sample: number) => centerX + sample * (plotWidth / 2.2);
    const yFor = (sample: number) => centerY - sample * (plotHeight / 2.2);

    for (const point of summary.points) {
      const x = xFor(point.i);
      const y = yFor(point.q);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    ctx.fillStyle = 'rgba(231, 245, 255, 0.95)';
    ctx.font = `${Math.max(11, Math.floor(height * 0.05))}px ui-monospace, Consolas, monospace`;
    ctx.fillText(
      `Constellation | Points ${summary.points.length} | Corr ${summary.correlation.toFixed(2)} | Clip ${summary.clipRatePercent.toFixed(1)}%`,
      leftPad,
      Math.floor(topPad * 0.7)
    );

    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.fillText('I', leftPad + plotWidth - 14, centerY - 6);
    ctx.fillText('Q', centerX + 8, topPad + 16);
  }, [summary]);

  return <canvas ref={canvasRef} width={1200} height={320} className="viz-canvas" aria-label="Constellation view" />;
}
