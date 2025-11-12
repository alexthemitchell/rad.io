/**
 * Spectrum component - frequency domain line chart with WebGL/Canvas2D fallback
 */

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  CanvasSpectrum,
  WebGLSpectrum,
  type SpectrumData,
  type Renderer,
} from "../renderers";

export interface SpectrumProps {
  /** FFT magnitude data in dB */
  magnitudes: Float32Array;
  /** Minimum frequency bin to display */
  freqMin?: number;
  /** Maximum frequency bin to display */
  freqMax?: number;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
}

export default function Spectrum({
  magnitudes,
  freqMin = 0,
  freqMax = 1024,
  width = 750,
  height = 400,
}: SpectrumProps): ReactElement {
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
        const webglRenderer = new WebGLSpectrum();
        const webglSuccess = await webglRenderer.initialize(canvas);

        if (webglSuccess) {
          rendererRef.current = webglRenderer;
          setRendererType("webgl");
          return;
        }
      } catch (err) {
        console.warn("[Spectrum] WebGL initialization failed:", err);
      }

      // Fallback to Canvas2D
      try {
        const canvasRenderer = new CanvasSpectrum();
        const canvasSuccess = await canvasRenderer.initialize(canvas);

        if (canvasSuccess) {
          rendererRef.current = canvasRenderer;
          setRendererType("canvas");
          return;
        }
      } catch (err) {
        console.error("[Spectrum] Canvas2D initialization failed:", err);
      }

      console.error("[Spectrum] No renderer available");
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

    const data: SpectrumData = {
      magnitudes,
      freqMin,
      freqMax,
    };

    const success = renderer.render(data);
    if (!success) {
      console.warn("[Spectrum] Render failed");
    }
  }, [magnitudes, freqMin, freqMax]);

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
        aria-label={`Spectrum display showing frequency bins ${freqMin} to ${freqMax}`}
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
