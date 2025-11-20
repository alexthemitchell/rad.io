import { render, screen, fireEvent } from "@testing-library/react";
import RecordingCard from "../RecordingCard";
import type { RecordingMeta } from "../../../lib/recording/types";

describe("RecordingCard", () => {
  const mockRecording: RecordingMeta = {
    id: "test-id-123",
    frequency: 100000000, // 100 MHz
    timestamp: "2025-01-15T10:30:00.000Z",
    duration: 125, // 2:05
    size: 5242880, // 5 MB
    label: "Test Recording",
  };

  const mockCallbacks = {
    onRecordingSelect: jest.fn(),
    onPlay: jest.fn(),
    onDelete: jest.fn(),
    onExport: jest.fn(),
    onEditTags: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders recording card with all metadata", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    expect(screen.getByText("Test Recording")).toBeInTheDocument();
    // formatFrequency trims trailing zeros for MHz
    expect(screen.getByText("100 MHz")).toBeInTheDocument();
    expect(screen.getByText(/2:05/)).toBeInTheDocument();
    expect(screen.getByText(/5\.00 MB/)).toBeInTheDocument();
  });

  it("shows frequency as title when label is missing", () => {
    const recordingWithoutLabel: RecordingMeta = {
      ...mockRecording,
      label: undefined,
    };

    render(
      <RecordingCard recording={recordingWithoutLabel} {...mockCallbacks} />,
    );

    // The formatFrequency utility trims trailing zeros for MHz
    const titles = screen.getAllByText("100 MHz");
    expect(titles.length).toBeGreaterThan(0);
  });

  it("formats different frequency ranges correctly", () => {
    const { rerender } = render(
      <RecordingCard
        recording={{ ...mockRecording, frequency: 1000 }}
        {...mockCallbacks}
      />,
    );
    // kHz uses .toFixed(1)
    expect(screen.getByText(/1\.0 kHz/)).toBeInTheDocument();

    rerender(
      <RecordingCard
        recording={{ ...mockRecording, frequency: 2400000000 }}
        {...mockCallbacks}
      />,
    );
    // GHz uses .toFixed(6)
    expect(screen.getByText(/2\.400000 GHz/)).toBeInTheDocument();

    rerender(
      <RecordingCard
        recording={{ ...mockRecording, frequency: 500 }}
        {...mockCallbacks}
      />,
    );
    expect(screen.getByText(/500 Hz/)).toBeInTheDocument();
  });

  it("formats different file sizes correctly", () => {
    const { rerender } = render(
      <RecordingCard
        recording={{ ...mockRecording, size: 512 }}
        {...mockCallbacks}
      />,
    );
    expect(screen.getByText(/512\.00 B/)).toBeInTheDocument();

    rerender(
      <RecordingCard
        recording={{ ...mockRecording, size: 1024 * 1024 }}
        {...mockCallbacks}
      />,
    );
    expect(screen.getByText(/1\.00 MB/)).toBeInTheDocument();

    rerender(
      <RecordingCard
        recording={{ ...mockRecording, size: 1024 * 1024 * 1024 }}
        {...mockCallbacks}
      />,
    );
    expect(screen.getByText(/1\.00 GB/)).toBeInTheDocument();
  });

  it("formats durations correctly", () => {
    const { rerender } = render(
      <RecordingCard
        recording={{ ...mockRecording, duration: 45 }}
        {...mockCallbacks}
      />,
    );
    expect(screen.getByText(/0:45/)).toBeInTheDocument();

    rerender(
      <RecordingCard
        recording={{ ...mockRecording, duration: 3665 }}
        {...mockCallbacks}
      />,
    );
    expect(screen.getByText(/1:01:05/)).toBeInTheDocument();
  });

  it("calls onPlay when play button is clicked", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    const playButton = screen.getByTitle("Play");
    fireEvent.click(playButton);

    expect(mockCallbacks.onRecordingSelect).toHaveBeenCalledWith("test-id-123");
    expect(mockCallbacks.onPlay).toHaveBeenCalledWith("test-id-123");
    expect(mockCallbacks.onPlay).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    const deleteButton = screen.getByTitle("Delete");
    fireEvent.click(deleteButton);

    expect(mockCallbacks.onDelete).toHaveBeenCalledWith("test-id-123");
    expect(mockCallbacks.onDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onExport when export button is clicked", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    const exportButton = screen.getByTitle("Export");
    fireEvent.click(exportButton);

    expect(mockCallbacks.onExport).toHaveBeenCalledWith("test-id-123");
    expect(mockCallbacks.onExport).toHaveBeenCalledTimes(1);
  });

  it("shows edit tags button when onEditTags is provided", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    const editButton = screen.getByTitle("Edit tags");
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);
    expect(mockCallbacks.onEditTags).toHaveBeenCalledWith("test-id-123");
  });

  it("hides edit tags button when onEditTags is not provided", () => {
    const { onEditTags, ...callbacksWithoutEditTags } = mockCallbacks;
    render(
      <RecordingCard recording={mockRecording} {...callbacksWithoutEditTags} />,
    );

    const editButton = screen.queryByTitle("Edit tags");
    expect(editButton).not.toBeInTheDocument();
  });

  it("has accessible labels for all buttons", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    expect(
      screen.getByLabelText(/Play recording Test Recording/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Export recording Test Recording/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Edit tags for Test Recording/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Delete recording Test Recording/),
    ).toBeInTheDocument();
  });

  it("renders as an article with proper ARIA attributes", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    const article = screen.getByRole("article");
    expect(article).toBeInTheDocument();
    expect(article).toHaveAttribute("data-recording-id", "test-id-123");
  });

  it("action buttons meet minimum touch target size", () => {
    render(<RecordingCard recording={mockRecording} {...mockCallbacks} />);

    const playButton = screen.getByTitle("Play");

    // Check that min-width and min-height are set (we can't easily test actual rendered size)
    expect(playButton).toHaveStyle("min-width: 44px");
    expect(playButton).toHaveStyle("min-height: 44px");
  });
});
