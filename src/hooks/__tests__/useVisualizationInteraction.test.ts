import { renderHook, act } from "@testing-library/react";
import { useVisualizationInteraction } from "../useVisualizationInteraction";

describe("useVisualizationInteraction", () => {
  it("should initialize with default transform", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    expect(result.current.transform).toEqual({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });
  });

  it("should initialize with default settings", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    expect(result.current.settings).toMatchObject({
      panSensitivity: 1.0,
      zoomSensitivity: 1.0,
      minZoom: 0.5,
      maxZoom: 10.0,
      enablePan: true,
      enableZoom: true,
      enableMultiTouch: true,
      enableKeyboard: true,
    });
  });

  it("should allow custom settings", () => {
    const { result } = renderHook(() =>
      useVisualizationInteraction({
        panSensitivity: 2.0,
        zoomSensitivity: 0.5,
        enableMultiTouch: false,
      }),
    );

    expect(result.current.settings.panSensitivity).toBe(2.0);
    expect(result.current.settings.zoomSensitivity).toBe(0.5);
    expect(result.current.settings.enableMultiTouch).toBe(false);
  });

  it("should reset transform", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    // Manually set transform to non-default values
    act(() => {
      // Since we can't directly manipulate internal state in the test,
      // we'll use keyboard events to change transform, then reset
      const mockEvent = {
        key: "ArrowRight",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    act(() => {
      result.current.resetTransform();
    });

    expect(result.current.transform).toEqual({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });
  });

  it("should provide all required handlers", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    expect(result.current.handlers).toHaveProperty("onPointerDown");
    expect(result.current.handlers).toHaveProperty("onPointerMove");
    expect(result.current.handlers).toHaveProperty("onPointerUp");
    expect(result.current.handlers).toHaveProperty("onPointerCancel");
    expect(result.current.handlers).toHaveProperty("onKeyDown");
    expect(result.current).toHaveProperty("canvasRef");
    expect(typeof result.current.canvasRef).toBe("function");
  });

  it("should handle keyboard navigation - arrow keys", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    act(() => {
      const mockEvent = {
        key: "ArrowRight",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    expect(result.current.transform.offsetX).toBeGreaterThan(0);
  });

  it("should handle keyboard zoom in", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    act(() => {
      const mockEvent = {
        key: "+",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    expect(result.current.transform.scale).toBeGreaterThan(1);
  });

  it("should handle keyboard zoom out", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    act(() => {
      const mockEvent = {
        key: "-",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    expect(result.current.transform.scale).toBeLessThan(1);
  });

  it("should handle keyboard reset with '0' key", () => {
    const { result } = renderHook(() => useVisualizationInteraction());

    // First zoom in
    act(() => {
      const mockEvent = {
        key: "+",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    // Then reset
    act(() => {
      const mockEvent = {
        key: "0",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    expect(result.current.transform).toEqual({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });
  });

  it("should respect zoom limits", () => {
    const { result } = renderHook(() =>
      useVisualizationInteraction({
        minZoom: 0.5,
        maxZoom: 2.0,
      }),
    );

    // Try to zoom in beyond max
    act(() => {
      for (let i = 0; i < 20; i++) {
        const mockEvent = {
          key: "+",
          preventDefault: jest.fn(),
        } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

        result.current.handlers.onKeyDown(mockEvent);
      }
    });

    expect(result.current.transform.scale).toBeLessThanOrEqual(2.0);

    // Reset
    act(() => {
      result.current.resetTransform();
    });

    // Try to zoom out beyond min
    act(() => {
      for (let i = 0; i < 20; i++) {
        const mockEvent = {
          key: "-",
          preventDefault: jest.fn(),
        } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

        result.current.handlers.onKeyDown(mockEvent);
      }
    });

    expect(result.current.transform.scale).toBeGreaterThanOrEqual(0.5);
  });

  it("should not respond to keyboard when disabled", () => {
    const { result } = renderHook(() =>
      useVisualizationInteraction({
        enableKeyboard: false,
      }),
    );

    const initialTransform = { ...result.current.transform };

    act(() => {
      const mockEvent = {
        key: "ArrowRight",
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLCanvasElement>;

      result.current.handlers.onKeyDown(mockEvent);
    });

    expect(result.current.transform).toEqual(initialTransform);
  });
});
