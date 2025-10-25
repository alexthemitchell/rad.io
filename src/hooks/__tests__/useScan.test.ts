/**
 * useScan Hook Tests
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useScan } from "../useScan";
import { scanManager } from "../../lib/scanning/scan-manager";
import type { ScanConfig } from "../../lib/scanning/types";

// Mock scan manager
jest.mock("../../lib/scanning/scan-manager", () => ({
  scanManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    startScan: jest.fn(),
    stopScan: jest.fn(),
    getActiveScans: jest.fn().mockReturnValue([]),
    getResults: jest.fn().mockReturnValue([]),
  },
}));

describe("useScan", () => {
  const mockDevice = {
    setFrequency: jest.fn(),
    captureSamples: jest.fn(),
    config: { sampleRate: 2_000_000 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useScan());

    expect(result.current.isScanning).toBe(false);
    expect(result.current.scanId).toBeNull();
    expect(result.current.results).toEqual([]);
    expect(result.current.progress).toBe(0);
    expect(result.current.activeFrequencies).toEqual([]);
  });

  it("should start a scan", async () => {
    (scanManager.startScan as jest.Mock).mockResolvedValue("scan-123");

    const { result } = renderHook(() => useScan());

    const config: ScanConfig = {
      startFreq: 146_000_000,
      endFreq: 146_100_000,
      step: 25_000,
      strategy: "linear",
    };

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    expect(scanManager.startScan).toHaveBeenCalledWith(config, mockDevice);
    expect(result.current.isScanning).toBe(true);
    expect(result.current.scanId).toBe("scan-123");
  });

  it("should not start scan if already scanning", async () => {
    (scanManager.startScan as jest.Mock).mockResolvedValue("scan-123");

    const { result } = renderHook(() => useScan());

    const config: ScanConfig = {
      startFreq: 146_000_000,
      endFreq: 146_100_000,
      step: 25_000,
      strategy: "linear",
    };

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    // Try to start another scan
    const callCount = (scanManager.startScan as jest.Mock).mock.calls.length;

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    // Should not have called startScan again
    expect((scanManager.startScan as jest.Mock).mock.calls.length).toBe(callCount);
  });

  it("should stop a scan", async () => {
    (scanManager.startScan as jest.Mock).mockResolvedValue("scan-123");

    const { result } = renderHook(() => useScan());

    const config: ScanConfig = {
      startFreq: 146_000_000,
      endFreq: 146_100_000,
      step: 25_000,
      strategy: "linear",
    };

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    act(() => {
      result.current.stopScan();
    });

    expect(scanManager.stopScan).toHaveBeenCalledWith("scan-123");
    expect(result.current.isScanning).toBe(false);
    expect(result.current.scanId).toBeNull();
  });

  it("should handle scan progress events", async () => {
    (scanManager.startScan as jest.Mock).mockResolvedValue("scan-123");

    const { result } = renderHook(() => useScan());

    const config: ScanConfig = {
      startFreq: 146_000_000,
      endFreq: 146_100_000,
      step: 25_000,
      strategy: "linear",
    };

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    // Simulate progress event
    const progressEvent = new CustomEvent("scan:progress", {
      detail: {
        scanId: "scan-123",
        currentFreq: 146_000_000,
        totalFreqs: 5,
        scannedFreqs: 1,
        progress: 20,
        result: {
          frequency: 146_000_000,
          timestamp: Date.now(),
          powerSpectrum: new Float32Array(10),
          peakPower: -50,
          avgPower: -60,
        },
      },
    });

    act(() => {
      window.dispatchEvent(progressEvent);
    });

    await waitFor(() => {
      expect(result.current.results.length).toBe(1);
      expect(result.current.progress).toBe(20);
    });
  });

  it("should handle scan complete events", async () => {
    (scanManager.startScan as jest.Mock).mockResolvedValue("scan-123");

    const { result } = renderHook(() => useScan());

    const config: ScanConfig = {
      startFreq: 146_000_000,
      endFreq: 146_100_000,
      step: 25_000,
      strategy: "linear",
    };

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    // Simulate complete event
    const completeEvent = new CustomEvent("scan:complete", {
      detail: {
        scanId: "scan-123",
        results: [],
        totalTime: 5000,
        activeFrequencies: [146_000_000, 146_050_000],
      },
    });

    act(() => {
      window.dispatchEvent(completeEvent);
    });

    await waitFor(() => {
      expect(result.current.isScanning).toBe(false);
      expect(result.current.progress).toBe(100);
      expect(result.current.activeFrequencies).toEqual([146_000_000, 146_050_000]);
    });
  });

  it("should handle scan error events", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    (scanManager.startScan as jest.Mock).mockResolvedValue("scan-123");

    const { result } = renderHook(() => useScan());

    const config: ScanConfig = {
      startFreq: 146_000_000,
      endFreq: 146_100_000,
      step: 25_000,
      strategy: "linear",
    };

    await act(async () => {
      await result.current.startScan(config, mockDevice);
    });

    // Simulate error event
    const errorEvent = new CustomEvent("scan:error", {
      detail: {
        scanId: "scan-123",
        error: "Device error",
      },
    });

    act(() => {
      window.dispatchEvent(errorEvent);
    });

    await waitFor(() => {
      expect(result.current.isScanning).toBe(false);
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("should clear results", async () => {
    const { result } = renderHook(() => useScan());

    // Manually set some state
    await act(async () => {
      // Add some mock results by simulating progress
      const progressEvent = new CustomEvent("scan:progress", {
        detail: {
          scanId: "scan-123",
          result: {
            frequency: 146_000_000,
            timestamp: Date.now(),
            powerSpectrum: new Float32Array(10),
            peakPower: -50,
            avgPower: -60,
          },
          progress: 50,
        },
      });
      window.dispatchEvent(progressEvent);
    });

    act(() => {
      result.current.clearResults();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.progress).toBe(0);
    expect(result.current.activeFrequencies).toEqual([]);
  });

  it("should cleanup active scans on unmount", () => {
    (scanManager.getActiveScans as jest.Mock).mockReturnValue(["scan-123", "scan-456"]);

    const { unmount } = renderHook(() => useScan());

    unmount();

    expect(scanManager.stopScan).toHaveBeenCalledWith("scan-123");
    expect(scanManager.stopScan).toHaveBeenCalledWith("scan-456");
  });
});
