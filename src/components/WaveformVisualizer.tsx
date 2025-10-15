import { useEffect, useRef } from "react";
import { calculateWaveform, Sample } from "../utils/dsp";

type WaveformVisualizerProps = {
  samples: Sample[];
  width?: number;
  height?: number;
};

export default function WaveformVisualizer({
  samples,
  width = 750,
  height = 300,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) return;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Professional dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 60, bottom: 60, left: 70, right: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate waveform data
    const { amplitude, phase } = calculateWaveform(samples);

    // Calculate statistics for adaptive scaling
    const maxAmplitude = Math.max(...Array.from(amplitude));
    const minAmplitude = Math.min(...Array.from(amplitude));
    const amplitudeRange = maxAmplitude - minAmplitude || 1;
    const avgAmplitude =
      Array.from(amplitude).reduce((a, b) => a + b, 0) / amplitude.length;

    // Add padding to range
    const padding = amplitudeRange * 0.1;
    const displayMin = minAmplitude - padding;
    const displayMax = maxAmplitude + padding;
    const displayRange = displayMax - displayMin;

    // Draw fine grid
    ctx.strokeStyle = "rgba(70, 90, 120, 0.1)";
    ctx.lineWidth = 0.5;

    const gridLines = 8;
    for (let i = 0; i <= gridLines; i++) {
      const y = margin.top + (chartHeight * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const timeLines = 10;
    for (let i = 0; i <= timeLines; i++) {
      const x = margin.left + (chartWidth * i) / timeLines;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Draw major grid lines
    ctx.strokeStyle = "rgba(100, 130, 170, 0.2)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (chartHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = "#5aa3e8";
    ctx.lineWidth = 2.5;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // X-axis
    const zeroY =
      margin.top + chartHeight - ((0 - displayMin) / displayRange) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(margin.left + chartWidth, zeroY);
    ctx.stroke();

    // Adaptive downsampling for performance
    const maxPoints = chartWidth * 2;
    const step = Math.max(1, Math.floor(samples.length / maxPoints));

    // Draw waveform with anti-aliasing
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw filled area first
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);

    for (let i = 0; i < amplitude.length; i += step) {
      const x = margin.left + (i / amplitude.length) * chartWidth;
      const amp = amplitude[i]!;
      const y =
        margin.top + chartHeight - ((amp - displayMin) / displayRange) * chartHeight;

      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.lineTo(margin.left + chartWidth, zeroY);
    ctx.closePath();

    // Gradient fill under curve
    const fillGradient = ctx.createLinearGradient(
      0,
      margin.top,
      0,
      margin.top + chartHeight
    );
    fillGradient.addColorStop(0, "rgba(100, 220, 255, 0.25)");
    fillGradient.addColorStop(0.5, "rgba(70, 180, 255, 0.15)");
    fillGradient.addColorStop(1, "rgba(50, 140, 255, 0.05)");

    ctx.fillStyle = fillGradient;
    ctx.fill();

    // Draw main waveform line with glow effect
    ctx.beginPath();
    for (let i = 0; i < amplitude.length; i += step) {
      const x = margin.left + (i / amplitude.length) * chartWidth;
      const amp = amplitude[i]!;
      const y =
        margin.top + chartHeight - ((amp - displayMin) / displayRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Outer glow
    ctx.strokeStyle = "rgba(100, 220, 255, 0.3)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main line
    ctx.strokeStyle = "rgba(100, 220, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = "rgba(200, 240, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = "#e0e6ed";
    ctx.font =
      "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // X-axis label
    ctx.fillText("Time (samples)", width / 2, height - 20);

    // Y-axis label
    ctx.save();
    ctx.translate(18, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();

    // Draw tick labels
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";

    // Y-axis ticks
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const amp = displayMin + (displayRange * i) / yTicks;
      const y = margin.top + chartHeight - (chartHeight * i) / yTicks;

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(amp.toFixed(3), margin.left - 8, y);

      // Tick mark
      ctx.strokeStyle = "#5aa3e8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }

    // X-axis ticks
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const sampleNum = Math.floor((samples.length * i) / xTicks);
      const x = margin.left + (chartWidth * i) / xTicks;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(sampleNum.toString(), x, zeroY + 8);

      // Tick mark
      ctx.strokeStyle = "#5aa3e8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, zeroY + 5);
      ctx.stroke();
    }

    // Draw reference lines for min/max/avg
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    // Max line
    const maxY =
      margin.top +
      chartHeight -
      ((maxAmplitude - displayMin) / displayRange) * chartHeight;
    ctx.strokeStyle = "rgba(255, 100, 100, 0.5)";
    ctx.beginPath();
    ctx.moveTo(margin.left, maxY);
    ctx.lineTo(margin.left + chartWidth, maxY);
    ctx.stroke();

    // Min line
    const minY =
      margin.top +
      chartHeight -
      ((minAmplitude - displayMin) / displayRange) * chartHeight;
    ctx.strokeStyle = "rgba(100, 200, 100, 0.5)";
    ctx.beginPath();
    ctx.moveTo(margin.left, minY);
    ctx.lineTo(margin.left + chartWidth, minY);
    ctx.stroke();

    // Avg line
    const avgY =
      margin.top +
      chartHeight -
      ((avgAmplitude - displayMin) / displayRange) * chartHeight;
    ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
    ctx.beginPath();
    ctx.moveTo(margin.left, avgY);
    ctx.lineTo(margin.left + chartWidth, avgY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Add title
    ctx.font =
      "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.fillText("Amplitude Waveform", width / 2, 28);

    // Add statistics
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "right";
    ctx.fillText(
      `Max: ${maxAmplitude.toFixed(4)} | Min: ${minAmplitude.toFixed(4)} | Avg: ${avgAmplitude.toFixed(4)}`,
      width - 20,
      28
    );

    // Add legend for reference lines
    ctx.textAlign = "left";
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const legendY = margin.top + 10;
    const legendX = margin.left + 10;

    ctx.fillStyle = "rgba(255, 100, 100, 0.7)";
    ctx.fillText("━━ Max", legendX, legendY);

    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.fillText("━━ Avg", legendX + 60, legendY);

    ctx.fillStyle = "rgba(100, 200, 100, 0.7)";
    ctx.fillText("━━ Min", legendX + 120, legendY);
  }, [samples, width, height]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
