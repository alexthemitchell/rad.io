import { render } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { useLiveRegion } from "../useLiveRegion";

describe("useLiveRegion", () => {
  it("should initialize with empty message", () => {
    const { result } = renderHook(() => useLiveRegion());

    const { container } = render(<result.current.LiveRegion />);

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");
  });

  it("should announce messages to screen readers", () => {
    const { result } = renderHook(() => useLiveRegion());

    act(() => {
      result.current.announce("Test announcement");
    });

    const { container } = render(<result.current.LiveRegion />);

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).toHaveTextContent("Test announcement");
  });

  it("should update message when announce is called multiple times", () => {
    const { result } = renderHook(() => useLiveRegion());

    act(() => {
      result.current.announce("First message");
    });

    let rendered = render(<result.current.LiveRegion />);
    let liveRegion = rendered.container.querySelector('[role="status"]');
    expect(liveRegion).toHaveTextContent("First message");

    act(() => {
      result.current.announce("Second message");
    });

    rendered = render(<result.current.LiveRegion />);
    liveRegion = rendered.container.querySelector('[role="status"]');
    expect(liveRegion).toHaveTextContent("Second message");
  });

  it("should render LiveRegion with proper ARIA attributes", () => {
    const { result } = renderHook(() => useLiveRegion());

    const { container } = render(<result.current.LiveRegion />);

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).toHaveAttribute("role", "status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");
  });

  it("should render LiveRegion with visually-hidden class", () => {
    const { result } = renderHook(() => useLiveRegion());

    const { container } = render(<result.current.LiveRegion />);

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).toHaveClass("visually-hidden");
  });

  it("should return announce function and LiveRegion component", () => {
    const { result } = renderHook(() => useLiveRegion());

    expect(result.current).toHaveProperty("announce");
    expect(result.current).toHaveProperty("LiveRegion");
    expect(typeof result.current.announce).toBe("function");
    expect(typeof result.current.LiveRegion).toBe("function");
  });
});
