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

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear with dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 50, bottom: 50, left: 60, right: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate waveform data
    const { amplitude, phase } = calculateWaveform(samples);
    
    // Find max amplitude for scaling
    const maxAmplitude = Math.max(...Array.from(amplitude));
    const minAmplitude = Math.min(...Array.from(amplitude));
    const amplitudeRange = maxAmplitude - minAmplitude || 1;

    // Draw grid
    ctx.strokeStyle = "rgba(100, 120, 150, 0.1)";
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 5; i++) {
      const y = margin.top + (chartHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw axes
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

    // Draw amplitude waveform with gradient
    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
    gradient.addColorStop(0, "rgba(100, 220, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(70, 180, 255, 0.6)");
    gradient.addColorStop(1, "rgba(50, 140, 255, 0.4)");

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;

    const sampleStep = Math.max(1, Math.floor(samples.length / chartWidth));
    
    for (let i = 0; i < samples.length; i += sampleStep) {
      const x = margin.left + (i / samples.length) * chartWidth;
      const normalizedAmp = (amplitude[i]! - minAmplitude) / amplitudeRange;
      const y = margin.top + chartHeight - normalizedAmp * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Add glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(100, 220, 255, 0.5)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill area under curve with gradient
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.closePath();

    const fillGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
    fillGradient.addColorStop(0, "rgba(100, 220, 255, 0.3)");
    fillGradient.addColorStop(1, "rgba(50, 140, 255, 0.05)");
    ctx.fillStyle = fillGradient;
    ctx.fill();

    // Draw labels
    ctx.fillStyle = "#e0e6ed";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // X-axis label
    ctx.fillText("Time (samples)", width / 2, height - 20);

    // Y-axis label
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();

    // Draw tick labels
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";

    // X-axis ticks
    const numTimeTicks = 5;
    for (let i = 0; i <= numTimeTicks; i++) {
      const sampleNum = Math.floor((samples.length * i) / numTimeTicks);
      const x = margin.left + (chartWidth * i) / numTimeTicks;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(sampleNum.toString(), x, margin.top + chartHeight + 8);

      // Tick mark
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, margin.top + chartHeight);
      ctx.lineTo(x, margin.top + chartHeight + 5);
      ctx.stroke();
    }

    // Y-axis ticks
    const numAmpTicks = 4;
    for (let i = 0; i <= numAmpTicks; i++) {
      const amp = minAmplitude + (amplitudeRange * i) / numAmpTicks;
      const y = margin.top + chartHeight - (chartHeight * i) / numAmpTicks;

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(amp.toFixed(3), margin.left - 8, y);

      // Tick mark
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }

    // Add title
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e0e6ed";
    ctx.textAlign = "center";
    ctx.fillText("Amplitude Waveform", width / 2, 25);

    // Add stats
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#a0aab5";
    ctx.textAlign = "right";
    ctx.fillText(
      `Max: ${maxAmplitude.toFixed(3)} | Min: ${minAmplitude.toFixed(3)}`,
      width - 20,
      25
    );
  }, [samples, width, height]);

  return <canvas ref={canvasRef} style={{ borderRadius: "8px" }} />;
}
