import { render, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import ToastProvider from "../../components/ToastProvider";
import { notify } from "../../lib/notifications";

describe("ToastProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders a visual-only toast and hides it from SR when sr is provided", async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );

    act(() => {
      notify({
        message: "Saved",
        tone: "success",
        sr: "polite",
        visual: true,
        duration: 4000,
      });
    });

    const toast = await screen.findByTestId("toast");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveAttribute("aria-hidden", "true");
    // inert is a boolean attribute; jsdom exposes it as attribute presence
    expect(toast).toHaveAttribute("inert");
  });

  it("exposes toast to SR when sr is false and sets role=status", async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );

    act(() => {
      notify({
        message: "Connected",
        tone: "info",
        sr: false,
        visual: true,
        duration: 4000,
      });
    });

    const toast = await screen.findByTestId("toast");
    expect(toast).toBeInTheDocument();
    expect(toast).not.toHaveAttribute("aria-hidden");
    expect(toast).toHaveAttribute("role", "status");
  });

  it("auto-dismisses after duration", async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );

    act(() => {
      notify({
        message: "Copied",
        tone: "success",
        sr: "polite",
        visual: true,
        duration: 1000,
      });
    });

    const toast = await screen.findByTestId("toast");
    expect(toast).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // The toast should be removed from the DOM
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});
