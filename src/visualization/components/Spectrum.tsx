/**
 * Spectrum component - frequency domain line chart with WebGL/Canvas2D fallback
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useStore, useMarkers } from "../../store";
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
  /** Enable marker placement (default: false) */
  enableMarkers?: boolean;
}

export default function Spectrum({
  magnitudes,
  freqMin = 0,
  freqMax = 1024,
  width = 750,
  height = 400,
  sampleRate,
  centerFrequency,
  enableMarkers = false,
}: SpectrumProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const annotationsRef = useRef<SpectrumAnnotations | null>(null);
  const [rendererType, setRendererType] = useState<"webgl" | "canvas" | null>(
    null,
  );
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);
  const announcementTimeoutsRef = useRef<Set<number>>(new Set());

  // Subscribe to VFO frequency and markers from Zustand store
  const vfoFrequency = useStore((state) => state.frequencyHz);
  const { markers, addMarker, updateMarker, removeMarker } = useMarkers();

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

  // Cleanup announcement timeouts on unmount
  useEffect((): (() => void) => {
    const timeouts = announcementTimeoutsRef.current;
    return () => {
      // Cleanup all pending timeouts on unmount
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Render VFO cursor and markers when frequency or display params change
  useEffect(() => {
    const annotations = annotationsRef.current;
    if (!annotations?.isReady()) {
      return;
    }

    // Only render if sampleRate and centerFrequency are provided
    if (typeof sampleRate !== "number" || typeof centerFrequency !== "number") {
      // Clear the overlay canvas
      annotations.clear();
      return;
    }

    // Render VFO cursor (clears internally)
    annotations.renderVFOCursor(vfoFrequency, sampleRate, centerFrequency);

    // Render markers if enabled
    if (enableMarkers && markers.length > 0) {
      annotations.renderMarkers(
        markers,
        sampleRate,
        centerFrequency,
        hoveredMarkerId,
      );
    }
  }, [
    vfoFrequency,
    sampleRate,
    centerFrequency,
    width,
    height,
    markers,
    hoveredMarkerId,
    enableMarkers,
  ]);

  // Get power value at frequency from FFT data
  const getPowerAtFrequency = useCallback(
    (freqHz: number): number | undefined => {
      if (!sampleRate || !centerFrequency || magnitudes.length === 0) {
        return undefined;
      }

      const freqMin = centerFrequency - sampleRate / 2;
      const freqMax = centerFrequency + sampleRate / 2;
      if (freqHz < freqMin || freqHz > freqMax) {
        return undefined;
      }

      // Convert frequency to bin index
      const freqNorm = (freqHz - freqMin) / (freqMax - freqMin);
      const binIndex = Math.round(freqNorm * (magnitudes.length - 1));

      // Validate binIndex is within bounds
      if (binIndex < 0 || binIndex >= magnitudes.length) {
        return undefined;
      }

      return magnitudes[binIndex];
    },
    [magnitudes, sampleRate, centerFrequency],
  );

  // Click handler: place marker at clicked position
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!enableMarkers || !sampleRate || !centerFrequency) {
        return;
      }

      const canvas = overlayCanvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const annotations = annotationsRef.current;
      if (!annotations) {
        return;
      }

      // Check if clicking on existing marker (to prevent duplicate placement)
      const markerHit = annotations.findMarkerAt(
        x,
        y,
        markers,
        sampleRate,
        centerFrequency,
      );
      if (markerHit) {
        return; // Don't place new marker if clicking on existing one
      }

      // Convert pixel to frequency
      const freqHz = annotations.pixelToFrequency(
        x,
        rect.width,
        sampleRate,
        centerFrequency,
      );
      const powerDb = getPowerAtFrequency(freqHz);

      // Add marker (max 10 markers)
      if (markers.length < 10) {
        addMarker(freqHz, powerDb);

        // Announce to screen readers
        const announcement = `Marker ${markers.length + 1} placed at ${(freqHz / 1e6).toFixed(3)} MHz${powerDb !== undefined ? `, ${powerDb.toFixed(2)} dBFS` : ""}`;
        announceToScreenReader(announcement);
      } else {
        announceToScreenReader(
          "Cannot add marker: maximum of 10 markers reached",
        );
      }
    },
    [
      enableMarkers,
      sampleRate,
      centerFrequency,
      markers,
      addMarker,
      getPowerAtFrequency,
    ],
  );

  // Right-click handler: delete marker
  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!enableMarkers || !sampleRate || !centerFrequency) {
        return;
      }

      const canvas = overlayCanvasRef.current;
      const annotations = annotationsRef.current;
      if (!canvas || !annotations) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const markerHit = annotations.findMarkerAt(
        x,
        y,
        markers,
        sampleRate,
        centerFrequency,
      );
      if (markerHit) {
        event.preventDefault(); // Only prevent when deleting a marker
        removeMarker(markerHit.marker.id);
        announceToScreenReader(`${markerHit.marker.label} deleted`);
      }
    },
    [enableMarkers, sampleRate, centerFrequency, markers, removeMarker],
  );

  // Mouse down handler: start drag
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!enableMarkers || !sampleRate || !centerFrequency) {
        return;
      }

      const canvas = overlayCanvasRef.current;
      const annotations = annotationsRef.current;
      if (!canvas || !annotations) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const markerHit = annotations.findMarkerAt(
        x,
        y,
        markers,
        sampleRate,
        centerFrequency,
      );
      if (markerHit) {
        setDraggedMarkerId(markerHit.marker.id);
        event.preventDefault();
      }
    },
    [enableMarkers, sampleRate, centerFrequency, markers],
  );

  // Mouse move handler: update hover state and drag marker
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!enableMarkers || !sampleRate || !centerFrequency) {
        return;
      }

      const canvas = overlayCanvasRef.current;
      const annotations = annotationsRef.current;
      if (!canvas || !annotations) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Handle dragging
      if (draggedMarkerId) {
        canvas.style.cursor = "grabbing";
        const freqHz = annotations.pixelToFrequency(
          x,
          rect.width,
          sampleRate,
          centerFrequency,
        );
        const powerDb = getPowerAtFrequency(freqHz);
        updateMarker(draggedMarkerId, freqHz, powerDb);
        return;
      }

      // Update hover state
      const markerHit = annotations.findMarkerAt(
        x,
        y,
        markers,
        sampleRate,
        centerFrequency,
      );
      setHoveredMarkerId(markerHit ? markerHit.marker.id : null);

      // Update cursor style
      canvas.style.cursor = markerHit
        ? markerHit.isDragHandle
          ? "grab"
          : "pointer"
        : "default";
    },
    [
      enableMarkers,
      sampleRate,
      centerFrequency,
      markers,
      draggedMarkerId,
      updateMarker,
      getPowerAtFrequency,
    ],
  );

  // Mouse up handler: end drag
  const handleMouseUp = useCallback(() => {
    if (draggedMarkerId) {
      const marker = markers.find((m) => m.id === draggedMarkerId);
      if (marker) {
        announceToScreenReader(
          `${marker.label} repositioned to ${(marker.freqHz / 1e6).toFixed(3)} MHz${marker.powerDb !== undefined ? `, ${marker.powerDb.toFixed(2)} dBFS` : ""}`,
        );
      }
      setDraggedMarkerId(null);
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        canvas.style.cursor = "default";
      }
    }
  }, [draggedMarkerId, markers]);

  // Mouse leave handler: clear hover state and end drag
  const handleMouseLeave = useCallback(() => {
    setHoveredMarkerId(null);
    if (draggedMarkerId) {
      setDraggedMarkerId(null);
    }
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      canvas.style.cursor = "default";
    }
  }, [draggedMarkerId]);

  // Keyboard handler: 'M' to add marker at center frequency
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (!enableMarkers || !sampleRate || !centerFrequency) {
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        const powerDb = getPowerAtFrequency(centerFrequency);
        if (markers.length < 10) {
          addMarker(centerFrequency, powerDb);
          announceToScreenReader(
            `Marker ${markers.length + 1} placed at center frequency ${(centerFrequency / 1e6).toFixed(3)} MHz${powerDb !== undefined ? `, ${powerDb.toFixed(2)} dBFS` : ""}`,
          );
        } else {
          announceToScreenReader(
            "Cannot add marker: maximum of 10 markers reached",
          );
        }
      }
    },
    [
      enableMarkers,
      sampleRate,
      centerFrequency,
      markers,
      addMarker,
      getPowerAtFrequency,
    ],
  );

  // Helper function to announce to screen readers
  const announceToScreenReader = (message: string): void => {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.className = "rad-sr-only";
    announcement.textContent = message;
    document.body.appendChild(announcement);
    const timeoutId = window.setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
      announcementTimeoutsRef.current.delete(timeoutId);
    }, 1000);
    announcementTimeoutsRef.current.add(timeoutId);
  };

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
            pointerEvents: enableMarkers ? "auto" : "none",
          }}
          aria-hidden={!enableMarkers}
          aria-label={
            enableMarkers
              ? `Spectrum markers overlay. ${markers.length} markers placed. Click to add marker, right-click to remove, drag to reposition. Press M to add marker at center frequency.`
              : undefined
          }
          onClick={enableMarkers ? handleClick : undefined}
          onContextMenu={enableMarkers ? handleContextMenu : undefined}
          onMouseDown={enableMarkers ? handleMouseDown : undefined}
          onMouseMove={enableMarkers ? handleMouseMove : undefined}
          onMouseUp={enableMarkers ? handleMouseUp : undefined}
          onMouseLeave={enableMarkers ? handleMouseLeave : undefined}
          onKeyDown={enableMarkers ? handleKeyDown : undefined}
          tabIndex={enableMarkers ? 0 : undefined}
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
