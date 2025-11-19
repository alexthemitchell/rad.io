/**
 * Tests for QuickActions component
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import QuickActions from "../QuickActions";

describe("QuickActions", () => {
  const mockOnBookmark = jest.fn();
  const mockOnToggleRecording = jest.fn();
  const mockOnToggleGrid = jest.fn();
  const mockOnShowHelp = jest.fn();

  const defaultProps = {
    currentFrequencyHz: 100_000_000, // 100 MHz
    isRecording: false,
    showGrid: false,
    onBookmark: mockOnBookmark,
    onToggleRecording: mockOnToggleRecording,
    onToggleGrid: mockOnToggleGrid,
    onShowHelp: mockOnShowHelp,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all action buttons", () => {
    render(<QuickActions {...defaultProps} />);

    // Check that toolbar exists
    const toolbar = screen.getByRole("toolbar", {
      name: /quick actions toolbar/i,
    });
    expect(toolbar).toBeInTheDocument();

    // Check that all buttons exist
    expect(
      screen.getByRole("button", { name: /bookmark.*\(b\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /record.*\(r\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /grid.*\(g\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });

  it("calls onBookmark when bookmark button is clicked", () => {
    render(<QuickActions {...defaultProps} />);

    const bookmarkButton = screen.getByRole("button", {
      name: /bookmark.*\(b\)/i,
    });
    fireEvent.click(bookmarkButton);

    expect(mockOnBookmark).toHaveBeenCalledTimes(1);
    expect(mockOnBookmark).toHaveBeenCalledWith(100_000_000);
  });

  it("calls onToggleRecording when record button is clicked", () => {
    render(<QuickActions {...defaultProps} />);

    const recordButton = screen.getByRole("button", {
      name: /record.*\(r\)/i,
    });
    fireEvent.click(recordButton);

    expect(mockOnToggleRecording).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleGrid when grid button is clicked", () => {
    render(<QuickActions {...defaultProps} />);

    const gridButton = screen.getByRole("button", { name: /grid.*\(g\)/i });
    fireEvent.click(gridButton);

    expect(mockOnToggleGrid).toHaveBeenCalledTimes(1);
  });

  it("calls onShowHelp when help button is clicked", () => {
    render(<QuickActions {...defaultProps} />);

    const helpButton = screen.getByRole("button", {
      name: /keyboard shortcuts/i,
    });
    fireEvent.click(helpButton);

    expect(mockOnShowHelp).toHaveBeenCalledTimes(1);
  });

  it("displays recording state correctly", () => {
    const { rerender } = render(<QuickActions {...defaultProps} />);

    let recordButton = screen.getByRole("button", { name: /record.*\(r\)/i });
    expect(recordButton).toHaveAttribute("aria-pressed", "false");
    expect(recordButton).not.toHaveClass("recording");

    // Rerender with recording active
    rerender(<QuickActions {...defaultProps} isRecording={true} />);

    recordButton = screen.getByRole("button", { name: /record.*\(r\)/i });
    expect(recordButton).toHaveAttribute("aria-pressed", "true");
    expect(recordButton).toHaveClass("recording");
  });

  it("displays grid state correctly", () => {
    const { rerender } = render(<QuickActions {...defaultProps} />);

    let gridButton = screen.getByRole("button", { name: /grid.*\(g\)/i });
    expect(gridButton).toHaveAttribute("aria-pressed", "false");
    expect(gridButton).not.toHaveClass("active");

    // Rerender with grid active
    rerender(<QuickActions {...defaultProps} showGrid={true} />);

    gridButton = screen.getByRole("button", { name: /grid.*\(g\)/i });
    expect(gridButton).toHaveAttribute("aria-pressed", "true");
    expect(gridButton).toHaveClass("active");
  });

  it("shows tooltip on hover for bookmark button", () => {
    render(<QuickActions {...defaultProps} />);

    const bookmarkButton = screen.getByRole("button", {
      name: /bookmark.*\(b\)/i,
    });

    // Hover over button
    fireEvent.mouseEnter(bookmarkButton);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Bookmark (B)");

    // Mouse leave should hide tooltip
    fireEvent.mouseLeave(bookmarkButton);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on focus for record button", () => {
    render(<QuickActions {...defaultProps} />);

    const recordButton = screen.getByRole("button", {
      name: /record.*\(r\)/i,
    });

    // Focus button
    fireEvent.focus(recordButton);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Record (R)");

    // Blur should hide tooltip
    fireEvent.blur(recordButton);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("has proper aria-labels for accessibility", () => {
    render(<QuickActions {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /bookmark current frequency.*\(b\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start recording.*\(r\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show grid.*\(g\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });

  it("updates aria-label when recording state changes", () => {
    const { rerender } = render(<QuickActions {...defaultProps} />);

    let recordButton = screen.getByRole("button", {
      name: /start recording.*\(r\)/i,
    });
    expect(recordButton).toBeInTheDocument();

    // Rerender with recording active
    rerender(<QuickActions {...defaultProps} isRecording={true} />);

    recordButton = screen.getByRole("button", {
      name: /stop recording.*\(r\)/i,
    });
    expect(recordButton).toBeInTheDocument();
  });

  it("updates aria-label when grid state changes", () => {
    const { rerender } = render(<QuickActions {...defaultProps} />);

    let gridButton = screen.getByRole("button", { name: /show grid.*\(g\)/i });
    expect(gridButton).toBeInTheDocument();

    // Rerender with grid active
    rerender(<QuickActions {...defaultProps} showGrid={true} />);

    gridButton = screen.getByRole("button", { name: /hide grid.*\(g\)/i });
    expect(gridButton).toBeInTheDocument();
  });

  it("has keyboard navigation support", () => {
    render(<QuickActions {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);

    // All buttons should be keyboard accessible (not disabled)
    buttons.forEach((button) => {
      expect(button).not.toBeDisabled();
    });
  });
});
