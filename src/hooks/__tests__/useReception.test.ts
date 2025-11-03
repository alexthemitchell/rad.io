import { renderHook, act, waitFor } from "@testing-library/react";
import { useReception } from "../useReception";
import type { ISDRDevice } from "../../models/SDRDevice";

// Mock the e2e utility
jest.mock("../../utils/e2e", () => ({
  shouldUseMockSDR: jest.fn(() => false),
}));

describe("useReception", () => {
  let mockDevice: jest.Mocked<ISDRDevice>;
  let mockStartDsp: jest.Mock;
  let mockStopDsp: jest.Mock;
  let mockStopScanner: jest.Mock;

  const getDefaultOptions = () => ({
    device: undefined, // Start with no device to prevent auto-start
    frequency: 100_000_000, // 100 MHz
    config: {
      sampleRate: 2_000_000,
      lnaGain: 16,
      vgaGain: 30,
      bandwidth: 2_500_000,
    },
    startDsp: mockStartDsp,
    stopDsp: mockStopDsp,
    stopScanner: mockStopScanner,
    scannerState: "idle" as const,
  });

  beforeEach(() => {
    // Create mock device with all required methods
    mockDevice = {
      isOpen: jest.fn(() => true),
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setSampleRate: jest.fn().mockResolvedValue(undefined),
      setLNAGain: jest.fn().mockResolvedValue(undefined),
      setVGAGain: jest.fn().mockResolvedValue(undefined),
      setBandwidth: jest.fn().mockResolvedValue(undefined),
      setFrequency: jest.fn().mockResolvedValue(undefined),
      receive: jest.fn().mockResolvedValue(undefined),
      stopRx: jest.fn().mockResolvedValue(undefined),
      getDeviceInfo: jest.fn().mockResolvedValue({ name: "Test Device" }),
      parseSamples: jest.fn(),
      getCapabilities: jest.fn(),
    } as unknown as jest.Mocked<ISDRDevice>;

    mockStartDsp = jest.fn().mockImplementation(() => Promise.resolve());
    mockStopDsp = jest.fn().mockImplementation(() => Promise.resolve());
    mockStopScanner = jest.fn();

    // Clear window.dbgReceiving
    delete (window as { dbgReceiving?: boolean }).dbgReceiving;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with isReceiving false", () => {
    const { result } = renderHook(() => useReception(getDefaultOptions()));

    expect(result.current.isReceiving).toBe(false);
    expect(result.current.statusMessage).toBe("");
  });

  it("should start reception and tune device", async () => {
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(mockStopScanner).toHaveBeenCalled();
    expect(mockDevice.setSampleRate).toHaveBeenCalledWith(2_000_000);
    expect(mockDevice.setLNAGain).toHaveBeenCalledWith(16);
    expect(mockDevice.setVGAGain).toHaveBeenCalledWith(30);
    expect(mockDevice.setBandwidth).toHaveBeenCalledWith(2_500_000);
    expect(mockDevice.setFrequency).toHaveBeenCalledWith(100_000_000);
    expect(mockStartDsp).toHaveBeenCalled();
    expect(result.current.isReceiving).toBe(true);
    expect(result.current.statusMessage).toContain("Receiving started");
  });

  it("should stop reception", async () => {
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(result.current.isReceiving).toBe(true);

    await act(async () => {
      await result.current.stopReception();
    });

    expect(mockStopDsp).toHaveBeenCalled();
    // The state should be updated immediately after stopReception completes
    expect(result.current.isReceiving).toBe(false);
    expect(result.current.statusMessage).toContain("Reception stopped");
  });

  it("should handle device tuning errors gracefully", async () => {
    mockDevice.setFrequency.mockRejectedValueOnce(
      new Error("Failed to set frequency"),
    );

    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(result.current.isReceiving).toBe(false);
    expect(result.current.statusMessage).toContain("Start failed");
  });

  it("should prevent re-entrant start calls", async () => {
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    // Start first call
    await act(async () => {
      await result.current.startReception();
    });

    // Try to start again while already receiving
    await act(async () => {
      await result.current.startReception();
    });

    // Should only tune once
    expect(mockDevice.setFrequency).toHaveBeenCalledTimes(1);
    expect(mockStartDsp).toHaveBeenCalledTimes(1);
  });

  it("should handle missing device", async () => {
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: undefined,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(mockStartDsp).not.toHaveBeenCalled();
    expect(result.current.isReceiving).toBe(false);
    expect(result.current.statusMessage).toContain("No device connected");
  });

  it("should open device if not already open", async () => {
    mockDevice.isOpen.mockReturnValue(false);
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(mockDevice.open).toHaveBeenCalled();
    expect(result.current.isReceiving).toBe(true);
  });

  it("should skip setVGAGain if not supported by device", async () => {
    const deviceWithoutVGA = {
      ...mockDevice,
      setVGAGain: undefined,
    } as unknown as jest.Mocked<ISDRDevice>;

    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: deviceWithoutVGA,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(result.current.isReceiving).toBe(true);
  });

  it("should skip setBandwidth if not supported by device", async () => {
    const deviceWithoutBandwidth = {
      ...mockDevice,
      setBandwidth: undefined,
    } as unknown as jest.Mocked<ISDRDevice>;

    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: deviceWithoutBandwidth,
        config: {
          ...getDefaultOptions().config,
          bandwidth: undefined,
        },
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(result.current.isReceiving).toBe(true);
  });

  it("should call onStatusMessage callback when provided", async () => {
    const onStatusMessage = jest.fn();
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
        onStatusMessage,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(onStatusMessage).toHaveBeenCalledWith(
      expect.stringContaining("Tuned"),
    );
    expect(onStatusMessage).toHaveBeenCalledWith("Receiving started");
  });

  it("should clean up on unmount if receiving", async () => {
    const { result, unmount } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(result.current.isReceiving).toBe(true);

    unmount();

    await waitFor(() => {
      expect(mockStopDsp).toHaveBeenCalled();
    });
  });

  it("should not auto-start if scanner is active", async () => {
    renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        scannerState: "scanning",
      }),
    );

    // Wait a bit to ensure auto-start doesn't happen
    await waitFor(
      () => {
        expect(mockStartDsp).not.toHaveBeenCalled();
      },
      { timeout: 100 },
    );
  });

  it("should expose dbgReceiving on window for E2E tests", async () => {
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    expect(window.dbgReceiving).toBe(false);

    await act(async () => {
      await result.current.startReception();
    });

    expect(window.dbgReceiving).toBe(true);

    await act(async () => {
      await result.current.stopReception();
    });

    // Wait for state updates to flush
    await waitFor(() => {
      expect(window.dbgReceiving).toBe(false);
    });
  });

  it("should handle DSP start failure", async () => {
    mockStartDsp.mockRejectedValueOnce(new Error("DSP initialization failed"));

    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    expect(result.current.isReceiving).toBe(false);
    expect(result.current.statusMessage).toContain("Start failed");
  });

  it("should handle DSP stop failure gracefully", async () => {
    const { result } = renderHook(() =>
      useReception({
        ...getDefaultOptions(),
        device: mockDevice,
      }),
    );

    await act(async () => {
      await result.current.startReception();
    });

    // Set up the failure for the next call
    mockStopDsp.mockRejectedValueOnce(new Error("DSP stop failed"));

    await act(async () => {
      await result.current.stopReception();
    });

    // Should still update state even if stop fails
    await waitFor(() => {
      expect(result.current.isReceiving).toBe(false);
    });
    expect(result.current.statusMessage).toContain("Reception stopped");
  });
});
