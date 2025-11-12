// React import not required due to JSX automatic runtime
import { render, screen } from "@testing-library/react";
import { SignalTooltip } from "../SignalTooltip";

describe("SignalTooltip", () => {
  it("shows RDS Program Service and Radio Text when available", () => {
    const signal: any = {
      frequency: 100000000,
      isActive: true,
      lastSeen: Date.now(),
      type: "wideband-fm",
      bandwidth: 150000,
      power: -10,
      snr: 20,
      confidence: 0.9,
      rdsData: { ps: "RADIO-PS", rt: "Now playing: Test song" },
    };

    render(<SignalTooltip signal={signal} x={10} y={10} visible={true} />);

    expect(screen.getByText(/RDS:/i)).toBeInTheDocument();
    expect(screen.getByText(/Radio Text:/i)).toBeInTheDocument();
    expect(screen.getByText(/RADIO-PS/i)).toBeInTheDocument();
    expect(screen.getByText(/Now playing: Test song/i)).toBeInTheDocument();
  });
});
