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

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Set up high DPI canvas for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear with dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 50, bottom: 60, left: 70, right: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate dimensions
    const numRows = fftData.length;
    const binWidth = chartWidth / numRows;
    const binHeight = chartHeight / (freqMax - freqMin);

    // Enhanced viridis-inspired colormap for better visibility
    const getColor = (value: number): string => {
      // Normalize value to 0-1 range (dB from -100 to 0)
      const normalized = Math.max(0, Math.min(1, (value + 100) / 100));

      // Use a perceptually uniform colormap (viridis-inspired)
      const colors = [
        [68, 1, 84],     // Dark purple (low)
        [59, 82, 139],   // Blue
        [33, 145, 140],  // Cyan
        [94, 201, 98],   // Green
        [253, 231, 37],  // Yellow (high)
      ];

      const idx = normalized * (colors.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      const t = idx - lower;

      const c1 = colors[lower] || colors[0]!;
      const c2 = colors[upper] || colors[colors.length - 1]!;

      const r = Math.floor(c1[0]! + (c2[0]! - c1[0]!) * t);
      const g = Math.floor(c1[1]! + (c2[1]! - c1[1]!) * t);
      const b = Math.floor(c1[2]! + (c2[2]! - c1[2]!) * t);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Find global min/max for better color scaling
    let globalMin = Infinity;
    let globalMax = -Infinity;
    fftData.forEach((row) => {
      for (let i = freqMin; i < Math.min(freqMax, row.length); i++) {
        const val = row[i] || -100;
        globalMin = Math.min(globalMin, val);
        globalMax = Math.max(globalMax, val);
      }
    });

    // Draw heatmap with interpolation for smoother appearance
    fftData.forEach((row, rowIndex) => {
      const x = margin.left + rowIndex * binWidth;

      for (let binIndex = freqMin; binIndex < Math.min(freqMax, row.length); binIndex++) {
        const value = row[binIndex] || -100;
        const y =
          margin.top + chartHeight - (binIndex - freqMin + 1) * binHeight;

        // Enhanced color with better dynamic range
        const normalizedValue = (value - globalMin) / (globalMax - globalMin + 1);
        ctx.fillStyle = getColor(globalMin + normalizedValue * 100);
        ctx.fillRect(x, y, Math.ceil(binWidth) + 1, Math.ceil(binHeight) + 1);
      }
    });

    // Draw axes with enhanced styling
    ctx.strokeStyle = "#4a90e2";
    ctx.lineWidth = 2;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Draw axis labels with better typography
    ctx.fillStyle = "#e0e6ed";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // X-axis label
    ctx.fillText("Time [s]", width / 2, height - 20);

    // Y-axis label
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Frequency [Hz]", 0, 0);
    ctx.restore();

    // Draw tick labels
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";

    // X-axis ticks (time)
    const numTimeTicks = 8;
    const maxTime = 30; // seconds
    for (let i = 0; i <= numTimeTicks; i++) {
      const time = (maxTime * i) / numTimeTicks;
      const x = margin.left + (chartWidth * i) / numTimeTicks;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(time.toFixed(1), x, margin.top + chartHeight + 8);

      // Draw tick mark
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, margin.top + chartHeight);
      ctx.lineTo(x, margin.top + chartHeight + 5);
      ctx.stroke();
    }

    // Y-axis ticks (frequency)
    const numFreqTicks = 10;
    for (let i = 0; i <= numFreqTicks; i++) {
      const freq = freqMin + ((freqMax - freqMin) * i) / numFreqTicks;
      const y =
        margin.top + chartHeight - ((freq - freqMin) / (freqMax - freqMin)) * chartHeight;

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(freq.toFixed(0), margin.left - 8, y);

      // Draw tick mark
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }

    // Add color scale legend
    const legendWidth = 20;
    const legendHeight = 200;
    const legendX = width - margin.right + 20;
    const legendY = margin.top + (chartHeight - legendHeight) / 2;

    // Draw legend gradient
    for (let i = 0; i < legendHeight; i++) {
      const value = -100 + ((legendHeight - i) / legendHeight) * 100;
      ctx.fillStyle = getColor(value);
      ctx.fillRect(legendX, legendY + i, legendWidth, 1);
    }

    // Legend border
    ctx.strokeStyle = "#4a90e2";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

    // Legend labels
    ctx.fillStyle = "#e0e6ed";
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    const legendTicks = [-100, -75, -50, -25, 0];
    legendTicks.forEach((value) => {
      const y = legendY + legendHeight - ((value + 100) / 100) * legendHeight;
      ctx.fillText(`${value} dB`, legendX + legendWidth + 5, y);
      
      // Tick mark
      ctx.strokeStyle = "#a0aab5";
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX - 3, y);
      ctx.stroke();
    });

    // Add title
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.fillText("Power Spectral Density", width / 2, 25);
    
    // Add FFT info
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "right";
    ctx.fillText(
      `${numRows} frames | FFT: ${fftData[0]?.length || 0} bins`,
      width - margin.right - 30,
      25
    );
  }, [fftData, width, height, freqMin, freqMax]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
