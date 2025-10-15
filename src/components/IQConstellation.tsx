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

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Set up high DPI canvas for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear with dark background for better contrast
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 50, bottom: 60, left: 70, right: 50 };
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

    // Draw subtle grid with enhanced styling
    ctx.strokeStyle = "rgba(100, 120, 150, 0.15)";
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

    // Draw main axes with enhanced styling
    ctx.strokeStyle = "#4a90e2";
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

    // Draw axis labels with better typography
    ctx.fillStyle = "#e0e6ed";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
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

    // Draw tick labels with enhanced visibility
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";

    // I-axis ticks
    for (let i = iMin; i <= iMax; i += 0.04) {
      const x = scaleI(i);
      if (Math.abs(i) < 0.01) continue;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(i.toFixed(2), x, centerY + 6);
      
      // Draw tick mark
      ctx.strokeStyle = "#4a90e2";
      ctx.beginPath();
      ctx.moveTo(x, centerY - 4);
      ctx.lineTo(x, centerY + 4);
      ctx.stroke();
    }

    // Q-axis ticks
    for (let q = qMin; q <= qMax; q += 0.04) {
      const y = scaleQ(q);
      if (Math.abs(q) < 0.01) continue;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(q.toFixed(2), centerX - 8, y);
      
      // Draw tick mark
      ctx.strokeStyle = "#4a90e2";
      ctx.beginPath();
      ctx.moveTo(centerX - 4, y);
      ctx.lineTo(centerX + 4, y);
      ctx.stroke();
    }

    // Calculate density for heat map effect
    const densityMap = new Map<string, number>();
    const gridSize = 0.005;
    
    samples.forEach((sample) => {
      const gridI = Math.floor(sample.I / gridSize) * gridSize;
      const gridQ = Math.floor(sample.Q / gridSize) * gridSize;
      const key = `${gridI},${gridQ}`;
      densityMap.set(key, (densityMap.get(key) || 0) + 1);
    });
    
    const maxDensity = Math.max(...Array.from(densityMap.values()));

    // Draw samples with enhanced glow effect and density-based coloring
    samples.forEach((sample) => {
      const x = scaleI(sample.I);
      const y = scaleQ(sample.Q);
      
      const gridI = Math.floor(sample.I / gridSize) * gridSize;
      const gridQ = Math.floor(sample.Q / gridSize) * gridSize;
      const key = `${gridI},${gridQ}`;
      const density = (densityMap.get(key) || 1) / maxDensity;

      // Create radial gradient for glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
      
      // Color based on density - from blue (low) to cyan to white (high)
      if (density > 0.7) {
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        gradient.addColorStop(0.5, "rgba(100, 200, 255, 0.6)");
        gradient.addColorStop(1, "rgba(70, 150, 255, 0)");
      } else if (density > 0.4) {
        gradient.addColorStop(0, "rgba(100, 220, 255, 0.8)");
        gradient.addColorStop(0.5, "rgba(70, 180, 255, 0.5)");
        gradient.addColorStop(1, "rgba(50, 140, 255, 0)");
      } else {
        gradient.addColorStop(0, "rgba(70, 150, 255, 0.6)");
        gradient.addColorStop(0.5, "rgba(50, 120, 220, 0.4)");
        gradient.addColorStop(1, "rgba(40, 100, 200, 0)");
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add a bright core for high-density areas
      if (density > 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${density * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Add title
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.fillText("IQ Constellation Diagram", width / 2, 25);
    
    // Add sample count
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "right";
    ctx.fillText(`${samples.length} samples`, width - 20, 25);
  }, [samples, width, height]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
