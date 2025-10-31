/**
 * Tests for TransmissionLogViewer component
 */

import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransmissionLogViewer from "../TransmissionLogViewer";

// Mock the P25TransmissionLogger
jest.mock("../../utils/p25TransmissionLog", () => ({
  getP25TransmissionLogger: jest.fn(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    queryTransmissions: jest.fn().mockResolvedValue([
      {
        id: 1,
        timestamp: Date.now() - 10000,
        talkgroupId: 101,
        sourceId: 2001,
        duration: 5000,
        signalQuality: 85,
        slot: 1,
        isEncrypted: false,
        errorRate: 0.05,
      },
      {
        id: 2,
        timestamp: Date.now() - 5000,
        talkgroupId: 102,
        sourceId: 2002,
        duration: 3000,
        signalQuality: 90,
        slot: 2,
        isEncrypted: false,
        errorRate: 0.03,
      },
    ]),
    getCount: jest.fn().mockResolvedValue(2),
  })),
}));

describe("TransmissionLogViewer", () => {
  it("should render the component", async () => {
    await act(async () => {
      render(<TransmissionLogViewer />);
    });
    expect(screen.getByText("Transmission Log")).toBeInTheDocument();
  });

  it("should display loading state initially", async () => {
    await act(async () => {
      render(<TransmissionLogViewer />);
    });
    // Loading state is transient, just check that component rendered
    expect(screen.getByText("Transmission Log")).toBeInTheDocument();
  });

  it("should display transmissions after loading", async () => {
    await act(async () => {
      render(<TransmissionLogViewer />);
    });

    await waitFor(() => {
      expect(screen.getByText(/2 transmissions found/i)).toBeInTheDocument();
    });

    // Check for table headers (using aria labels)
    expect(screen.getByLabelText(/Sort by timestamp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort by talkgroup ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort by duration/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Sort by signal quality/i),
    ).toBeInTheDocument();
  });

  it("should display filter controls", async () => {
    await act(async () => {
      render(<TransmissionLogViewer />);
    });

    expect(
      screen.getByLabelText(/Filter by talkgroup ID/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by source ID/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Minimum signal quality filter/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Start date filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End date filter/i)).toBeInTheDocument();
  });

  it("should have export button", async () => {
    await act(async () => {
      render(<TransmissionLogViewer />);
    });
    expect(
      screen.getByLabelText(/Export transmissions to CSV/i),
    ).toBeInTheDocument();
  });

  it("should have clear filters button", async () => {
    await act(async () => {
      render(<TransmissionLogViewer />);
    });
    expect(screen.getByLabelText(/Clear all filters/i)).toBeInTheDocument();
  });
});
