import { useEffect, useRef } from "react";
import type { Renderer } from "../visualization/renderers/types";

/**
 * A React hook to manage the lifecycle of a renderer instance that is tied to a canvas element.
 *
 * @param canvas - The canvas element to attach the renderer to.
 * @param RendererClass - The constructor of the renderer class to instantiate.
 * @returns The renderer instance ref.
 */
export function useRenderer<T extends Renderer>(
  canvas: HTMLCanvasElement | null,
  rendererClass: new () => T,
): React.RefObject<T | null> {
  const rendererRef = useRef<T | null>(null);

  useEffect(() => {
    if (canvas && !rendererRef.current) {
      const renderer = new rendererClass();
      renderer
        .initialize(canvas)
        .then((success) => {
          if (success) {
            rendererRef.current = renderer;
          } else {
            console.error("Failed to initialize renderer:", rendererClass.name);
          }
        })
        .catch((err: unknown) => {
          console.error("Error initializing renderer:", err);
        });
    }

    // Cleanup on unmount
    return (): void => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
        rendererRef.current = null;
      }
    };
  }, [canvas, rendererClass]);

  return rendererRef;
}
