import { useCallback, useEffect, useRef, useState } from "react";

export type InteractionSettings = {
  panSensitivity: number;
  zoomSensitivity: number;
  minZoom: number;
  maxZoom: number;
  enablePan: boolean;
  enableZoom: boolean;
  enableMultiTouch: boolean;
  enableKeyboard: boolean;
};

export type ViewTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

const DEFAULT_SETTINGS: InteractionSettings = {
  panSensitivity: 1.0,
  zoomSensitivity: 1.0,
  minZoom: 0.5,
  maxZoom: 10.0,
  enablePan: true,
  enableZoom: true,
  enableMultiTouch: true,
  enableKeyboard: true,
};

export function useVisualizationInteraction(
  initialSettings: Partial<InteractionSettings> = {},
): {
  transform: ViewTransform;
  settings: InteractionSettings;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLCanvasElement>) => void;
  };
  canvasRef: (element: HTMLCanvasElement | null) => void;
  resetTransform: () => void;
} {
  const [settings] = useState<InteractionSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

  const [transform, setTransform] = useState<ViewTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  // Track pointer state
  const pointerStateRef = useRef<{
    isPointerDown: boolean;
    lastX: number;
    lastY: number;
    pointerId: number | null;
    // For multi-touch
    pointers: Map<number, { x: number; y: number }>;
    initialDistance: number | null;
    initialScale: number;
  }>({
    isPointerDown: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
    pointers: new Map(),
    initialDistance: null,
    initialScale: 1,
  });

  // Calculate distance between two pointers for pinch gesture
  const getPointerDistance = useCallback(
    (pointers: Map<number, { x: number; y: number }>) => {
      if (pointers.size !== 2) {
        return null;
      }
      const coords = Array.from(pointers.values());
      const coord0 = coords[0];
      const coord1 = coords[1];
      if (!coord0 || !coord1) {
        return null;
      }
      const dx = coord0.x - coord1.x;
      const dy = coord0.y - coord1.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    [],
  );

  // Handle pointer down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!settings.enablePan && !settings.enableMultiTouch) {
        return;
      }

      e.preventDefault();
      const canvas = e.currentTarget;
      canvas.setPointerCapture(e.pointerId);

      const state = pointerStateRef.current;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (state.pointers.size === 1) {
        // Single pointer - start pan
        state.isPointerDown = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.pointerId = e.pointerId;
      } else if (state.pointers.size === 2 && settings.enableMultiTouch) {
        // Two pointers - start pinch
        state.initialDistance = getPointerDistance(state.pointers);
        state.initialScale = transform.scale;
      }
    },
    [
      settings.enablePan,
      settings.enableMultiTouch,
      transform.scale,
      getPointerDistance,
    ],
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!settings.enablePan && !settings.enableMultiTouch) {
        return;
      }

      const state = pointerStateRef.current;

      if (!state.pointers.has(e.pointerId)) {
        return;
      }

      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (state.pointers.size === 2 && settings.enableMultiTouch) {
        // Two finger pinch
        e.preventDefault();
        const currentDistance = getPointerDistance(state.pointers);
        if (currentDistance && state.initialDistance && settings.enableZoom) {
          const scaleFactor = currentDistance / state.initialDistance;
          const newScale = Math.max(
            settings.minZoom,
            Math.min(settings.maxZoom, state.initialScale * scaleFactor),
          );
          setTransform((prev) => ({
            ...prev,
            scale: newScale,
          }));
        }
      } else if (
        state.isPointerDown &&
        state.pointerId === e.pointerId &&
        settings.enablePan
      ) {
        // Single finger/pointer pan
        e.preventDefault();
        const dx = (e.clientX - state.lastX) * settings.panSensitivity;
        const dy = (e.clientY - state.lastY) * settings.panSensitivity;

        setTransform((prev) => ({
          ...prev,
          offsetX: prev.offsetX + dx,
          offsetY: prev.offsetY + dy,
        }));

        state.lastX = e.clientX;
        state.lastY = e.clientY;
      }
    },
    [settings, getPointerDistance],
  );

  // Handle pointer up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const state = pointerStateRef.current;
      state.pointers.delete(e.pointerId);

      if (state.pointerId === e.pointerId) {
        state.isPointerDown = false;
        state.pointerId = null;
      }

      if (state.pointers.size < 2) {
        state.initialDistance = null;
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture was already released
      }
    },
    [],
  );

  // Handle wheel event for zoom (native event for passive: false support)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!settings.enableZoom) {
        return;
      }

      // Require a modifier key to avoid accidental zooming while scrolling the page
      const allowZoom = e.ctrlKey || e.metaKey;
      if (!allowZoom) {
        // Do not prevent default to allow normal page scroll
        return;
      }

      e.preventDefault();

      // Use deltaY for vertical scrolling (most common)
      const delta = -e.deltaY;
      const zoomFactor = 1 + delta * settings.zoomSensitivity * 0.001;

      const newScale = Math.max(
        settings.minZoom,
        Math.min(settings.maxZoom, transform.scale * zoomFactor),
      );

      setTransform((prev) => ({
        ...prev,
        scale: newScale,
      }));
    },
    [settings, transform.scale],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (!settings.enableKeyboard) {
        return;
      }

      const step = 10 * settings.panSensitivity;
      const zoomStep = 0.1 * settings.zoomSensitivity;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setTransform((prev) => ({ ...prev, offsetX: prev.offsetX - step }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setTransform((prev) => ({ ...prev, offsetX: prev.offsetX + step }));
          break;
        case "ArrowUp":
          e.preventDefault();
          setTransform((prev) => ({ ...prev, offsetY: prev.offsetY - step }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setTransform((prev) => ({ ...prev, offsetY: prev.offsetY + step }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          if (settings.enableZoom) {
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(settings.maxZoom, prev.scale + zoomStep),
            }));
          }
          break;
        case "-":
        case "_":
          e.preventDefault();
          if (settings.enableZoom) {
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(settings.minZoom, prev.scale - zoomStep),
            }));
          }
          break;
        case "0":
          e.preventDefault();
          // Reset transform
          setTransform({ offsetX: 0, offsetY: 0, scale: 1 });
          break;
      }
    },
    [settings],
  );

  // Reset transform to default
  const resetTransform = useCallback(() => {
    setTransform({ offsetX: 0, offsetY: 0, scale: 1 });
  }, []);

  // Attach wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasElementRef.current;
    if (!canvas || !settings.enableZoom) {
      return;
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return (): void => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, settings.enableZoom]);

  // Callback ref to capture canvas element
  const canvasRef = useCallback((element: HTMLCanvasElement | null) => {
    canvasElementRef.current = element;
  }, []);

  return {
    transform,
    settings,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onKeyDown: handleKeyDown,
    },
    canvasRef,
    resetTransform,
  };
}
