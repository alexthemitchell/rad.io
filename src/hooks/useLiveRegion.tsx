import React, { useState } from "react";

/**
 * Hook for managing live region announcements for screen readers
 * Provides a state setter for announcing messages and a component to render the live region
 *
 * @returns {Object} - Contains announce function and LiveRegion component
 *
 * @example
 * const { announce, LiveRegion } = useLiveRegion();
 *
 * // Announce a message
 * announce("Device connected successfully");
 *
 * // Render the live region (typically at the top of your component)
 * return (
 *   <div>
 *     <LiveRegion />
 *     {/* rest of your component *\/}
 *   </div>
 * );
 */
export function useLiveRegion(): {
  announce: (text: string) => void;
  liveRegion: () => React.JSX.Element;
} {
  const [message, setMessage] = useState("");

  /**
   * Announce a message to screen readers
   * @param text - The message to announce
   */
  const announce = (text: string): void => {
    setMessage(text);
  };

  /**
   * Component that renders the live region for screen reader announcements
   * Should be included once in your component tree
   */
  const liveRegion = (): React.JSX.Element => (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="visually-hidden"
    >
      {message}
    </div>
  );

  return { announce, liveRegion };
}
