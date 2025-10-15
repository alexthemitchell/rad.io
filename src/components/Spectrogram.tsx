import { useEffect, useRef } from "react";

type SpectrogramProps = {
  fftData: Float32Array[];
  width?: number;
  height?: number;
  freqMin?: number;
  freqMax?: number;
};

export default function Spectrogram({
  fftData,
  width = 750,
  height = 800,
  freqMin = 1000,
  freqMax = 1100,
}: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fftData.length === 0) return;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    // Set up high DPI canvas for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Professional dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 70, bottom: 70, left: 80, right: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate dimensions
    const numFrames = fftData.length;
    const fftSize = fftData[0]?.length || 1024;
    const frameWidth = Math.max(1, chartWidth / numFrames);
    const binHeight = chartHeight / (freqMax - freqMin);

    // Industry-standard viridis colormap (perceptually uniform)
    // Based on matplotlib viridis - scientifically validated
    const viridisColors = [
      [68, 1, 84], // Dark purple (low)
      [72, 35, 116],
      [64, 67, 135], // Purple-blue
      [52, 94, 141],
      [41, 120, 142], // Blue
      [32, 144, 140],
      [34, 167, 132], // Cyan-green
      [68, 190, 112],
      [121, 209, 81], // Green
      [189, 222, 38],
      [253, 231, 37], // Yellow (high)
    ];

    const getViridisColor = (normalized: number): string => {
      const t = Math.max(0, Math.min(1, normalized));
      const idx = t * (viridisColors.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      const frac = idx - lower;

      const c1 = viridisColors[lower] || viridisColors[0]!;
      const c2 =
        viridisColors[upper] || viridisColors[viridisColors.length - 1]!;

      const r = Math.round(c1[0]! + (c2[0]! - c1[0]!) * frac);
      const g = Math.round(c1[1]! + (c2[1]! - c1[1]!) * frac);
      const b = Math.round(c1[2]! + (c2[2]! - c1[2]!) * frac);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Find global min/max for dynamic range optimization
    let globalMin = Infinity;
    let globalMax = -Infinity;

    fftData.forEach((row) => {
      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (isFinite(value)) {
          globalMin = Math.min(globalMin, value);
          globalMax = Math.max(globalMax, value);
        }
      }
    });

    // Apply dynamic range compression for better visualization
    const range = globalMax - globalMin;
    const effectiveMin = globalMin + range * 0.05; // 5% threshold
    const effectiveMax = globalMax;

    // Render spectrogram bins
    fftData.forEach((row, frameIdx) => {
      const x = margin.left + frameIdx * frameWidth;

      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (!isFinite(value)) continue;

        // Normalize with dynamic range compression
        const normalized =
          (value - effectiveMin) / (effectiveMax - effectiveMin);

        const color = getViridisColor(normalized);
        const y = margin.top + chartHeight - (bin - freqMin) * binHeight;

        ctx.fillStyle = color;
        ctx.fillRect(x, y - binHeight, frameWidth + 0.5, binHeight + 0.5);
      }
    });

    // Draw professional axes
    ctx.strokeStyle = "#5aa3e8";
    ctx.lineWidth = 2.5;

    // Y-axis (Frequency)
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // X-axis (Time)
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Enhanced grid lines
    ctx.strokeStyle = "rgba(100, 130, 170, 0.15)";
    ctx.lineWidth = 1;

    // Frequency grid lines (every 20 Hz)
    for (let freq = freqMin; freq <= freqMax; freq += 20) {
      const y = margin.top + chartHeight - (freq - freqMin) * binHeight;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Time grid lines (every 5 frames)
    for (let frame = 0; frame < numFrames; frame += 5) {
      const x = margin.left + frame * frameWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = "#e0e6ed";
    ctx.font =
      "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // X-axis label
    ctx.fillText("Time (s)", margin.left + chartWidth / 2, height - 20);

    // Y-axis label
    ctx.save();
    ctx.translate(18, margin.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Frequency (Hz)", 0, 0);
    ctx.restore();

    // Draw tick labels
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";

    // Y-axis (frequency) ticks - every 25 Hz
    for (let freq = freqMin; freq <= freqMax; freq += 25) {
      const y = margin.top + chartHeight - (freq - freqMin) * binHeight;

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(freq.toString(), margin.left - 8, y);

      // Tick mark
      ctx.strokeStyle = "#5aa3e8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }

    // X-axis (time) ticks - show frame numbers
    const timeStep = Math.ceil(numFrames / 6);
    for (let frame = 0; frame <= numFrames; frame += timeStep) {
      if (frame >= numFrames) frame = numFrames - 1;
      const x = margin.left + frame * frameWidth;
      const timeSec = (frame / numFrames) * 30; // Assuming 30 second total

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(timeSec.toFixed(1), x, margin.top + chartHeight + 8);

      // Tick mark
      ctx.strokeStyle = "#5aa3e8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, margin.top + chartHeight);
      ctx.lineTo(x, margin.top + chartHeight + 5);
      ctx.stroke();
    }

    // Draw color scale legend
    const legendWidth = 20;
    const legendHeight = chartHeight;
    const legendX = width - margin.right + 20;
    const legendY = margin.top;

    // Draw gradient for legend
    const gradient = ctx.createLinearGradient(
      0,
      legendY + legendHeight,
      0,
      legendY,
    );
    for (let i = 0; i <= 10; i++) {
      gradient.addColorStop(i / 10, getViridisColor(i / 10));
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

    // Border for legend
    ctx.strokeStyle = "rgba(100, 130, 170, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

    // Legend labels
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "left";

    const legendTicks = 5;
    for (let i = 0; i <= legendTicks; i++) {
      const y = legendY + legendHeight - (i / legendTicks) * legendHeight;
      const dbValue =
        effectiveMin + (i / legendTicks) * (effectiveMax - effectiveMin);

      ctx.textBaseline = "middle";
      ctx.fillText(`${dbValue.toFixed(0)} dB`, legendX + legendWidth + 5, y);

      // Tick mark
      ctx.strokeStyle = "#a0aab5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX + legendWidth, y);
      ctx.stroke();
    }

    // Legend title
    ctx.font =
      "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(legendX + legendWidth / 2, legendY - 20);
    ctx.fillText("Power", 0, 0);
    ctx.restore();

    // Add main title
    ctx.font =
      "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.fillText("Power Spectral Density", width / 2, 30);

    // Add metadata
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "right";
    ctx.fillText(
      `${numFrames} frames | FFT: ${fftSize} bins`,
      width - margin.right - legendWidth - 30,
      30,
    );
  }, [fftData, width, height, freqMin, freqMax]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
