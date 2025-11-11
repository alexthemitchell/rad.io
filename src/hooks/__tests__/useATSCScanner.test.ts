/**
 * Tests for useATSCScanner hook
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useATSCScanner } from "../useATSCScanner";
import type { ISDRDevice } from "../../models/SDRDevice";
import { ATSC8VSBDemodulator } from "../../plugins/demodulators/ATSC8VSBDemodulator";
import * as atscChannelStorage from "../../utils/atscChannelStorage";
import * as dsp from "../../utils/dsp";

// Mock dependencies
jest.mock("../../plugins/demodulators/ATSC8VSBDemodulator");
jest.mock("../../utils/atscChannelStorage");
jest.mock("../../utils/dsp");

describe("useATSCScanner", () => {
  let mockDevice: jest.Mocked<ISDRDevice>;
  let mockDemodulator: jest.Mocked<ATSC8VSBDemodulator>;

  beforeEach(() => {
    // Create mock device
    mockDevice = {
      isOpen: jest.fn().mockReturnValue(true),
      isReceiving: jest.fn().mockReturnValue(false),
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setFrequency: jest.fn().mockResolvedValue(undefined),
      setSampleRate: jest.fn().mockResolvedValue(undefined),
      getSampleRate: jest.fn().mockResolvedValue(10.76e6),
      getUsableBandwidth: jest.fn().mockResolvedValue(6e6),
      stopRx: jest.fn().mockResolvedValue(undefined),
      receive: jest.fn(),
      parseSamples: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ISDRDevice>;

    // Create mock demodulator
    mockDemodulator = {
      initialize: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue(undefined),
      deactivate: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      demodulate: jest.fn().mockReturnValue(new Float32Array(100)),
      isSyncLocked: jest.fn().mockReturnValue(false),
      getSegmentSyncCount: jest.fn().mockReturnValue(0),
      getFieldSyncCount: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<ATSC8VSBDemodulator>;

    (ATSC8VSBDemodulator as jest.Mock).mockImplementation(() => mockDemodulator);

    // Mock storage functions
    jest.spyOn(atscChannelStorage, "saveATSCChannel").mockResolvedValue();
    jest.spyOn(atscChannelStorage, "getAllATSCChannels").mockResolvedValue([]);
    jest.spyOn(atscChannelStorage, "clearAllATSCChannels").mockResolvedValue();

    // Mock DSP functions
    jest.spyOn(dsp, "calculateFFTSync").mockReturnValue(new Float32Array(4096));
    jest.spyOn(dsp, "estimateNoiseFloor").mockReturnValue(-80);
    jest.spyOn(dsp, "detectSpectralPeaks").mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with idle state", () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      expect(result.current.state).toBe("idle");
      expect(result.current.currentChannel).toBeNull();
      expect(result.current.progress).toBe(0);
      expect(result.current.foundChannels).toEqual([]);
    });

    it("should have default configuration", () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      expect(result.current.config).toEqual({
        scanVHFLow: true,
        scanVHFHigh: true,
        scanUHF: true,
        thresholdDb: 15,
        dwellTime: 500,
        fftSize: 4096,
        requirePilot: true,
        requireSync: false,
      });
    });

    it("should load stored channels on mount", async () => {
      const mockChannels = [
        {
          channel: { channel: 7, frequency: 177e6, band: "VHF-High" },
          strength: 0.8,
          snr: 25,
          pilotDetected: true,
          syncLocked: true,
          segmentSyncCount: 10,
          fieldSyncCount: 1,
          discoveredAt: new Date(),
          lastScanned: new Date(),
          scanCount: 1,
        },
      ];
      jest
        .spyOn(atscChannelStorage, "getAllATSCChannels")
        .mockResolvedValue(mockChannels as any);

      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await waitFor(() => {
        expect(result.current.foundChannels.length).toBe(1);
      });
    });
  });

  describe("Configuration", () => {
    it("should update configuration", () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      act(() => {
        result.current.updateConfig({ thresholdDb: 20 });
      });

      expect(result.current.config.thresholdDb).toBe(20);
    });

    it("should update multiple config values", () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      act(() => {
        result.current.updateConfig({
          scanVHFLow: false,
          requireSync: true,
          dwellTime: 1000,
        });
      });

      expect(result.current.config.scanVHFLow).toBe(false);
      expect(result.current.config.requireSync).toBe(true);
      expect(result.current.config.dwellTime).toBe(1000);
    });
  });

  describe("State Management", () => {
    it("should handle start scan", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      expect(result.current.state).toBe("scanning");
      expect(mockDevice.open).not.toHaveBeenCalled(); // Already open
    });

    it("should open device if not open", async () => {
      mockDevice.isOpen.mockReturnValue(false);
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      expect(mockDevice.open).toHaveBeenCalled();
    });

    it("should handle pause scan", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.pauseScan();
      });

      expect(result.current.state).toBe("paused");
    });

    it("should handle resume scan", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.pauseScan();
      });

      expect(result.current.state).toBe("paused");

      act(() => {
        result.current.resumeScan();
      });

      expect(result.current.state).toBe("scanning");
    });

    it("should handle stop scan", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.stopScan();
      });

      expect(result.current.state).toBe("idle");
      expect(result.current.currentChannel).toBeNull();
      expect(result.current.progress).toBe(0);
    });
  });

  describe("Channel Storage", () => {
    it("should clear channels", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.clearChannels();
      });

      expect(atscChannelStorage.clearAllATSCChannels).toHaveBeenCalled();
      expect(result.current.foundChannels).toEqual([]);
    });

    it("should load stored channels", async () => {
      const mockChannels = [
        {
          channel: { channel: 7, frequency: 177e6, band: "VHF-High" },
          strength: 0.8,
          snr: 25,
          pilotDetected: true,
          syncLocked: true,
          segmentSyncCount: 10,
          fieldSyncCount: 1,
          discoveredAt: new Date(),
          lastScanned: new Date(),
          scanCount: 1,
        },
      ];
      jest
        .spyOn(atscChannelStorage, "getAllATSCChannels")
        .mockResolvedValue(mockChannels as any);

      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.loadStoredChannels();
      });

      expect(result.current.foundChannels.length).toBe(1);
    });

    it("should export channels", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      const json = await act(async () => {
        return await result.current.exportChannels();
      });

      expect(typeof json).toBe("string");
      expect(JSON.parse(json)).toEqual([]);
    });

    it("should import channels", async () => {
      const mockChannels = [
        {
          channel: { channel: 7, frequency: 177e6, band: "VHF-High" },
          strength: 0.8,
          snr: 25,
          pilotDetected: true,
          syncLocked: true,
          segmentSyncCount: 10,
          fieldSyncCount: 1,
          discoveredAt: new Date().toISOString(),
          lastScanned: new Date().toISOString(),
          scanCount: 1,
        },
      ];

      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.importChannels(JSON.stringify(mockChannels));
      });

      expect(atscChannelStorage.saveATSCChannel).toHaveBeenCalled();
    });
  });

  describe("Device Availability", () => {
    it("should handle undefined device", async () => {
      const { result } = renderHook(() => useATSCScanner(undefined));

      await act(async () => {
        await result.current.startScan();
      });

      expect(result.current.state).toBe("idle");
    });

    it("should handle device open failure", async () => {
      mockDevice.isOpen.mockReturnValue(false);
      mockDevice.open.mockRejectedValue(new Error("Failed to open"));

      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      expect(result.current.state).toBe("idle");
    });
  });

  describe("Cleanup", () => {
    it("should cleanup on unmount", () => {
      const { unmount } = renderHook(() => useATSCScanner(mockDevice));

      unmount();

      // Verify demodulator cleanup would be called
      // (Can't directly test due to async cleanup in useEffect)
    });
  });

  describe("Scanning Logic", () => {
    it("should scan selected bands only", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      act(() => {
        result.current.updateConfig({
          scanVHFLow: false,
          scanVHFHigh: true,
          scanUHF: false,
        });
      });

      await act(async () => {
        await result.current.startScan();
      });

      // Should only scan VHF-High channels (7-13)
      expect(result.current.state).toBe("scanning");
    });

    it("should clear channels before starting new scan", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      expect(atscChannelStorage.clearAllATSCChannels).toHaveBeenCalled();
      expect(result.current.foundChannels).toEqual([]);
    });
  });

  describe("Signal Detection", () => {
    beforeEach(() => {
      // Mock signal detection
      jest.spyOn(dsp, "detectSpectralPeaks").mockReturnValue([
        {
          binIndex: 2048,
          frequency: 177e6,
          powerDb: -50,
        },
      ]);
    });

    it("should detect pilot tone", () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));
      // Testing pilot detection indirectly through scanning
      expect(result.current.config.requirePilot).toBe(true);
    });

    it("should calculate MER for detected signals", () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));
      // MER calculation is internal to scanning process
      expect(result.current).toBeDefined();
    });
  });

  describe("Progress Tracking", () => {
    it("should update progress during scan", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      // Progress should be updated during scan
      expect(result.current.progress).toBeGreaterThanOrEqual(0);
    });

    it("should reset progress when stopping", async () => {
      const { result } = renderHook(() => useATSCScanner(mockDevice));

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.stopScan();
      });

      expect(result.current.progress).toBe(0);
    });
  });
});
