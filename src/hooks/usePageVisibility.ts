import { useEffect, useState } from "react";

/**
 * Hook to detect page visibility state using the Page Visibility API.
 * Returns true when the page is visible (tab is active), false when hidden.
 *
 * @returns {boolean} Whether the page is currently visible
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(
    () => document.visibilityState === "visible",
  );

  useEffect((): (() => void) => {
    const handleVisibilityChange = (): void => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return (): void => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
