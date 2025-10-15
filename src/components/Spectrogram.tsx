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

    // Calculate dimensions
    const numRows = fftData.length;
    const binWidth = chartWidth / numRows;
    const binHeight = chartHeight / (freqMax - freqMin);

    // Color scale - turbo colormap approximation
    const getColor = (value: number): string => {
      // Normalize value to 0-1 range
      const normalized = Math.max(0, Math.min(1, (value + 50) / 100));

      // Turbo colormap approximation using RGB
      const r = Math.floor(
        255 *
          Math.max(
            0,
            Math.min(
              1,
              1.5 - Math.abs(normalized * 4 - 2.5),
            ),
          ),
      );
      const g = Math.floor(
        255 *
          Math.max(
            0,
            Math.min(
              1,
              1.5 - Math.abs(normalized * 4 - 1.5),
            ),
          ),
      );
      const b = Math.floor(
        255 *
          Math.max(
            0,
            Math.min(
              1,
              1.5 - Math.abs(normalized * 4 - 0.5),
            ),
          ),
      );

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Draw heatmap
    fftData.forEach((row, rowIndex) => {
      const x = margin.left + rowIndex * binWidth;

      for (let binIndex = freqMin; binIndex < freqMax; binIndex++) {
        const value = row[binIndex] || 0;
        const y =
          margin.top + chartHeight - (binIndex - freqMin + 1) * binHeight;

        ctx.fillStyle = getColor(value);
        ctx.fillRect(x, y, binWidth, binHeight);
      }
    });

    // Draw axes
    ctx.strokeStyle = "#374151";
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

    // Draw axis labels
    ctx.fillStyle = "#374151";
    ctx.font = "14px sans-serif";
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
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#6b7280";

    // X-axis ticks (time)
    const numTimeTicks = 10;
    const maxTime = 30; // seconds
    for (let i = 0; i <= numTimeTicks; i++) {
      const time = (maxTime * i) / numTimeTicks;
      const x = margin.left + (chartWidth * i) / numTimeTicks;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(time.toFixed(3), x, margin.top + chartHeight + 5);

      // Draw tick mark
      ctx.strokeStyle = "#374151";
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
      ctx.fillText(freq.toFixed(0), margin.left - 5, y);

      // Draw tick mark
      ctx.strokeStyle = "#374151";
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }
  }, [fftData, width, height, freqMin, freqMax]);

  return <canvas ref={canvasRef} />;
}
