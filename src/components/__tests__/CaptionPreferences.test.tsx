/**
 * Caption Preferences Component Tests
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { CaptionPreferences } from "../CaptionPreferences";
import type { CaptionDecoderConfig } from "../../decoders/CEA708Decoder";

describe("CaptionPreferences", () => {
  const defaultConfig: CaptionDecoderConfig = {
    fontSize: 20,
    textColor: "#ffffff",
    backgroundColor: "#000000",
    edgeStyle: "drop_shadow",
    windowOpacity: 0.8,
  };

  const mockOnConfigChange = jest.fn();
  const mockOnServiceChange = jest.fn();

  beforeEach(() => {
    mockOnConfigChange.mockClear();
    mockOnServiceChange.mockClear();
  });

  it("should render caption settings toggle", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[1, 2]}
        currentService={1}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    expect(screen.getByText("Caption Settings")).toBeInTheDocument();
  });

  it("should expand and collapse settings panel", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[1, 2]}
        currentService={1}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Caption Settings/i });

    // Initially collapsed
    expect(screen.queryByLabelText(/Font Size/i)).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggle);
    expect(screen.getByLabelText(/Font Size/i)).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggle);
    expect(screen.queryByLabelText(/Font Size/i)).not.toBeInTheDocument();
  });

  it("should display service selection when services available", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[1, 2, 3]}
        currentService={1}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Check service selector exists
    expect(screen.getByLabelText(/Caption Service/i)).toBeInTheDocument();
    expect(screen.getByText("Service 1 (Primary)")).toBeInTheDocument();
    expect(screen.getByText("Service 2 (Secondary)")).toBeInTheDocument();
    expect(screen.getByText("Service 3")).toBeInTheDocument();
  });

  it("should hide service selection when no services available", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Service selector should not exist
    expect(screen.queryByLabelText(/Caption Service/i)).not.toBeInTheDocument();
  });

  it("should call onServiceChange when service is selected", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[1, 2]}
        currentService={1}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Select service 2
    const select = screen.getByLabelText(/Caption Service/i);
    fireEvent.change(select, { target: { value: "2" } });

    expect(mockOnServiceChange).toHaveBeenCalledWith(2);
  });

  it("should update font size", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Change font size
    const slider = screen.getByLabelText(/Font Size/i);
    fireEvent.change(slider, { target: { value: "24" } });

    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ...defaultConfig,
      fontSize: 24,
    });
  });

  it("should update text color", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Change text color with color picker
    const colorInput = screen.getByLabelText(/Text Color/i);
    fireEvent.change(colorInput, { target: { value: "#ff0000" } });

    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ...defaultConfig,
      textColor: "#ff0000",
    });
  });

  it("should set preset text colors", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Click yellow preset
    const yellowButton = screen.getByTitle("Yellow");
    fireEvent.click(yellowButton);

    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ...defaultConfig,
      textColor: "#ffff00",
    });
  });

  it("should update background color", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Change background color
    const colorInput = screen.getByLabelText(/Background Color/i);
    fireEvent.change(colorInput, { target: { value: "#0000ff" } });

    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ...defaultConfig,
      backgroundColor: "#0000ff",
    });
  });

  it("should update edge style", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Change edge style
    const select = screen.getByLabelText(/Text Edge/i);
    fireEvent.change(select, { target: { value: "raised" } });

    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ...defaultConfig,
      edgeStyle: "raised",
    });
  });

  it("should update opacity", () => {
    render(
      <CaptionPreferences
        config={defaultConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Change opacity
    const slider = screen.getByLabelText(/Background Opacity/i);
    fireEvent.change(slider, { target: { value: "0.5" } });

    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ...defaultConfig,
      windowOpacity: 0.5,
    });
  });

  it("should display current values", () => {
    const customConfig: CaptionDecoderConfig = {
      fontSize: 28,
      textColor: "#ffff00",
      backgroundColor: "#000080",
      edgeStyle: "uniform",
      windowOpacity: 0.6,
    };

    render(
      <CaptionPreferences
        config={customConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Check displayed values
    expect(screen.getByText(/Font Size: 28px/i)).toBeInTheDocument();
    expect(screen.getByText(/Background Opacity: 60%/i)).toBeInTheDocument();
  });

  it("should handle missing config values with defaults", () => {
    const partialConfig: CaptionDecoderConfig = {};

    render(
      <CaptionPreferences
        config={partialConfig}
        availableServices={[]}
        currentService={null}
        onConfigChange={mockOnConfigChange}
        onServiceChange={mockOnServiceChange}
      />,
    );

    // Expand panel
    fireEvent.click(screen.getByRole("button", { name: /Caption Settings/i }));

    // Check default values are used
    expect(screen.getByText(/Font Size: 20px/i)).toBeInTheDocument();
    expect(screen.getByText(/Background Opacity: 80%/i)).toBeInTheDocument();
  });
});
