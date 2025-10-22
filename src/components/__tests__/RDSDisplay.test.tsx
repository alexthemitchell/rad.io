/**
 * Tests for RDS Display Component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RDSDisplay, RDSDisplayCompact } from "../RDSDisplay";
import type { RDSStationData, RDSDecoderStats } from "../../models/RDSData";
import { RDSProgramType } from "../../models/RDSData";

describe("RDSDisplay", () => {
  const mockRDSData: RDSStationData = {
    pi: 0x1234,
    ps: "TEST-FM",
    pty: RDSProgramType.ROCK_MUSIC,
    rt: "This is a test radio text message",
    ct: new Date("2024-01-01T12:00:00Z"),
    af: [88500000, 95300000],
    tp: true,
    ta: false,
    ms: true,
    di: 0,
    lastUpdate: Date.now(),
    signalQuality: 85,
  };

  const mockStats: RDSDecoderStats = {
    totalGroups: 100,
    validGroups: 95,
    correctedBlocks: 5,
    errorRate: 5.0,
    syncLocked: true,
    lastSync: Date.now(),
  };

  describe("No Data State", () => {
    it("should render no data message when rdsData is null", () => {
      render(<RDSDisplay rdsData={null} stats={null} />);

      expect(screen.getByText("No RDS Data")).toBeInTheDocument();
      expect(
        screen.getByText("Tune to an FM station with RDS broadcasting"),
      ).toBeInTheDocument();
    });

    it("should render no data message when PI is null", () => {
      const emptyData = { ...mockRDSData, pi: null };
      render(<RDSDisplay rdsData={emptyData} stats={null} />);

      expect(screen.getByText("No RDS Data")).toBeInTheDocument();
    });

    it("should apply custom className in no data state", () => {
      const { container } = render(
        <RDSDisplay rdsData={null} stats={null} className="custom-class" />,
      );

      const display = container.querySelector(".rds-display");
      expect(display).toHaveClass("custom-class");
    });
  });

  describe("Station Data Display", () => {
    it("should display station name (PS)", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("TEST-FM")).toBeInTheDocument();
    });

    it("should display PI code", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("1234")).toBeInTheDocument();
    });

    it("should display program type", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("Rock Music")).toBeInTheDocument();
    });

    it("should display radio text", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      // Radio text should be present (might be scrolled)
      const rtContent = screen.getByText(/This is a test/);
      expect(rtContent).toBeInTheDocument();
    });

    it("should display sync status", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("Locked")).toBeInTheDocument();
    });

    it("should display signal quality", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("should display traffic information when available", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("✓ Available")).toBeInTheDocument();
    });

    it("should display traffic announcement when active", () => {
      const dataWithTA = { ...mockRDSData, ta: true };
      render(<RDSDisplay rdsData={dataWithTA} stats={mockStats} />);

      expect(screen.getByText("🚨 Announcement")).toBeInTheDocument();
    });

    it("should display alternative frequencies count", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText("2 available")).toBeInTheDocument();
    });

    it("should format time display", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      // Check that time element is present (format depends on locale)
      const timeElement = screen
        .getAllByText(/\d{1,2}:\d{2}/)
        .find((el) => el.textContent?.includes(":"));
      expect(timeElement).toBeDefined();
    });
  });

  describe("Statistics Display", () => {
    it("should display group statistics", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText(/Groups: 95\/100/)).toBeInTheDocument();
    });

    it("should display error rate", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText(/Error Rate: 5\.0%/)).toBeInTheDocument();
    });

    it("should display corrected blocks when present", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={mockStats} />);

      expect(screen.getByText(/Corrected: 5/)).toBeInTheDocument();
    });

    it("should not display corrected blocks when zero", () => {
      const statsNoCorrected = { ...mockStats, correctedBlocks: 0 };
      render(<RDSDisplay rdsData={mockRDSData} stats={statsNoCorrected} />);

      expect(screen.queryByText(/Corrected:/)).not.toBeInTheDocument();
    });

    it("should handle null stats", () => {
      render(<RDSDisplay rdsData={mockRDSData} stats={null} />);

      // Should still render station data
      expect(screen.getByText("TEST-FM")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing radio text", () => {
      const dataNoRT = { ...mockRDSData, rt: "" };
      render(<RDSDisplay rdsData={dataNoRT} stats={mockStats} />);

      // Should not crash
      expect(screen.getByText("TEST-FM")).toBeInTheDocument();
    });

    it("should handle missing station name", () => {
      const dataNoPS = { ...mockRDSData, ps: "" };
      render(<RDSDisplay rdsData={dataNoPS} stats={mockStats} />);

      // Should show placeholder
      expect(screen.getByText("--------")).toBeInTheDocument();
    });

    it("should handle missing clock time", () => {
      const dataNoCT = { ...mockRDSData, ct: null };
      render(<RDSDisplay rdsData={dataNoCT} stats={mockStats} />);

      // Should still render other data
      expect(screen.getByText("TEST-FM")).toBeInTheDocument();
    });

    it("should handle empty alternative frequencies", () => {
      const dataNoAF = { ...mockRDSData, af: [] };
      render(<RDSDisplay rdsData={dataNoAF} stats={mockStats} />);

      // Should not show AF section
      expect(screen.queryByText(/Alt\. Frequencies:/)).not.toBeInTheDocument();
    });

    it("should handle zero signal quality", () => {
      const dataZeroQuality = { ...mockRDSData, signalQuality: 0 };
      render(<RDSDisplay rdsData={dataZeroQuality} stats={mockStats} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should handle very long radio text", () => {
      const longText = "A".repeat(200);
      const dataLongRT = { ...mockRDSData, rt: longText };

      render(<RDSDisplay rdsData={dataLongRT} stats={mockStats} />);

      // Should render without crashing
      expect(screen.getByText("TEST-FM")).toBeInTheDocument();
    });
  });

  describe("RDSDisplayCompact", () => {
    it("should render compact no data state", () => {
      render(<RDSDisplayCompact rdsData={null} />);

      expect(screen.getByText("No RDS")).toBeInTheDocument();
    });

    it("should render compact station data", () => {
      render(<RDSDisplayCompact rdsData={mockRDSData} />);

      expect(screen.getByText("TEST-FM")).toBeInTheDocument();
    });

    it("should display truncated radio text in compact mode", () => {
      const longText =
        "This is a very long radio text that should be truncated";
      const dataLongRT = { ...mockRDSData, rt: longText };

      render(<RDSDisplayCompact rdsData={dataLongRT} />);

      // Should show truncated text with ellipsis
      const rtElement = screen.getByTitle(longText);
      expect(rtElement).toBeInTheDocument();
      expect(rtElement.textContent).toContain("...");
    });

    it("should display program type in compact mode", () => {
      render(<RDSDisplayCompact rdsData={mockRDSData} />);

      expect(screen.getByText(/Rock Music/)).toBeInTheDocument();
    });

    it("should display PI code in compact mode", () => {
      render(<RDSDisplayCompact rdsData={mockRDSData} />);

      expect(screen.getByText(/1234/)).toBeInTheDocument();
    });

    it("should handle PI null in compact mode", () => {
      const emptyData = { ...mockRDSData, pi: null };
      render(<RDSDisplayCompact rdsData={emptyData} />);

      expect(screen.getByText("No RDS")).toBeInTheDocument();
    });
  });
});
