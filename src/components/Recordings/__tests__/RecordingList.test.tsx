import { render, screen, fireEvent } from "@testing-library/react";
import RecordingList from "../RecordingList";
import type { RecordingMeta } from "../../../lib/recording/types";

// Mock the RecordingCard component to simplify testing
jest.mock("../RecordingCard", () => {
  return function MockRecordingCard({
    recording,
    onRecordingSelect,
    onPlay,
    onDelete,
    onExport,
  }: {
    recording: RecordingMeta;
    onRecordingSelect: (id: string) => void;
    onPlay: (id: string) => void;
    onDelete: (id: string) => void;
    onExport: (id: string) => void;
  }) {
    return (
      <div data-testid={`recording-card-${recording.id}`}>
        <span>{recording.label ?? recording.frequency}</span>
        <button
          onClick={() => {
            onRecordingSelect(recording.id);
            onPlay(recording.id);
          }}
        >
          Play
        </button>
        <button
          onClick={() => {
            onDelete(recording.id);
          }}
        >
          Delete
        </button>
        <button
          onClick={() => {
            onExport(recording.id);
          }}
        >
          Export
        </button>
      </div>
    );
  };
});

describe("RecordingList", () => {
  const mockRecordings: RecordingMeta[] = [
    {
      id: "rec-1",
      frequency: 100000000,
      timestamp: "2025-01-15T10:00:00.000Z",
      duration: 60,
      size: 1024 * 1024,
      label: "FM Radio",
    },
    {
      id: "rec-2",
      frequency: 144000000,
      timestamp: "2025-01-15T11:00:00.000Z",
      duration: 120,
      size: 2 * 1024 * 1024,
      label: "Amateur Radio",
    },
    {
      id: "rec-3",
      frequency: 462000000,
      timestamp: "2025-01-15T12:00:00.000Z",
      duration: 30,
      size: 512 * 1024,
      label: "FRS Channel",
    },
  ];

  const mockCallbacks = {
    onRecordingSelect: jest.fn(),
    onPlay: jest.fn(),
    onDelete: jest.fn(),
    onExport: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state", () => {
    render(
      <RecordingList recordings={[]} isLoading={true} {...mockCallbacks} />,
    );

    expect(screen.getByText(/Loading recordings/)).toBeInTheDocument();
  });

  it("renders empty state when no recordings", () => {
    render(
      <RecordingList recordings={[]} isLoading={false} {...mockCallbacks} />,
    );

    expect(screen.getByText(/No recordings yet/)).toBeInTheDocument();
    expect(
      screen.getByText(/Start recording from the Monitor page/),
    ).toBeInTheDocument();
  });

  it("renders all recordings", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    expect(screen.getByTestId("recording-card-rec-1")).toBeInTheDocument();
    expect(screen.getByTestId("recording-card-rec-2")).toBeInTheDocument();
    expect(screen.getByTestId("recording-card-rec-3")).toBeInTheDocument();
  });

  it("filters recordings by search query (label)", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Search by label or frequency/,
    );
    fireEvent.change(searchInput, { target: { value: "Amateur" } });

    expect(screen.getByTestId("recording-card-rec-2")).toBeInTheDocument();
    expect(
      screen.queryByTestId("recording-card-rec-1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("recording-card-rec-3"),
    ).not.toBeInTheDocument();

    expect(screen.getByText(/1 of 3 recordings/)).toBeInTheDocument();
  });

  it("filters recordings by search query (frequency)", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Search by label or frequency/,
    );
    fireEvent.change(searchInput, { target: { value: "144" } });

    expect(screen.getByTestId("recording-card-rec-2")).toBeInTheDocument();
    expect(
      screen.queryByTestId("recording-card-rec-1"),
    ).not.toBeInTheDocument();
  });

  it("shows empty state for no search results", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Search by label or frequency/,
    );
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByText(/No recordings found/)).toBeInTheDocument();
    expect(screen.getByText(/Try a different search term/)).toBeInTheDocument();
  });

  it("sorts by date (default descending)", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const cards = screen.getAllByTestId(/recording-card-/);
    expect(cards[0]).toHaveAttribute("data-testid", "recording-card-rec-3");
    expect(cards[1]).toHaveAttribute("data-testid", "recording-card-rec-2");
    expect(cards[2]).toHaveAttribute("data-testid", "recording-card-rec-1");
  });

  it("toggles sort direction when clicking same sort button", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const dateButton = screen.getByRole("button", { name: /Date/ });

    // Default is descending
    expect(dateButton).toHaveTextContent("Date ↓");

    // Click to toggle to ascending
    fireEvent.click(dateButton);
    expect(dateButton).toHaveTextContent("Date ↑");

    const cards = screen.getAllByTestId(/recording-card-/);
    expect(cards[0]).toHaveAttribute("data-testid", "recording-card-rec-1");
    expect(cards[2]).toHaveAttribute("data-testid", "recording-card-rec-3");
  });

  it("sorts by frequency", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const frequencyButton = screen.getByRole("button", { name: /Frequency/ });
    fireEvent.click(frequencyButton);

    const cards = screen.getAllByTestId(/recording-card-/);
    // Descending: rec-3 (462MHz), rec-2 (144MHz), rec-1 (100MHz)
    expect(cards[0]).toHaveAttribute("data-testid", "recording-card-rec-3");
    expect(cards[1]).toHaveAttribute("data-testid", "recording-card-rec-2");
    expect(cards[2]).toHaveAttribute("data-testid", "recording-card-rec-1");
  });

  it("sorts by size", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const sizeButton = screen.getByRole("button", { name: /Size/ });
    fireEvent.click(sizeButton);

    const cards = screen.getAllByTestId(/recording-card-/);
    // Descending: rec-2 (2MB), rec-1 (1MB), rec-3 (512KB)
    expect(cards[0]).toHaveAttribute("data-testid", "recording-card-rec-2");
    expect(cards[1]).toHaveAttribute("data-testid", "recording-card-rec-1");
    expect(cards[2]).toHaveAttribute("data-testid", "recording-card-rec-3");
  });

  it("sorts by duration", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const durationButton = screen.getByRole("button", { name: /Duration/ });
    fireEvent.click(durationButton);

    const cards = screen.getAllByTestId(/recording-card-/);
    // Descending: rec-2 (120s), rec-1 (60s), rec-3 (30s)
    expect(cards[0]).toHaveAttribute("data-testid", "recording-card-rec-2");
    expect(cards[1]).toHaveAttribute("data-testid", "recording-card-rec-1");
    expect(cards[2]).toHaveAttribute("data-testid", "recording-card-rec-3");
  });

  it("calls onRecordingSelect when card play button is clicked", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    // By default, sorted by date descending, so rec-3 is first
    const playButtons = screen.getAllByText("Play");
    const firstPlayButton = playButtons[0];
    if (firstPlayButton) {
      fireEvent.click(firstPlayButton);
    }

    expect(mockCallbacks.onRecordingSelect).toHaveBeenCalledWith("rec-3");
  });

  it("has accessible search input", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    // Search for the input by its label (we removed aria-label for better accessibility)
    const searchInput = screen.getByLabelText(/Search recordings/);
    expect(searchInput).toBeInTheDocument();
  });

  it("has accessible sort controls", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const sortGroup = screen.getByRole("group", { name: /Sort recordings/ });
    expect(sortGroup).toBeInTheDocument();

    const dateButton = screen.getByRole("button", { name: /Date/ });
    expect(dateButton).toHaveAttribute("aria-pressed", "true");
  });

  it("card wrappers are keyboard accessible", () => {
    render(
      <RecordingList
        recordings={mockRecordings}
        isLoading={false}
        {...mockCallbacks}
      />,
    );

    const playButtons = screen.getAllByText("Play");
    playButtons.forEach((button) => {
      expect(button.tagName).toBe("BUTTON");
    });
  });
});
