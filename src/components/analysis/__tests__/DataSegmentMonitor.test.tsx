/**
 * Tests for Data Segment Monitor component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DataSegmentMonitor from "../DataSegmentMonitor";

describe("DataSegmentMonitor", () => {
  it("renders without crashing", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
      />,
    );
    expect(screen.getByText("Sync Monitor")).toBeInTheDocument();
  });

  it("shows locked status when sync is locked", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
      />,
    );
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows searching status when not locked", () => {
    render(
      <DataSegmentMonitor
        syncLocked={false}
        segmentSyncCount={0}
        fieldSyncCount={0}
      />,
    );
    expect(screen.getByText("Searching")).toBeInTheDocument();
  });

  it("displays sync confidence when provided", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
        syncConfidence={0.85}
      />,
    );
    expect(screen.getByText(/Confidence: 85%/)).toBeInTheDocument();
  });

  it("shows weak lock for low confidence", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
        syncConfidence={0.6}
      />,
    );
    expect(screen.getByText("Weak Lock")).toBeInTheDocument();
  });

  it("displays sync progress bar", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
        symbolsSinceSync={416}
        segmentLength={832}
      />,
    );
    expect(screen.getByText(/Next Segment Sync:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Progress:/)).toBeInTheDocument();
  });

  it("shows detailed stats when enabled", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={3}
        showDetails={true}
      />,
    );
    expect(screen.getByText(/Segment Syncs:/)).toBeInTheDocument();
    expect(screen.getByText(/Field Syncs:/)).toBeInTheDocument();
    expect(screen.getByText(/Segment Length:/)).toBeInTheDocument();
  });

  it("hides detailed stats by default", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
        showDetails={false}
      />,
    );
    expect(screen.queryByText(/Segment Syncs:/)).not.toBeInTheDocument();
  });

  it("calculates segments until next field", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={312}
        fieldSyncCount={0}
        showDetails={true}
      />,
    );
    expect(screen.getByText(/To Next Field:/)).toBeInTheDocument();
  });

  it("has proper ARIA region", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
      />,
    );
    expect(
      screen.getByRole("region", { name: /Data segment sync monitor/ }),
    ).toBeInTheDocument();
  });

  it("displays ATSC sync structure info in details", () => {
    render(
      <DataSegmentMonitor
        syncLocked={true}
        segmentSyncCount={100}
        fieldSyncCount={0}
        showDetails={true}
      />,
    );
    expect(screen.getByText(/ATSC Sync Structure:/)).toBeInTheDocument();
    expect(screen.getByText(/4 sync \+ 828 data/)).toBeInTheDocument();
    expect(screen.getByText(/313 segments/)).toBeInTheDocument();
  });
});
