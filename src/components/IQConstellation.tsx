import { useEffect, useRef } from "react";

type Sample = {
  I: number;
  Q: number;
};

type IQConstellationProps = {
  samples: Sample[];
  width?: number;
  height?: number;
};

export default function IQConstellation({
  samples,
  width = 750,
  height = 400,
}: IQConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 60, bottom: 60, left: 80, right: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Domain ranges
    const iMin = -0.1;
    const iMax = 0.1;
    const qMin = -0.1;
    const qMax = 0.1;

    // Scale functions
    const scaleI = (i: number) =>
      margin.left + ((i - iMin) / (iMax - iMin)) * chartWidth;
    const scaleQ = (q: number) =>
      margin.top + chartHeight - ((q - qMin) / (qMax - qMin)) * chartHeight;

    // Draw grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let i = iMin; i <= iMax; i += 0.02) {
      const x = scaleI(i);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let q = qMin; q <= qMax; q += 0.02) {
      const y = scaleQ(q);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;

    // Y-axis (Q)
    const centerX = scaleI(0);
    ctx.beginPath();
    ctx.moveTo(centerX, margin.top);
    ctx.lineTo(centerX, margin.top + chartHeight);
    ctx.stroke();

    // X-axis (I)
    const centerY = scaleQ(0);
    ctx.beginPath();
    ctx.moveTo(margin.left, centerY);
    ctx.lineTo(margin.left + chartWidth, centerY);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = "#374151";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // X-axis label
    ctx.fillText("I (In-phase)", width / 2, height - 20);

    // Y-axis label
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Q (Quadrature)", 0, 0);
    ctx.restore();

    // Draw tick labels
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#6b7280";

    // I-axis ticks
    for (let i = iMin; i <= iMax; i += 0.02) {
      const x = scaleI(i);
      if (Math.abs(i) < 0.01) continue; // Skip zero
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(i.toFixed(2), x, centerY + 5);
    }

    // Q-axis ticks
    for (let q = qMin; q <= qMax; q += 0.02) {
      const y = scaleQ(q);
      if (Math.abs(q) < 0.01) continue; // Skip zero
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(q.toFixed(2), centerX - 5, y);
    }

    // Draw samples as points with gradient
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 3);
    gradient.addColorStop(0, "rgba(102, 126, 234, 0.8)");
    gradient.addColorStop(1, "rgba(102, 126, 234, 0.2)");

    samples.forEach((sample) => {
      const x = scaleI(sample.I);
      const y = scaleQ(sample.Q);

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    });
  }, [samples, width, height]);

  return <canvas ref={canvasRef} />;
}
