/**
 * Tests for ActivityLog component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ActivityLog, { type ScanActivity } from "../Scanner/ActivityLog";

describe("ActivityLog", () => {
  const mockActivities: ScanActivity[] = [
    {
      id: "1",
      timestamp: "2024-01-15T10:30:00.000Z",
      frequency: 145.525,
      signalStrength: -65,
      duration: 15,
      mode: "FM",
    },
    {
      id: "2",
      timestamp: "2024-01-15T10:31:00.000Z",
      frequency: 446.875,
      signalStrength: -72,
      duration: 45,
      mode: "Digital",
    },
    {
      id: "3",
      timestamp: "2024-01-15T10:32:00.000Z",
      frequency: 7.185,
      signalStrength: -80,
      duration: 120,
      mode: "SSB",
    },
  ];

  describe("Empty State", () => {
    it("should render empty state when no activities provided", () => {
      render(<ActivityLog />);

      expect(
        screen.getByText(
          /No scan activity yet\. Start a scan to see detected signals here\./i,
        ),
      ).toBeInTheDocument();
    });

    it("should render empty state when activities array is empty", () => {
      render(<ActivityLog activities={[]} />);

      expect(
        screen.getByText(
          /No scan activity yet\. Start a scan to see detected signals here\./i,
        ),
      ).toBeInTheDocument();
    });

    it("should have proper table structure in empty state", () => {
      render(<ActivityLog />);

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Check for column headers
      expect(screen.getByText("Timestamp")).toBeInTheDocument();
      expect(screen.getByText("Frequency (MHz)")).toBeInTheDocument();
      expect(screen.getByText("Signal Strength")).toBeInTheDocument();
      expect(screen.getByText("Duration")).toBeInTheDocument();
      expect(screen.getByText("Mode")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  describe("With Data", () => {
    it("should render all activities", () => {
      render(<ActivityLog activities={mockActivities} />);

      // Check that all frequency values are present
      expect(screen.getByText("145.525")).toBeInTheDocument();
      expect(screen.getByText("446.875")).toBeInTheDocument();
      expect(screen.getByText("7.185")).toBeInTheDocument();
    });

    it("should format frequencies to 3 decimal places", () => {
      const activities: ScanActivity[] = [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00.000Z",
          frequency: 145.5,
          signalStrength: -65,
          duration: 15,
          mode: "FM",
        },
      ];

      render(<ActivityLog activities={activities} />);

      expect(screen.getByText("145.500")).toBeInTheDocument();
    });

    it("should display signal strength in dBm", () => {
      render(<ActivityLog activities={mockActivities} />);

      expect(screen.getByText(/-65 dBm/i)).toBeInTheDocument();
      expect(screen.getByText(/-72 dBm/i)).toBeInTheDocument();
      expect(screen.getByText(/-80 dBm/i)).toBeInTheDocument();
    });

    it("should format duration correctly for seconds", () => {
      const activities: ScanActivity[] = [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00.000Z",
          frequency: 145.525,
          signalStrength: -65,
          duration: 45,
          mode: "FM",
        },
      ];

      render(<ActivityLog activities={activities} />);

      expect(screen.getByText("45s")).toBeInTheDocument();
    });

    it("should format duration correctly for minutes and seconds", () => {
      const activities: ScanActivity[] = [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00.000Z",
          frequency: 145.525,
          signalStrength: -65,
          duration: 125,
          mode: "FM",
        },
      ];

      render(<ActivityLog activities={activities} />);

      expect(screen.getByText("2m 5s")).toBeInTheDocument();
    });

    it("should display mode badges", () => {
      render(<ActivityLog activities={mockActivities} />);

      expect(screen.getByText("FM")).toBeInTheDocument();
      expect(screen.getByText("Digital")).toBeInTheDocument();
      expect(screen.getByText("SSB")).toBeInTheDocument();
    });

    it("should render bookmark buttons for each activity", () => {
      render(<ActivityLog activities={mockActivities} />);

      const bookmarkButtons = screen.getAllByLabelText(/Bookmark signal at/i);
      expect(bookmarkButtons).toHaveLength(mockActivities.length);
    });

    it("should render record buttons for each activity", () => {
      render(<ActivityLog activities={mockActivities} />);

      const recordButtons = screen.getAllByLabelText(/Record signal at/i);
      expect(recordButtons).toHaveLength(mockActivities.length);
    });
  });

  describe("Interactions", () => {
    it("should call onBookmark when bookmark button is clicked", () => {
      const onBookmark = jest.fn();

      render(
        <ActivityLog activities={mockActivities} onBookmark={onBookmark} />,
      );

      const bookmarkButton = screen.getByLabelText(
        /Bookmark signal at 145.525/i,
      );
      fireEvent.click(bookmarkButton);

      expect(onBookmark).toHaveBeenCalledTimes(1);
      expect(onBookmark).toHaveBeenCalledWith(mockActivities[0]);
    });

    it("should call onRecord when record button is clicked", () => {
      const onRecord = jest.fn();

      render(<ActivityLog activities={mockActivities} onRecord={onRecord} />);

      const recordButton = screen.getByLabelText(/Record signal at 446.875/i);
      fireEvent.click(recordButton);

      expect(onRecord).toHaveBeenCalledTimes(1);
      expect(onRecord).toHaveBeenCalledWith(mockActivities[1]);
    });

    it("should not crash when handlers are not provided", () => {
      render(<ActivityLog activities={mockActivities} />);

      const bookmarkButton = screen.getByLabelText(
        /Bookmark signal at 145.525/i,
      );
      const recordButton = screen.getByLabelText(/Record signal at 145.525/i);

      // These should not throw errors
      fireEvent.click(bookmarkButton);
      fireEvent.click(recordButton);
    });
  });

  describe("Accessibility", () => {
    it("should have table role", () => {
      render(<ActivityLog />);

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });

    it("should have proper column headers with scope", () => {
      const { container } = render(<ActivityLog />);

      const headers = container.querySelectorAll("th[scope='col']");
      expect(headers).toHaveLength(6);
    });

    it("should have accessible button labels", () => {
      render(<ActivityLog activities={mockActivities} />);

      const bookmarkButton = screen.getByLabelText(
        /Bookmark signal at 145.525 MHz/i,
      );
      expect(bookmarkButton).toHaveAttribute("title", "Bookmark this signal");

      const recordButton = screen.getByLabelText(
        /Record signal at 145.525 MHz/i,
      );
      expect(recordButton).toHaveAttribute("title", "Record this signal");
    });
  });

  describe("Edge Cases", () => {
    it("should handle positive signal strength", () => {
      const activities: ScanActivity[] = [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00.000Z",
          frequency: 145.525,
          signalStrength: 5,
          duration: 15,
          mode: "FM",
        },
      ];

      render(<ActivityLog activities={activities} />);

      expect(screen.getByText(/\+5 dBm/i)).toBeInTheDocument();
    });

    it("should handle zero duration", () => {
      const activities: ScanActivity[] = [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00.000Z",
          frequency: 145.525,
          signalStrength: -65,
          duration: 0,
          mode: "FM",
        },
      ];

      render(<ActivityLog activities={activities} />);

      expect(screen.getByText("0s")).toBeInTheDocument();
    });

    it("should handle all mode types", () => {
      const activities: ScanActivity[] = [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00.000Z",
          frequency: 145.525,
          signalStrength: -65,
          duration: 15,
          mode: "AM",
        },
        {
          id: "2",
          timestamp: "2024-01-15T10:31:00.000Z",
          frequency: 146.525,
          signalStrength: -70,
          duration: 15,
          mode: "FM",
        },
        {
          id: "3",
          timestamp: "2024-01-15T10:32:00.000Z",
          frequency: 147.525,
          signalStrength: -75,
          duration: 15,
          mode: "SSB",
        },
        {
          id: "4",
          timestamp: "2024-01-15T10:33:00.000Z",
          frequency: 148.525,
          signalStrength: -80,
          duration: 15,
          mode: "CW",
        },
        {
          id: "5",
          timestamp: "2024-01-15T10:34:00.000Z",
          frequency: 149.525,
          signalStrength: -85,
          duration: 15,
          mode: "Digital",
        },
      ];

      render(<ActivityLog activities={activities} />);

      expect(screen.getByText("AM")).toBeInTheDocument();
      expect(screen.getByText("FM")).toBeInTheDocument();
      expect(screen.getByText("SSB")).toBeInTheDocument();
      expect(screen.getByText("CW")).toBeInTheDocument();
      expect(screen.getByText("Digital")).toBeInTheDocument();
    });
  });
});
