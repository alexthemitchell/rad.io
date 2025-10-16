import { useEffect, useRef, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { performanceMonitor } from "../utils/performanceMonitor";
import { useVisualizationInteraction } from "../hooks/useVisualizationInteraction";

type WaterfallDisplayProps = {
  fftData: Float32Array[];
  width?: number;
  height?: number;
  freqMin?: number;
  freqMax?: number;
  scrollSpeed?: number; // pixels per update
  maxHistory?: number; // maximum number of FFT frames to keep
};

export default function WaterfallDisplay({
  fftData,
  width = 750,
  height = 800,
  freqMin = 1000,
  freqMax = 1100,
  scrollSpeed = 1,
  maxHistory = 800,
}: WaterfallDisplayProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<Float32Array[]>([]);
  const scrollOffsetRef = useRef<number>(0);

  // Add interaction handlers for pan, zoom, and gestures
  const { transform, handlers, resetTransform } = useVisualizationInteraction();

  // Track animation frame for smooth scrolling
  const animationFrameRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  // Generate accessible text description of the waterfall data
  const accessibleDescription = useMemo((): string => {
    if (fftData.length === 0) {
      return "No waterfall data available";
    }

    const numFrames = fftData.length;
    const binCount = freqMax - freqMin;

    // Find peak power and its frequency
    let maxPower = -Infinity;
    let maxPowerBin = 0;
    fftData.forEach((row) => {
      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (isFinite(value) && value > maxPower) {
          maxPower = value;
          maxPowerBin = bin;
        }
      }
    });

    return `Waterfall display showing ${numFrames} time frames across ${binCount} frequency bins (${freqMin} to ${freqMax}). Peak power of ${maxPower.toFixed(2)} dB detected at frequency bin ${maxPowerBin}. Colors represent signal strength from low (dark) to high (bright). Display scrolls to show temporal changes.`;
  }, [fftData, freqMin, freqMax]);

  // Update history with new FFT data
  useEffect(() => {
    if (fftData.length > 0) {
      const newHistory = [...historyRef.current, ...fftData];
      // Keep only the most recent frames up to maxHistory
      if (newHistory.length > maxHistory) {
        newHistory.splice(0, newHistory.length - maxHistory);
      }
      historyRef.current = newHistory;
    }
  }, [fftData, maxHistory]);

  // Render waterfall display
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderWaterfall = (): void => {
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) {
        return;
      }

      const markStart = "render-waterfall-start";
      performanceMonitor.mark(markStart);

      // Set up high DPI canvas for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      // Apply user interaction transform (pan and zoom)
      ctx.save();
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      // Professional dark background
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, width, height);

      const margin = { top: 70, bottom: 70, left: 80, right: 120 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      const history = historyRef.current;
      if (history.length === 0) {
        ctx.restore();
        return;
      }

      // Calculate pixel height per FFT row (scrolling direction)
      const rowHeight = Math.max(1, scrollSpeed);
      const visibleRows = Math.min(
        Math.ceil(chartHeight / rowHeight),
        history.length,
      );

      // Calculate starting row based on scroll offset
      const startRow = Math.max(0, history.length - visibleRows);

      // Calculate bin width (frequency direction)
      const binWidth = chartWidth / (freqMax - freqMin);

      // Find global min/max for dynamic range optimization
      let globalMin = Infinity;
      let globalMax = -Infinity;

      history.forEach((row) => {
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

      // Render waterfall - oldest at top, newest at bottom (scrolling up)
      for (let i = 0; i < visibleRows; i++) {
        const rowIdx = startRow + i;
        const row = history[rowIdx];
        if (!row) {
          continue;
        }

        // Y position: newest rows at bottom, scrolling upward
        const y =
          margin.top +
          chartHeight -
          (i + 1) * rowHeight +
          (scrollOffsetRef.current % rowHeight);

        for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
          const value = row[bin]!;
          if (!isFinite(value)) {
            continue;
          }

          // Normalize with dynamic range compression
          const normalized =
            (value - effectiveMin) / (effectiveMax - effectiveMin);

          // Viridis-like colormap for professional appearance
          const t = Math.max(0, Math.min(1, normalized));
          const r = Math.round(68 + 185 * t);
          const g = Math.round(1 + 220 * t);
          const b = Math.round(84 - 50 * t);

          const x = margin.left + (bin - freqMin) * binWidth;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, y, binWidth + 0.5, rowHeight + 0.5);
        }
      }

      // Draw axes and labels
      ctx.fillStyle = "#e0e6ed";
      ctx.font = "14px 'SF Pro Display', -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";

      // Title
      ctx.fillText("Frequency →", width / 2, margin.top - 30);

      // Y-axis label
      ctx.save();
      ctx.translate(20, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Time ↓", 0, 0);
      ctx.restore();

      // Restore context state after transform
      ctx.restore();

      performanceMonitor.measure("render-waterfall", markStart);
    };

    // Animation loop for smooth scrolling
    const animate = (): void => {
      if (isAnimating && historyRef.current.length > 0) {
        scrollOffsetRef.current += scrollSpeed;
        renderWaterfall();
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    return (): void => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    width,
    height,
    freqMin,
    freqMax,
    scrollSpeed,
    transform,
    isAnimating,
  ]);

  // Toggle animation on/off
  const toggleAnimation = (): void => {
    setIsAnimating((prev) => !prev);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "8px",
          touchAction: "none", // Prevent default touch behaviors
          cursor: "grab",
        }}
        role="img"
        aria-label={accessibleDescription}
        tabIndex={0}
        {...handlers}
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          display: "flex",
          gap: "8px",
          zIndex: 10,
        }}
      >
        {(transform.scale !== 1 ||
          transform.offsetX !== 0 ||
          transform.offsetY !== 0) && (
          <button
            onClick={resetTransform}
            style={{
              padding: "6px 12px",
              background: "rgba(90, 163, 232, 0.9)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            title="Reset view (or press 0)"
            aria-label="Reset visualization view"
          >
            Reset View
          </button>
        )}
        <button
          onClick={toggleAnimation}
          style={{
            padding: "6px 12px",
            background: isAnimating
              ? "rgba(90, 163, 232, 0.9)"
              : "rgba(160, 170, 181, 0.9)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold",
          }}
          title={isAnimating ? "Pause scrolling" : "Resume scrolling"}
          aria-label={isAnimating ? "Pause waterfall" : "Resume waterfall"}
        >
          {isAnimating ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}
