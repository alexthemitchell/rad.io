/**
 * Waterfall component - time-frequency heatmap with WebGL/Canvas2D fallback
 */

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  CanvasWaterfall,
  WebGLWaterfall,
  type WaterfallData,
  type Renderer,
} from "../renderers";

export interface WaterfallProps {
  /** Array of FFT frames (each frame is magnitude values in dB) */
  frames: Float32Array[];
  /** Minimum frequency bin to display */
  freqMin?: number;
  /** Maximum frequency bin to display */
  freqMax?: number;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
}

export default function Waterfall({
  frames,
  freqMin = 0,
  freqMax = 1024,
  width = 750,
  height = 800,
}: WaterfallProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [rendererType, setRendererType] = useState<"webgl" | "canvas" | null>(
    null,
  );

  // Initialize renderer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const initRenderer = async (): Promise<void> => {
      // Try WebGL first
      try {
        const webglRenderer = new WebGLWaterfall();
        const webglSuccess = await webglRenderer.initialize(canvas);

        if (webglSuccess) {
          rendererRef.current = webglRenderer;
          setRendererType("webgl");
          return;
        }
      } catch (err) {
        console.warn("[Waterfall] WebGL initialization failed:", err);
      }

      // Fallback to Canvas2D
      try {
        const canvasRenderer = new CanvasWaterfall();
        const canvasSuccess = await canvasRenderer.initialize(canvas);

        if (canvasSuccess) {
          rendererRef.current = canvasRenderer;
          setRendererType("canvas");
          return;
        }
      } catch (err) {
        console.error("[Waterfall] Canvas2D initialization failed:", err);
      }

      console.error("[Waterfall] No renderer available");
    };

    void initRenderer();

    // Cleanup on unmount
    return (): void => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
        rendererRef.current = null;
      }
    };
  }, []);

  // Render when data changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer?.isReady()) {
      return;
    }

    const data: WaterfallData = {
      frames,
      freqMin,
      freqMax,
    };

    const success = renderer.render(data);
    if (!success) {
      console.warn("[Waterfall] Render failed");
    }
  }, [frames, freqMin, freqMax]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        role="img"
        tabIndex={0}
        width={width}
        height={height}
        style={{
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "4px",
        }}
        aria-label={`Waterfall display showing ${frames.length} frames across frequency bins ${freqMin} to ${freqMax}`}
      />
      {rendererType && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            fontSize: "10px",
            color: "rgba(255, 255, 255, 0.5)",
            background: "rgba(0, 0, 0, 0.5)",
            padding: "2px 6px",
            borderRadius: "3px",
          }}
        >
          {rendererType === "webgl" ? "WebGL" : "Canvas2D"}
        </div>
      )}
    </div>
  );
}
