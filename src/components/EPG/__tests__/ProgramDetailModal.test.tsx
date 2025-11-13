/**
 * Tests for ProgramDetailModal component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ProgramDetailModal } from "../ProgramDetailModal";
import type { EPGProgram } from "../../../utils/epgStorage";

describe("ProgramDetailModal", () => {
  const mockProgram: EPGProgram = {
    eventId: 1,
    channelSourceId: 1,
    channelNumber: "7.1",
    title: "Test Program",
    description: "This is a test program with a detailed description.",
    startTime: new Date("2025-01-01T14:00:00"),
    endTime: new Date("2025-01-01T15:00:00"),
    durationSeconds: 3600,
    genres: ["News", "Documentary"],
    rating: "TV-PG",
    isHD: true,
    languageCode: "eng",
  };

  const mockFutureProgram: EPGProgram = {
    ...mockProgram,
    startTime: new Date(Date.now() + 3600000), // 1 hour from now
    endTime: new Date(Date.now() + 7200000), // 2 hours from now
  };

  const mockPastProgram: EPGProgram = {
    ...mockProgram,
    startTime: new Date(Date.now() - 7200000), // 2 hours ago
    endTime: new Date(Date.now() - 3600000), // 1 hour ago
  };

  const mockProps = {
    program: mockProgram,
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    render(<ProgramDetailModal {...mockProps} isOpen={false} />);

    expect(screen.queryByText("Test Program")).not.toBeInTheDocument();
  });

  it("should not render when program is null", () => {
    render(<ProgramDetailModal {...mockProps} program={null} />);

    expect(screen.queryByText("Test Program")).not.toBeInTheDocument();
  });

  it("should render program details", () => {
    render(<ProgramDetailModal {...mockProps} />);

    expect(screen.getByText("Test Program")).toBeInTheDocument();
    expect(screen.getByText("7.1")).toBeInTheDocument();
    expect(
      screen.getByText("This is a test program with a detailed description."),
    ).toBeInTheDocument();
  });

  it("should display genres", () => {
    render(<ProgramDetailModal {...mockProps} />);

    expect(screen.getByText("News, Documentary")).toBeInTheDocument();
  });

  it("should display HD badge", () => {
    render(<ProgramDetailModal {...mockProps} />);

    expect(screen.getByText("HD")).toBeInTheDocument();
  });

  it("should display rating when available", () => {
    render(<ProgramDetailModal {...mockProps} />);

    expect(screen.getByText("TV-PG")).toBeInTheDocument();
  });

  it("should call onClose when close button clicked", () => {
    const mockClose = jest.fn();
    render(<ProgramDetailModal {...mockProps} onClose={mockClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when escape key pressed", () => {
    const mockClose = jest.fn();
    render(<ProgramDetailModal {...mockProps} onClose={mockClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should show 'Watch Now' button for live programs", () => {
    const liveProgram: EPGProgram = {
      ...mockProgram,
      startTime: new Date(Date.now() - 1800000), // 30 min ago
      endTime: new Date(Date.now() + 1800000), // 30 min from now
    };

    const mockTune = jest.fn();
    render(
      <ProgramDetailModal
        {...mockProps}
        program={liveProgram}
        onTuneToChannel={mockTune}
      />,
    );

    const watchButton = screen.getByText("Watch Now");
    expect(watchButton).toBeInTheDocument();

    fireEvent.click(watchButton);
    expect(mockTune).toHaveBeenCalledWith("7.1", liveProgram.startTime);
  });

  it("should show 'Set Reminder' button for future programs", () => {
    const mockSetReminder = jest.fn();
    render(
      <ProgramDetailModal
        {...mockProps}
        program={mockFutureProgram}
        onSetReminder={mockSetReminder}
      />,
    );

    const reminderButton = screen.getByText("Set Reminder");
    expect(reminderButton).toBeInTheDocument();

    fireEvent.click(reminderButton);
    expect(mockSetReminder).toHaveBeenCalledWith(mockFutureProgram);
  });

  it("should show 'Schedule Recording' button for future programs", () => {
    const mockSchedule = jest.fn();
    render(
      <ProgramDetailModal
        {...mockProps}
        program={mockFutureProgram}
        onScheduleRecording={mockSchedule}
      />,
    );

    const scheduleButton = screen.getByText("Schedule Recording");
    expect(scheduleButton).toBeInTheDocument();

    fireEvent.click(scheduleButton);
    expect(mockSchedule).toHaveBeenCalledWith(mockFutureProgram);
  });

  it("should show 'Tune to Channel' for past programs", () => {
    const mockTune = jest.fn();
    render(
      <ProgramDetailModal
        {...mockProps}
        program={mockPastProgram}
        onTuneToChannel={mockTune}
      />,
    );

    const tuneButton = screen.getByText("Tune to Channel");
    expect(tuneButton).toBeInTheDocument();
  });

  it("should display correct status badge for live program", () => {
    const liveProgram: EPGProgram = {
      ...mockProgram,
      startTime: new Date(Date.now() - 1800000),
      endTime: new Date(Date.now() + 1800000),
    };

    render(<ProgramDetailModal {...mockProps} program={liveProgram} />);

    expect(screen.getByText("Live Now")).toBeInTheDocument();
  });

  it("should display correct status badge for future program", () => {
    render(<ProgramDetailModal {...mockProps} program={mockFutureProgram} />);

    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });

  it("should display correct status badge for past program", () => {
    render(<ProgramDetailModal {...mockProps} program={mockPastProgram} />);

    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  it("should focus close button when modal opens", () => {
    const { rerender } = render(
      <ProgramDetailModal {...mockProps} isOpen={false} />,
    );

    rerender(<ProgramDetailModal {...mockProps} isOpen={true} />);

    const closeButton = screen.getByRole("button", {
      name: "Close program details",
    });
    expect(closeButton).toHaveFocus();
  });
});
