/**
 * Tests for P25SystemPresets component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import P25SystemPresets from "../P25SystemPresets";

describe("P25SystemPresets", () => {
  const mockOnSystemSelect = jest.fn();
  const defaultControlChannel = 770.95625e6; // First system's frequency

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the presets label", () => {
    render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );
    expect(screen.getByText("Preset P25 Systems")).toBeInTheDocument();
  });

  it("renders all 4 preset P25 systems", () => {
    render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    expect(
      screen.getByText("Example County Public Safety"),
    ).toBeInTheDocument();
    expect(screen.getByText("Example City Police")).toBeInTheDocument();
    expect(
      screen.getByText("Example State Highway Patrol"),
    ).toBeInTheDocument();
    expect(screen.getByText("Example Regional Fire")).toBeInTheDocument();
  });

  it("displays frequency bands for each system", () => {
    render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    // Check frequency bands are displayed
    const bandLabels = screen.getAllByText("700 MHz");
    expect(bandLabels).toHaveLength(2); // Two 700 MHz systems
    expect(screen.getByText("800 MHz")).toBeInTheDocument();
    expect(screen.getByText("VHF")).toBeInTheDocument();
  });

  it("calls onSystemSelect when a preset is clicked", () => {
    render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const firstButton = screen.getByText("Example County Public Safety");
    fireEvent.click(firstButton);

    expect(mockOnSystemSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSystemSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Example County Public Safety",
        controlChannel: 770.95625e6,
        nac: "$293",
        systemId: "$001",
        wacn: "$BEE00",
        location: "700 MHz",
      }),
    );
  });

  it("marks the current system as active", () => {
    const { container } = render(
      <P25SystemPresets
        currentControlChannel={defaultControlChannel}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const activeButtons = container.querySelectorAll(".active");
    expect(activeButtons).toHaveLength(1);

    const activeButton = screen.getByText(
      "Example County Public Safety",
    ).parentElement;
    expect(activeButton).toHaveClass("active");
  });

  it("sets aria-pressed correctly for active system", () => {
    render(
      <P25SystemPresets
        currentControlChannel={defaultControlChannel}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const activeButton = screen.getByText(
      "Example County Public Safety",
    ).parentElement;
    expect(activeButton).toHaveAttribute("aria-pressed", "true");

    const inactiveButton = screen.getByText(
      "Example City Police",
    ).parentElement;
    expect(inactiveButton).toHaveAttribute("aria-pressed", "false");
  });

  it("displays note about example systems", () => {
    render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    expect(screen.getByText(/These are example systems/)).toBeInTheDocument();
    expect(
      screen.getByText(/Configure your local P25 system details/),
    ).toBeInTheDocument();
  });

  it("has accessible group role with label", () => {
    const { container } = render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const group = container.querySelector('[role="group"]');
    expect(group).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-labelledby", "p25-systems-label");
  });

  it("each button has a descriptive title with system details", () => {
    render(
      <P25SystemPresets
        currentControlChannel={0}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const firstButton = screen.getByText(
      "Example County Public Safety",
    ).parentElement;
    const title = firstButton?.getAttribute("title") || "";

    // Verify title includes key system information
    expect(title).toContain("Example County Public Safety");
    expect(title).toContain("Control Channel:");
    expect(title).toContain("MHz");
    expect(title).toContain("NAC: $293");
    expect(title).toContain("System ID: $001");
    expect(title).toContain("WACN: $BEE00");
  });

  it("highlights active system in title tooltip", () => {
    render(
      <P25SystemPresets
        currentControlChannel={defaultControlChannel}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const activeButton = screen.getByText(
      "Example County Public Safety",
    ).parentElement;
    const title = activeButton?.getAttribute("title") || "";

    expect(title).toContain("(Currently configured)");
  });

  it("does not highlight inactive system in title", () => {
    render(
      <P25SystemPresets
        currentControlChannel={defaultControlChannel}
        onSystemSelect={mockOnSystemSelect}
      />,
    );

    const inactiveButton = screen.getByText(
      "Example City Police",
    ).parentElement;
    const title = inactiveButton?.getAttribute("title") || "";

    expect(title).not.toContain("(Currently configured)");
  });
});
