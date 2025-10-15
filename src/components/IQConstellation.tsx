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
    if (!canvas || samples.length === 0) return;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    // Set up high DPI canvas for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Professional dark background for SDR displays
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 60, bottom: 70, left: 80, right: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate dynamic ranges from data
    const iValues = samples.map((s) => s.I);
    const qValues = samples.map((s) => s.Q);
    const iMin = Math.min(...iValues, -0.1);
    const iMax = Math.max(...iValues, 0.1);
    const qMin = Math.min(...qValues, -0.1);
    const qMax = Math.max(...qValues, 0.1);

    // Add padding to ranges
    const iPadding = (iMax - iMin) * 0.1;
    const qPadding = (qMax - qMin) * 0.1;

    // Scale functions
    const scaleI = (i: number) =>
      margin.left +
      ((i - (iMin - iPadding)) / (iMax - iMin + 2 * iPadding)) * chartWidth;
    const scaleQ = (q: number) =>
      margin.top +
      chartHeight -
      ((q - (qMin - qPadding)) / (qMax - qMin + 2 * qPadding)) * chartHeight;

    // Draw fine grid (industry standard for precision)
    ctx.strokeStyle = "rgba(70, 90, 120, 0.12)";
    ctx.lineWidth = 0.5;

    const gridStep = 0.01;
    for (
      let i = Math.floor(iMin / gridStep) * gridStep;
      i <= iMax;
      i += gridStep
    ) {
      const x = scaleI(i);
      if (x >= margin.left && x <= margin.left + chartWidth) {
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + chartHeight);
        ctx.stroke();
      }
    }

    for (
      let q = Math.floor(qMin / gridStep) * gridStep;
      q <= qMax;
      q += gridStep
    ) {
      const y = scaleQ(q);
      if (y >= margin.top && y <= margin.top + chartHeight) {
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + chartWidth, y);
        ctx.stroke();
      }
    }

    // Draw thicker grid lines at major intervals
    ctx.strokeStyle = "rgba(100, 130, 170, 0.25)";
    ctx.lineWidth = 1;

    const majorStep = 0.05;
    for (
      let i = Math.floor(iMin / majorStep) * majorStep;
      i <= iMax;
      i += majorStep
    ) {
      const x = scaleI(i);
      if (x >= margin.left && x <= margin.left + chartWidth) {
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + chartHeight);
        ctx.stroke();
      }
    }

    for (
      let q = Math.floor(qMin / majorStep) * majorStep;
      q <= qMax;
      q += majorStep
    ) {
      const y = scaleQ(q);
      if (y >= margin.top && y <= margin.top + chartHeight) {
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + chartWidth, y);
        ctx.stroke();
      }
    }

    // Draw axes with professional styling
    ctx.strokeStyle = "#5aa3e8";
    ctx.lineWidth = 2.5;

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

    // Calculate density for heat map effect (industry standard)
    const densityMap = new Map<string, number>();
    const gridSize = 0.003; // Finer grid for better density resolution
    
    samples.forEach((sample) => {
      const gridI = Math.round(sample.I / gridSize) * gridSize;
      const gridQ = Math.round(sample.Q / gridSize) * gridSize;
      const key = `${gridI.toFixed(4)},${gridQ.toFixed(4)}`;
      densityMap.set(key, (densityMap.get(key) || 0) + 1);
    });
    
    const maxDensity = Math.max(...Array.from(densityMap.values()), 1);

    // Sort samples by density (draw low density first, high density last)
    const samplesWithDensity = samples.map((sample) => {
      const gridI = Math.round(sample.I / gridSize) * gridSize;
      const gridQ = Math.round(sample.Q / gridSize) * gridSize;
      const key = `${gridI.toFixed(4)},${gridQ.toFixed(4)}`;
      const density = (densityMap.get(key) || 1) / maxDensity;
      return { sample, density };
    });

    samplesWithDensity.sort((a, b) => a.density - b.density);

    // Draw samples with professional heat map coloring
    samplesWithDensity.forEach(({ sample, density }) => {
      const x = scaleI(sample.I);
      const y = scaleQ(sample.Q);

      // Enhanced color scheme based on density
      // Low density: dark blue, Medium: cyan/blue, High: bright cyan/white
      const getColorForDensity = (d: number): [number, number, number, number] => {
        if (d > 0.8) {
          // Very high density - bright white/cyan core
          const t = (d - 0.8) / 0.2;
          return [
            100 + 155 * t,  // R: cyan to white
            200 + 55 * t,   // G: cyan to white
            255,            // B: full
            0.9
          ];
        } else if (d > 0.5) {
          // High density - bright cyan
          const t = (d - 0.5) / 0.3;
          return [
            50 + 50 * t,    // R
            180 + 20 * t,   // G
            255,            // B
            0.75 + 0.15 * t
          ];
        } else if (d > 0.2) {
          // Medium density - blue/cyan
          const t = (d - 0.2) / 0.3;
          return [
            40 + 10 * t,    // R
            130 + 50 * t,   // G
            220 + 35 * t,   // B
            0.6 + 0.15 * t
          ];
        } else {
          // Low density - dark blue
          const t = d / 0.2;
          return [
            30 + 10 * t,    // R
            80 + 50 * t,    // G
            180 + 40 * t,   // B
            0.4 + 0.2 * t
          ];
        }
      };

      const [r, g, b, alpha] = getColorForDensity(density);

      // Draw point with glow effect
      const pointSize = density > 0.5 ? 2.5 : 2;
      const glowSize = density > 0.7 ? 6 : density > 0.4 ? 5 : 4;

      // Outer glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, 2 * Math.PI);
      ctx.fill();
      
      // Core point
      ctx.fillStyle = `rgba(${r + 50}, ${g + 30}, ${b}, ${Math.min(alpha + 0.2, 1)})`;
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
      
      // Bright center for very high density
      if (density > 0.7) {
        ctx.fillStyle = `rgba(255, 255, 255, ${density * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Calculate and display signal statistics
    const magnitudes = samples.map(s => Math.sqrt(s.I * s.I + s.Q * s.Q));
    const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const maxMagnitude = Math.max(...magnitudes);

    // Add title and metadata
    ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.fillText("IQ Constellation Diagram", width / 2, 28);
    
    // Add statistics
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "right";
    ctx.fillText(
      `${samples.length} samples | Avg: ${avgMagnitude.toFixed(4)} | Max: ${maxMagnitude.toFixed(4)}`,
      width - 20,
      28
    );

    // Add density legend
    ctx.textAlign = "left";
    ctx.fillText("Density:", 20, height - 20);
    
    const legendX = 80;
    const legendY = height - 28;
    const legendWidth = 100;
    const legendHeight = 8;
    
    // Draw gradient legend
    const legendGradient = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
    legendGradient.addColorStop(0, "rgb(30, 80, 180)");
    legendGradient.addColorStop(0.5, "rgb(50, 180, 255)");
    legendGradient.addColorStop(1, "rgb(200, 240, 255)");
    
    ctx.fillStyle = legendGradient;
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
    
    ctx.strokeStyle = "rgba(100, 130, 170, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
    
    ctx.fillStyle = "#a0aab5";
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Low", legendX, legendY - 2);
    ctx.textAlign = "right";
    ctx.fillText("High", legendX + legendWidth, legendY - 2);
  }, [samples, width, height]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
