import { renderHook, act } from "@testing-library/react";
import { useIntersectionObserver } from "../useIntersectionObserver";
import { createRef } from "react";

describe("useIntersectionObserver", () => {
  let mockObserve: jest.Mock;
  let mockDisconnect: jest.Mock;
  let mockCallback: IntersectionObserverCallback;

  beforeEach(() => {
    mockObserve = jest.fn();
    mockDisconnect = jest.fn();

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn((callback) => {
      mockCallback = callback;
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: jest.fn(),
        takeRecords: jest.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
      };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return false initially", () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useIntersectionObserver(ref));
    expect(result.current).toBe(false);
  });

  it("should observe element when ref is set", () => {
    const element = document.createElement("div");
    const ref = { current: element };

    renderHook(() => useIntersectionObserver(ref));

    expect(mockObserve).toHaveBeenCalledWith(element);
  });

  it("should update visibility when intersection changes", () => {
    const element = document.createElement("div");
    const ref = { current: element };

    const { result } = renderHook(() => useIntersectionObserver(ref));

    // Initially false
    expect(result.current).toBe(false);

    // Simulate intersection
    const entry: Partial<IntersectionObserverEntry> = {
      isIntersecting: true,
      target: element,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 1,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    };

    act(() => {
      mockCallback(
        [entry as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(result.current).toBe(true);

    // Simulate leaving viewport
    const exitEntry: Partial<IntersectionObserverEntry> = {
      ...entry,
      isIntersecting: false,
    };

    act(() => {
      mockCallback(
        [exitEntry as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(result.current).toBe(false);
  });

  it("should disconnect observer on unmount", () => {
    const element = document.createElement("div");
    const ref = { current: element };

    const { unmount } = renderHook(() => useIntersectionObserver(ref));

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should pass options to IntersectionObserver", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    const options = {
      root: null,
      rootMargin: "10px",
      threshold: 0.5,
    };

    renderHook(() => useIntersectionObserver(ref, options));

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      options,
    );
  });

  it("should not observe if element is null", () => {
    const ref = { current: null };

    renderHook(() => useIntersectionObserver(ref));

    expect(mockObserve).not.toHaveBeenCalled();
  });
});
