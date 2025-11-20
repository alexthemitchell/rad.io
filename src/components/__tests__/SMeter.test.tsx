import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import SMeter from "../SMeter";
import type { SignalLevel } from "../../lib/measurement/types";

describe("SMeter", () => {
  const createSignalLevel = (
    sUnit: number,
    overS9: number,
    band: "HF" | "VHF" = "VHF",
  ): SignalLevel => ({
    dBfs: -30,
    dBmApprox: -100,
    sUnit,
    overS9,
    band,
    calibrationStatus: "uncalibrated",
    uncertaintyDb: 10,
    timestamp: Date.now(),
  });

  describe("Rendering", () => {
    it("should render S-Meter component", () => {
      const signalLevel = createSignalLevel(5, 0);
      render(<SMeter signalLevel={signalLevel} />);

      expect(
        screen.getByRole("region", { name: /S-Meter signal strength/i }),
      ).toBeInTheDocument();
    });

    it("should display S-unit value", () => {
      const signalLevel = createSignalLevel(7, 0);
      render(<SMeter signalLevel={signalLevel} />);

      // Look for all S7 elements and check the first is the primary value
      const s7Elements = screen.getAllByText("S7");
      expect(s7Elements[0]).toHaveClass("s-meter-value-primary");
    });

    it("should display S9 correctly", () => {
      const signalLevel = createSignalLevel(9, 0);
      render(<SMeter signalLevel={signalLevel} />);

      // Look for the value display, not the scale marker
      const valueDisplay = screen.getByLabelText(/Signal strength: S9/);
      expect(valueDisplay).toBeInTheDocument();
    });

    it("should display S9+ format for strong signals", () => {
      const signalLevel = createSignalLevel(9, 20);
      render(<SMeter signalLevel={signalLevel} />);

      // Look for the specific S9+20 text in the primary value
      const primaryValue = screen.getByText("S9+20");
      expect(primaryValue).toHaveClass("s-meter-value-primary");
    });

    it("should display dBm when showDbm is true", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.dBmApprox = -105.5;
      render(<SMeter signalLevel={signalLevel} showDbm />);

      expect(screen.getByText("-106 dBm")).toBeInTheDocument();
    });

    it("should hide dBm when showDbm is false", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.dBmApprox = -105.5;
      render(<SMeter signalLevel={signalLevel} showDbm={false} />);

      expect(screen.queryByText(/-\d+ dBm/)).not.toBeInTheDocument();
    });

    it("should display dBFS when showDbfs is true", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.dBfs = -42.3;
      render(<SMeter signalLevel={signalLevel} showDbfs />);

      expect(screen.getByText("-42.3 dBFS")).toBeInTheDocument();
    });

    it("should display band indicator", () => {
      const signalLevel = createSignalLevel(5, 0, "HF");
      render(<SMeter signalLevel={signalLevel} />);

      expect(screen.getByText("HF")).toBeInTheDocument();
    });

    it("should display VHF band indicator", () => {
      const signalLevel = createSignalLevel(5, 0, "VHF");
      render(<SMeter signalLevel={signalLevel} />);

      expect(screen.getByText("VHF")).toBeInTheDocument();
    });

    it("should render bar style by default", () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      expect(container.querySelector(".s-meter-bar-container")).toBeInTheDocument();
      expect(container.querySelector(".s-meter-segments")).not.toBeInTheDocument();
    });

    it("should render segment style when specified", () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(
        <SMeter signalLevel={signalLevel} style="segments" />,
      );

      expect(container.querySelector(".s-meter-segments")).toBeInTheDocument();
      expect(container.querySelector(".s-meter-bar-container")).not.toBeInTheDocument();
    });

    it("should render 15 segments in segment mode", () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(
        <SMeter signalLevel={signalLevel} style="segments" />,
      );

      const segments = container.querySelectorAll(".s-meter-segment");
      expect(segments).toHaveLength(15);
    });

    it("should handle null signal level gracefully", () => {
      render(<SMeter signalLevel={null} />);

      expect(screen.getByText("S0")).toBeInTheDocument();
    });
  });

  describe("Signal Strength Indicators", () => {
    it("should show weak signal color for S0-S3", () => {
      const signalLevel = createSignalLevel(2, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} smoothing={1} />);

      const bar = container.querySelector(".s-meter-bar");
      expect(bar).toHaveClass("s-meter-bar-weak");
    });

    it("should show fair signal color for S4-S6", () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} smoothing={1} />);

      const bar = container.querySelector(".s-meter-bar");
      expect(bar).toHaveClass("s-meter-bar-fair");
    });

    it("should show good signal color for S7-S8", () => {
      const signalLevel = createSignalLevel(8, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} smoothing={1} />);

      const bar = container.querySelector(".s-meter-bar");
      expect(bar).toHaveClass("s-meter-bar-good");
    });

    it("should show moderate color for S9+1 to S9+19", () => {
      const signalLevel = createSignalLevel(9, 15);
      const { container } = render(<SMeter signalLevel={signalLevel} smoothing={1} />);

      const bar = container.querySelector(".s-meter-bar");
      expect(bar).toHaveClass("s-meter-bar-moderate");
    });

    it("should show strong color for S9+20 to S9+39", () => {
      const signalLevel = createSignalLevel(9, 30);
      const { container } = render(<SMeter signalLevel={signalLevel} smoothing={1} />);

      const bar = container.querySelector(".s-meter-bar");
      expect(bar).toHaveClass("s-meter-bar-strong");
    });

    it("should show very strong color for S9+40 and above", () => {
      const signalLevel = createSignalLevel(9, 50);
      const { container } = render(<SMeter signalLevel={signalLevel} smoothing={1} />);

      const bar = container.querySelector(".s-meter-bar");
      expect(bar).toHaveClass("s-meter-bar-very-strong");
    });
  });

  describe("Calibration Status", () => {
    it("should show user calibration indicator", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.calibrationStatus = "user";
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      expect(container.querySelector(".s-meter-calibration")).toBeInTheDocument();
      expect(screen.getByText("📏")).toBeInTheDocument();
    });

    it("should show factory calibration indicator", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.calibrationStatus = "factory";
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      expect(container.querySelector(".s-meter-calibration")).toBeInTheDocument();
      expect(screen.getByText("🏭")).toBeInTheDocument();
    });

    it("should hide calibration indicator for uncalibrated", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.calibrationStatus = "uncalibrated";
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      expect(container.querySelector(".s-meter-calibration")).not.toBeInTheDocument();
    });

    it("should include uncertainty in calibration tooltip", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.calibrationStatus = "user";
      signalLevel.uncertaintyDb = 1.5;
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const calibrationIcon = container.querySelector(".s-meter-calibration");
      expect(calibrationIcon).toHaveAttribute(
        "title",
        expect.stringContaining("±1.5dB"),
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes for meter role", () => {
      const signalLevel = createSignalLevel(5, 0);
      render(<SMeter signalLevel={signalLevel} />);

      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow");
      expect(meter).toHaveAttribute("aria-valuemin", "0");
      expect(meter).toHaveAttribute("aria-valuemax", "100");
      expect(meter).toHaveAttribute("aria-label", expect.stringContaining("S5"));
    });

    it("should have ARIA live region for announcements", () => {
      const signalLevel = createSignalLevel(7, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it("should rate-limit ARIA announcements", () => {
      jest.useFakeTimers();
      const { rerender, container } = render(
        <SMeter signalLevel={createSignalLevel(5, 0)} />,
      );

      const liveRegion = container.querySelector('.visually-hidden[aria-live="polite"]');
      const initialAnnouncement = liveRegion?.textContent;

      // Update signal immediately (should not announce due to throttle)
      rerender(<SMeter signalLevel={createSignalLevel(6, 0)} />);

      // Announcement should still be the initial one (throttled)
      expect(liveRegion?.textContent).toBe(initialAnnouncement);

      // Advance time past throttle period
      jest.advanceTimersByTime(2100);

      // Now update should trigger announcement
      rerender(<SMeter signalLevel={createSignalLevel(7, 0)} />);

      // Announcement should have changed
      expect(liveRegion?.textContent).toContain("S7");
      expect(liveRegion?.textContent).not.toBe(initialAnnouncement);

      jest.useRealTimers();
    });

    it("should announce S-unit changes in live region", async () => {
      jest.useFakeTimers();
      const { rerender, container } = render(
        <SMeter signalLevel={createSignalLevel(5, 0)} />,
      );

      // Get the hidden live region (not the visible aria-live on value)
      const liveRegion = container.querySelector('.visually-hidden[aria-live="polite"]');
      expect(liveRegion?.textContent).toContain("S5");

      // Advance time past throttle period (2000ms)
      jest.advanceTimersByTime(2100);

      // Update signal
      rerender(<SMeter signalLevel={createSignalLevel(9, 20)} showDbm />);

      // Check new announcement
      expect(liveRegion?.textContent).toContain("S9 plus 20 dB");

      jest.useRealTimers();
    });

    it("should include dBm in announcements when showDbm is true", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.dBmApprox = -105;
      const { container } = render(<SMeter signalLevel={signalLevel} showDbm />);

      // Get the hidden live region
      const liveRegion = container.querySelector('.visually-hidden[aria-live="polite"]');
      expect(liveRegion?.textContent).toContain("-105 dBm");
    });

    it("should pass axe accessibility checks", async () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have visually hidden class for screen reader only content", () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const hiddenElement = container.querySelector(".visually-hidden");
      expect(hiddenElement).toBeInTheDocument();
    });
  });

  describe("Visual Updates", () => {
    it("should update bar width based on signal strength", () => {
      const { container, rerender } = render(
        <SMeter signalLevel={createSignalLevel(3, 0)} smoothing={1} />,
      );

      const bar = container.querySelector(".s-meter-bar") as HTMLElement;
      const initialWidth = bar.style.width;

      // Increase signal strength
      rerender(<SMeter signalLevel={createSignalLevel(7, 0)} smoothing={1} />);

      const updatedWidth = bar.style.width;
      expect(updatedWidth).not.toBe(initialWidth);
      expect(parseFloat(updatedWidth)).toBeGreaterThan(parseFloat(initialWidth));
    });

    it("should apply smoothing to visual updates", () => {
      const { container, rerender } = render(
        <SMeter signalLevel={createSignalLevel(3, 0)} smoothing={0.1} />,
      );

      const bar = container.querySelector(".s-meter-bar") as HTMLElement;
      const initialWidth = parseFloat(bar.style.width);

      // Sudden signal change
      rerender(<SMeter signalLevel={createSignalLevel(9, 0)} smoothing={0.1} />);

      const smoothedWidth = parseFloat(bar.style.width);

      // With low smoothing (0.1), the change should be gradual
      // It won't jump to full 90% immediately
      expect(smoothedWidth).toBeGreaterThan(initialWidth);
      expect(smoothedWidth).toBeLessThan(90); // Full S9 would be ~90%
    });

    it("should handle rapid signal changes", () => {
      const { rerender } = render(
        <SMeter signalLevel={createSignalLevel(5, 0)} />,
      );

      // Rapidly change signal
      for (let i = 0; i < 10; i++) {
        rerender(<SMeter signalLevel={createSignalLevel(i % 9, 0)} />);
      }

      // Should not crash
      expect(screen.getByRole("region")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle S0 (no signal)", () => {
      const signalLevel = createSignalLevel(0, 0);
      render(<SMeter signalLevel={signalLevel} />);

      expect(screen.getByText("S0")).toBeInTheDocument();
    });

    it("should handle very strong signals (S9+60)", () => {
      const signalLevel = createSignalLevel(9, 60);
      render(<SMeter signalLevel={signalLevel} />);

      expect(screen.getByText("S9+60")).toBeInTheDocument();
    });

    it("should clamp bar width to 100%", () => {
      const signalLevel = createSignalLevel(9, 100); // Unrealistically strong
      const { container } = render(
        <SMeter signalLevel={signalLevel} smoothing={1} />,
      );

      const bar = container.querySelector(".s-meter-bar") as HTMLElement;
      const width = parseFloat(bar.style.width);

      expect(width).toBeLessThanOrEqual(100);
    });

    it("should handle missing uncertaintyDb", () => {
      const signalLevel = createSignalLevel(5, 0);
      signalLevel.uncertaintyDb = undefined;
      signalLevel.calibrationStatus = "user";
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const calibrationIcon = container.querySelector(".s-meter-calibration");
      expect(calibrationIcon).toHaveAttribute(
        "title",
        expect.stringContaining("±?dB"),
      );
    });
  });

  describe("Scale Markers", () => {
    it("should display scale markers", () => {
      const signalLevel = createSignalLevel(3, 0); // Use S3 to avoid conflict with S5 in scale
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const scale = container.querySelector(".s-meter-scale");
      expect(scale).toBeInTheDocument();
      expect(scale?.textContent).toContain("S1");
      expect(scale?.textContent).toContain("S3");
      expect(scale?.textContent).toContain("S5");
      expect(scale?.textContent).toContain("S7");
      expect(scale?.textContent).toContain("S9");
      expect(scale?.textContent).toContain("+20");
      expect(scale?.textContent).toContain("+40");
      expect(scale?.textContent).toContain("+60");
    });

    it("should mark scale as aria-hidden", () => {
      const signalLevel = createSignalLevel(5, 0);
      const { container } = render(<SMeter signalLevel={signalLevel} />);

      const scale = container.querySelector(".s-meter-scale");
      expect(scale).toHaveAttribute("aria-hidden", "true");
    });
  });
});
