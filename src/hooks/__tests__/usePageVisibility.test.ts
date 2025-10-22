import { renderHook, act } from "@testing-library/react";
import { usePageVisibility } from "../usePageVisibility";

describe("usePageVisibility", () => {
  afterEach(() => {
    // Clean up any event listeners
    const events = ["visibilitychange"];
    events.forEach((event) => {
      const listeners = (
        document as unknown as { _listeners?: Record<string, EventListener[]> }
      )._listeners?.[event];
      if (listeners) {
        listeners.forEach((listener: EventListener) => {
          document.removeEventListener(event, listener);
        });
      }
    });
  });

  it("should return true when page is visible", () => {
    // Mock document.visibilityState
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "visible",
    });

    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);
  });

  it("should return false when page is hidden", () => {
    // Mock document.visibilityState
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "hidden",
    });

    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(false);
  });

  it("should update when visibility changes", () => {
    // Start with visible
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "visible",
    });

    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);

    // Change to hidden
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(false);

    // Change back to visible
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(true);
  });

  it("should clean up event listener on unmount", () => {
    const removeEventListenerSpy = jest.spyOn(
      document,
      "removeEventListener",
    );

    const { unmount } = renderHook(() => usePageVisibility());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
