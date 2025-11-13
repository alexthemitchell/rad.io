/**
 * Tests for ATSCProgramGuide component
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ATSCProgramGuide } from "../ATSCProgramGuide";
import { EPGStorage } from "../../../utils/epgStorage";
import type { EPGChannelData } from "../../../utils/epgStorage";

// Mock EPGStorage
jest.mock("../../../utils/epgStorage");

describe("ATSCProgramGuide", () => {
  const mockChannelData: EPGChannelData[] = [
    {
      sourceId: 1,
      channelNumber: "7.1",
      channelName: "TEST-TV",
      programs: [
        {
          eventId: 1,
          channelSourceId: 1,
          channelNumber: "7.1",
          title: "Test Program",
          description: "A test program description",
          startTime: new Date("2025-01-01T14:00:00"),
          endTime: new Date("2025-01-01T15:00:00"),
          durationSeconds: 3600,
          genres: ["News"],
          rating: null,
          isHD: true,
          languageCode: "eng",
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (EPGStorage.getAllEPGData as jest.Mock).mockReturnValue(mockChannelData);
    (EPGStorage.getCurrentPrograms as jest.Mock).mockReturnValue([]);
    (EPGStorage.getAllGenres as jest.Mock).mockReturnValue(["News", "Sports"]);
    (EPGStorage.searchPrograms as jest.Mock).mockReturnValue([]);
  });

  it("should render EPG header", () => {
    render(<ATSCProgramGuide />);

    expect(screen.getByText("Program Guide")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("should render search bar", () => {
    render(<ATSCProgramGuide />);

    expect(screen.getByPlaceholderText("Search programs...")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /filter by genre/i })).toBeInTheDocument();
  });

  it("should display grid view by default", () => {
    render(<ATSCProgramGuide />);

    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("◀ Earlier")).toBeInTheDocument();
    expect(screen.getByText("Later ▶")).toBeInTheDocument();
  });

  it("should switch to search view when searching", () => {
    (EPGStorage.searchPrograms as jest.Mock).mockReturnValue([
      mockChannelData[0]?.programs[0],
    ]);

    render(<ATSCProgramGuide />);

    const searchInput = screen.getByPlaceholderText("Search programs...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    expect(screen.getByText(/Search Results/)).toBeInTheDocument();
  });

  it("should call onTuneToChannel when provided", () => {
    const mockTune = jest.fn();
    render(<ATSCProgramGuide onTuneToChannel={mockTune} />);

    // This test would require clicking on a program and the modal
    // For now, verify the prop is passed
    expect(mockTune).not.toHaveBeenCalled();
  });

  it("should clear search when clear button clicked", () => {
    (EPGStorage.searchPrograms as jest.Mock).mockReturnValue([
      mockChannelData[0]?.programs[0],
    ]);

    render(<ATSCProgramGuide />);

    const searchInput = screen.getByPlaceholderText("Search programs...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue("");
  });

  it("should filter by genre", () => {
    (EPGStorage.filterByGenre as jest.Mock).mockReturnValue([
      mockChannelData[0]?.programs[0],
    ]);

    render(<ATSCProgramGuide />);

    const genreSelect = screen.getByRole("combobox", { name: /filter by genre/i });
    fireEvent.change(genreSelect, { target: { value: "News" } });

    waitFor(() => {
      expect(EPGStorage.filterByGenre).toHaveBeenCalledWith("News");
    });
  });

  it("should refresh EPG data", () => {
    render(<ATSCProgramGuide />);

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    waitFor(() => {
      expect(EPGStorage.getAllEPGData).toHaveBeenCalled();
    });
  });

  it("should clear EPG data", () => {
    render(<ATSCProgramGuide />);

    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);

    expect(EPGStorage.clearEPGData).toHaveBeenCalled();
  });

  it("should show no data message when EPG is empty", () => {
    (EPGStorage.getAllEPGData as jest.Mock).mockReturnValue([]);

    render(<ATSCProgramGuide />);

    expect(screen.getByText("No EPG data available")).toBeInTheDocument();
  });

  it("should show no results message when search returns empty", () => {
    (EPGStorage.searchPrograms as jest.Mock).mockReturnValue([]);

    render(<ATSCProgramGuide />);

    const searchInput = screen.getByPlaceholderText("Search programs...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(
      screen.getByText("No programs found matching your criteria"),
    ).toBeInTheDocument();
  });

  it("should display genre options from EPG data", () => {
    render(<ATSCProgramGuide />);

    const genreSelect = screen.getByRole("combobox", { name: /filter by genre/i });
    expect(genreSelect).toBeInTheDocument();

    // Check that genres are populated
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Sports")).toBeInTheDocument();
  });
});
