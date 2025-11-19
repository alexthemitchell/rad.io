/**
 * Spectrum component - frequency domain line chart with WebGL/Canvas2D fallback
 */

import { useEffect, useRef, useState, type ReactElement } from "react";
import { useStore } from "../../store";
import {
  CanvasSpectrum,
  WebGLSpectrum,
  type SpectrumData,
  type Renderer,
} from "../renderers";
import { SpectrumAnnotations } from "../renderers/SpectrumAnnotations";

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
  /** Sample rate in Hz (for VFO cursor calculation) */
  sampleRate?: number;
  /** Center frequency in Hz (for VFO cursor calculation) */
  centerFrequency?: number;
}

export default function Spectrum({
  magnitudes,
  freqMin = 0,
  freqMax = 1024,
  width = 750,
  height = 400,
  sampleRate,
  centerFrequency,
}: SpectrumProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const annotationsRef = useRef<SpectrumAnnotations | null>(null);
  const [rendererType, setRendererType] = useState<"webgl" | "canvas" | null>(
    null,
  );

  // Subscribe to VFO frequency from Zustand store
  const vfoFrequency = useStore((state) => state.frequencyHz);

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

  // Initialize overlay canvas for VFO cursor
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) {
      // Canvas not in DOM (sampleRate or centerFrequency not provided)
      return;
    }

    // Check if already initialized
    if (annotationsRef.current?.isReady()) {
      return;
    }

    const annotations = new SpectrumAnnotations();
    const success = annotations.initialize(overlayCanvas);

    if (success) {
      annotationsRef.current = annotations;
    } else {
      console.warn("[Spectrum] Failed to initialize VFO cursor overlay");
    }

    return (): void => {
      if (annotationsRef.current) {
        annotationsRef.current.cleanup();
        annotationsRef.current = null;
      }
    };
  }, [sampleRate, centerFrequency]);

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

  // Render VFO cursor when frequency or display params change
  useEffect(() => {
    const annotations = annotationsRef.current;
    if (!annotations?.isReady()) {
      return;
    }

    // Only render VFO cursor if sampleRate and centerFrequency are provided
    if (typeof sampleRate !== "number" || typeof centerFrequency !== "number") {
      // Clear the overlay canvas if VFO cursor should not be shown
      annotations.clear();
      return;
    }

    // Render VFO cursor (handles its own clearing and DPR scaling)
    annotations.renderVFOCursor(vfoFrequency, sampleRate, centerFrequency);
  }, [vfoFrequency, sampleRate, centerFrequency, width, height]);

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
        aria-label={`Spectrum display showing frequency bins ${freqMin} to ${freqMax}${
          sampleRate && centerFrequency
            ? `, VFO at ${(vfoFrequency / 1e6).toFixed(3)} MHz`
            : ""
        }`}
      />
      {sampleRate && centerFrequency && (
        <canvas
          ref={overlayCanvasRef}
          width={width}
          height={height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
      )}
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
