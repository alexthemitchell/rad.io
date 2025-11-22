/**
 * AddVfoModal Component Tests
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AddVfoModal } from "../AddVfoModal";

describe("AddVfoModal", () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <AddVfoModal
        isOpen={false}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render when isOpen is true", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add VFO" }),
    ).toBeInTheDocument();
  });

  it("should display frequency in MHz", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_500_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("100.5 MHz")).toBeInTheDocument();
  });

  it("should have AM mode selected by default", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    const select = screen.getByLabelText(
      "Demodulation Mode",
    ) as HTMLSelectElement;
    expect(select.value).toBe("am");
  });

  it("should allow mode selection", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    const select = screen.getByLabelText("Demodulation Mode");
    fireEvent.change(select, { target: { value: "wbfm" } });

    expect((select as HTMLSelectElement).value).toBe("wbfm");
  });

  it("should call onConfirm with selected mode when Add VFO button is clicked", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    const select = screen.getByLabelText("Demodulation Mode");
    fireEvent.change(select, { target: { value: "nbfm" } });

    const addButton = screen.getByRole("button", { name: /add vfo/i });
    fireEvent.click(addButton);

    expect(mockOnConfirm).toHaveBeenCalledWith("nbfm");
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onCancel when Cancel button is clicked", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it("should call onCancel when Escape key is pressed", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should be accessible with proper ARIA attributes", () => {
    render(
      <AddVfoModal
        isOpen={true}
        frequencyHz={100_000_000}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "add-vfo-modal-title");
  });
});
