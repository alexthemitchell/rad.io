import { useEffect, useState, useMemo, type RefObject } from "react";

export type UseIntersectionObserverOptions = {
  /**
   * The element that is used as the viewport for checking visibility.
   * Defaults to the browser viewport if not specified.
   */
  root?: Element | null;
  /**
   * Margin around the root. Can have values similar to CSS margin property.
   * Defaults to "0px".
   */
  rootMargin?: string;
  /**
   * Either a single number or an array of numbers which indicate at what percentage
   * of the target's visibility the observer's callback should be executed.
   * Defaults to 0 (as soon as even one pixel is visible).
   */
  threshold?: number | number[];
};

/**
 * Hook to detect element visibility using the IntersectionObserver API.
 * Returns true when the element is visible in the viewport, false when not.
 *
 * @param ref - React ref to the element to observe
 * @param options - IntersectionObserver options
 * @returns {boolean} Whether the element is currently visible
 */
export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options: UseIntersectionObserverOptions = {},
): boolean {
  // Gracefully degrade in non-browser or test environments where
  // IntersectionObserver may not be available. Default to visible so
  // components can render and size canvases synchronously in tests/SSR.
  const isSupported =
    typeof window !== "undefined" &&
    typeof (window as unknown as { IntersectionObserver?: unknown })
      .IntersectionObserver !== "undefined";

  const [isVisible, setIsVisible] = useState<boolean>(
    isSupported ? false : true,
  );

  // Memoize options to prevent unnecessary observer recreations
  const observerOptions = useMemo(
    () => ({
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? "0px",
      threshold: options.threshold ?? 0,
    }),
    [options.root, options.rootMargin, options.threshold],
  );

  useEffect((): (() => void) | void => {
    // If IntersectionObserver isn't supported, treat the element as visible
    // and skip setting up an observer.
    if (!isSupported) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(([entry]): void => {
      setIsVisible(entry?.isIntersecting ?? false);
    }, observerOptions);

    observer.observe(element);

    return (): void => {
      observer.disconnect();
    };
  }, [ref, observerOptions, isSupported]);

  return isVisible;
}
