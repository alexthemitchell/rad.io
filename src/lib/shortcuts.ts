/**
 * Shortcuts Overlay Event System
 *
 * Provides a centralized event-based API for showing/hiding the shortcuts overlay.
 * Similar to the notification system pattern.
 */

const target = new EventTarget();

/**
 * Show the shortcuts overlay
 */
export function showShortcuts(): void {
  const evt = new CustomEvent("show-shortcuts");
  target.dispatchEvent(evt);
}

/**
 * Hide the shortcuts overlay
 */
export function hideShortcuts(): void {
  const evt = new CustomEvent("hide-shortcuts");
  target.dispatchEvent(evt);
}

/**
 * Toggle the shortcuts overlay
 */
export function toggleShortcuts(): void {
  const evt = new CustomEvent("toggle-shortcuts");
  target.dispatchEvent(evt);
}

/**
 * Subscribe to show-shortcuts events
 */
export function onShowShortcuts(handler: () => void): () => void {
  const listener = (): void => handler();
  target.addEventListener("show-shortcuts", listener as EventListener);
  return () =>
    target.removeEventListener("show-shortcuts", listener as EventListener);
}

/**
 * Subscribe to hide-shortcuts events
 */
export function onHideShortcuts(handler: () => void): () => void {
  const listener = (): void => handler();
  target.addEventListener("hide-shortcuts", listener as EventListener);
  return () =>
    target.removeEventListener("hide-shortcuts", listener as EventListener);
}

/**
 * Subscribe to toggle-shortcuts events
 */
export function onToggleShortcuts(handler: () => void): () => void {
  const listener = (): void => handler();
  target.addEventListener("toggle-shortcuts", listener as EventListener);
  return () =>
    target.removeEventListener("toggle-shortcuts", listener as EventListener);
}
