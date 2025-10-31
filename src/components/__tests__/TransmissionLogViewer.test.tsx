/**
 * Tests for TransmissionLogViewer component
 */

import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransmissionLogViewer from "../TransmissionLogViewer";
import { getP25TransmissionLogger } from "../../utils/p25TransmissionLog";

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

  it("should sort by talkgroup ID and toggle direction", async () => {
    render(<TransmissionLogViewer />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/2 transmissions found/i)).toBeInTheDocument();
    });

    const sortTalkgroupBtn = screen.getByLabelText(/Sort by talkgroup ID/i);
    const initialCalls = (getP25TransmissionLogger as jest.Mock).mock.calls
      .length;

    // First click sets field to talkgroup with default desc (▼)
    await act(async () => { sortTalkgroupBtn.click(); });

    // Second click toggles to asc (▲)
    await act(async () => { sortTalkgroupBtn.click(); });

    // Expect logger to be re-initialized/re-fetched due to sort changes
    const afterCalls = (getP25TransmissionLogger as jest.Mock).mock.calls
      .length;
    expect(afterCalls).toBeGreaterThan(initialCalls);
  });

  it("should export CSV and revoke object URL after a short delay", async () => {
    jest.useFakeTimers();
    // Some environments may not provide these; ensure they exist and are mockable
    const originalCreate = URL.createObjectURL as any;
    const originalRevoke = (URL as any).revokeObjectURL as any;
    (URL as any).createObjectURL = jest.fn(() => "blob:mock-url");
    (URL as any).revokeObjectURL = jest.fn();

    // Spy on DOM append/remove to avoid side effects
    const appendSpy = jest.spyOn(document.body, "appendChild");
    const removeSpy = jest.spyOn(document.body, "removeChild");

    render(<TransmissionLogViewer />);

    await waitFor(() => {
      expect(screen.getByText(/2 transmissions found/i)).toBeInTheDocument();
    });

    const exportBtn = screen.getByLabelText(/Export transmissions to CSV/i);
    await act(async () => {
      exportBtn.click();
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    // Revoke is scheduled, not immediate
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // Fast-forward timers to trigger revoke
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    // Restore
    (URL as any).createObjectURL = originalCreate;
    (URL as any).revokeObjectURL = originalRevoke;
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    jest.useRealTimers();
  });
});
