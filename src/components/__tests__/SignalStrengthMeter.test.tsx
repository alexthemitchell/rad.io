import { render, screen } from "@testing-library/react";
import SignalStrengthMeter from "../SignalStrengthMeter";
import { calculateSignalStrength } from "../../utils/dsp";
import type { Sample } from "../../utils/dsp";

describe("SignalStrengthMeter", () => {
  const createSamples = (count: number, amplitude = 0.5): Sample[] => {
    return Array.from({ length: count }, (_, i) => ({
      I: Math.cos((2 * Math.PI * i) / count) * amplitude,
      Q: Math.sin((2 * Math.PI * i) / count) * amplitude,
    }));
  };

  it("should render signal strength meter", () => {
    const samples = createSamples(100);
    render(<SignalStrengthMeter samples={samples} />);

    expect(screen.getByText("Signal Strength")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should display signal strength in dBm", () => {
    const samples = createSamples(100, 0.5);
    render(<SignalStrengthMeter samples={samples} />);

    const valueElement = screen.getByText(/dBm$/);
    expect(valueElement).toBeInTheDocument();
  });

  it("should show 'Very Weak' for very low signal", () => {
    // Use empty samples for very weak signal (-100 dBm)
    render(<SignalStrengthMeter samples={[]} />);

    expect(screen.getByText("Very Weak")).toBeInTheDocument();
  });

  it("should show 'Weak' for weak signal", () => {
    // For weak signal, use very small amplitude (~-80 dBm)
    const samples = createSamples(100, 0.0001);
    render(<SignalStrengthMeter samples={samples} />);

    expect(screen.getByText(/Weak/)).toBeInTheDocument();
  });

  it("should show 'Good' or 'Excellent' for strong signal", () => {
    const samples = createSamples(100, 0.8);
    render(<SignalStrengthMeter samples={samples} />);

    expect(screen.getByText(/Good|Excellent/)).toBeInTheDocument();
  });

  it("should handle empty samples array", () => {
    render(<SignalStrengthMeter samples={[]} />);

    expect(screen.getByText("Signal Strength")).toBeInTheDocument();
    expect(screen.getByText("Very Weak")).toBeInTheDocument();
  });

  it("should update when samples change", () => {
    // Start with no signal
    const { rerender } = render(<SignalStrengthMeter samples={[]} />);

    expect(screen.getByText("Very Weak")).toBeInTheDocument();

    const strongSamples = createSamples(100, 0.8);
    rerender(<SignalStrengthMeter samples={strongSamples} />);

    expect(screen.getByText(/Good|Excellent/)).toBeInTheDocument();
  });

  it("should have appropriate ARIA attributes", () => {
    const samples = createSamples(100);
    render(<SignalStrengthMeter samples={samples} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });

  it("should apply correct CSS class based on signal strength", () => {
    const samples = createSamples(100, 0.8);
    const { container } = render(<SignalStrengthMeter samples={samples} />);

    const bar = container.querySelector(".signal-strength-bar");
    expect(bar).toHaveClass(/excellent|good/);
  });

  it("should have live region for signal value", () => {
    const samples = createSamples(100);
    render(<SignalStrengthMeter samples={samples} />);

    const liveRegion = screen.getByText(/dBm$/);
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });
});

describe("calculateSignalStrength", () => {
  it("should return -100 dBm for empty samples", () => {
    const strength = calculateSignalStrength([]);
    expect(strength).toBe(-100);
  });

  it("should return negative dBm value for valid samples", () => {
    const samples: Sample[] = [
      { I: 0.5, Q: 0.5 },
      { I: 0.3, Q: 0.4 },
      { I: 0.6, Q: 0.2 },
    ];
    const strength = calculateSignalStrength(samples);
    expect(strength).toBeLessThanOrEqual(0);
    expect(strength).toBeGreaterThanOrEqual(-100);
  });

  it("should calculate higher strength for larger amplitude samples", () => {
    const weakSamples: Sample[] = [
      { I: 0.1, Q: 0.1 },
      { I: 0.1, Q: 0.1 },
    ];
    const strongSamples: Sample[] = [
      { I: 0.8, Q: 0.8 },
      { I: 0.8, Q: 0.8 },
    ];

    const weakStrength = calculateSignalStrength(weakSamples);
    const strongStrength = calculateSignalStrength(strongSamples);

    expect(strongStrength).toBeGreaterThan(weakStrength);
  });

  it("should handle zero amplitude samples", () => {
    const samples: Sample[] = [
      { I: 0, Q: 0 },
      { I: 0, Q: 0 },
    ];
    const strength = calculateSignalStrength(samples);
    expect(strength).toBe(-100);
  });

  it("should clamp values to -100 to 0 dBm range", () => {
    // Very strong signal
    const strongSamples: Sample[] = Array.from({ length: 100 }, () => ({
      I: 2.0,
      Q: 2.0,
    }));
    const strength = calculateSignalStrength(strongSamples);
    expect(strength).toBeLessThanOrEqual(0);
    expect(strength).toBeGreaterThanOrEqual(-100);
  });

  it("should calculate RMS power correctly", () => {
    // Known samples with expected RMS
    const samples: Sample[] = [
      { I: 1.0, Q: 0.0 }, // magnitude = 1.0
      { I: 0.0, Q: 1.0 }, // magnitude = 1.0
    ];
    // RMS = sqrt((1^2 + 1^2) / 2) = sqrt(1) = 1.0
    // dBm = 20 * log10(1.0) = 0
    const strength = calculateSignalStrength(samples);
    expect(strength).toBeCloseTo(0, 1);
  });

  it("should handle negative I/Q values", () => {
    const samples: Sample[] = [
      { I: -0.5, Q: -0.5 },
      { I: 0.5, Q: 0.5 },
    ];
    const strength = calculateSignalStrength(samples);
    expect(strength).toBeLessThanOrEqual(0);
    expect(strength).toBeGreaterThanOrEqual(-100);
  });

  it("should be consistent with multiple calculations", () => {
    const samples: Sample[] = [
      { I: 0.5, Q: 0.5 },
      { I: 0.3, Q: 0.4 },
    ];
    const strength1 = calculateSignalStrength(samples);
    const strength2 = calculateSignalStrength(samples);
    expect(strength1).toBe(strength2);
  });
});
