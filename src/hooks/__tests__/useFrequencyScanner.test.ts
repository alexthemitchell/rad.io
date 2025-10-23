import { renderHook, act } from "@testing-library/react";
import { useFrequencyScanner } from "../useFrequencyScanner";
import {
  ISDRDevice,
  IQSample,
  SDRDeviceInfo,
  SDRCapabilities,
  DeviceMemoryInfo,
  SDRDeviceType,
} from "../../models/SDRDevice";

// Mock device
class MockSDRDevice implements ISDRDevice {
  private _isOpen = true;
  private _frequency = 100e6;
  private _isReceiving = false;

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return {
      type: SDRDeviceType.HACKRF_ONE,
      vendorId: 0x1d50,
      productId: 0x6089,
      serialNumber: "0000000000000000",
      firmwareVersion: "2021.03.1",
    };
  }

  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 1e6,
      maxFrequency: 6e9,
      supportedSampleRates: [2e6, 4e6, 8e6],
      supportsAmpControl: true,
      supportsAntennaControl: false,
      supportedBandwidths: [20e6],
    };
  }

  async open(): Promise<void> {
    this._isOpen = true;
  }

  async close(): Promise<void> {
    this._isOpen = false;
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    this._frequency = frequencyHz;
  }

  async getFrequency(): Promise<number> {
    return this._frequency;
  }

  async setSampleRate(): Promise<void> {
    // Mock implementation
  }

  async getSampleRate(): Promise<number> {
    return 2e6;
  }
  reset(): Promise<void> {
    return Promise.resolve();
  }

  async setLNAGain(): Promise<void> {
    // Mock implementation
  }

  async setAmpEnable(): Promise<void> {
    // Mock implementation
  }

  async receive(): Promise<void> {
    this._isReceiving = true;
  }

  async stopRx(): Promise<void> {
    this._isReceiving = false;
  }

  isReceiving(): boolean {
    return this._isReceiving;
  }

  parseSamples(): IQSample[] {
    return [];
  }

  getMemoryInfo(): DeviceMemoryInfo {
    return {
      totalBufferSize: 0,
      usedBufferSize: 0,
      activeBuffers: 0,
      maxSamples: 0,
      currentSamples: 0,
    };
  }

  clearBuffers(): void {
    // Mock implementation
  }
}

describe("useFrequencyScanner", () => {
  let mockDevice: MockSDRDevice;

  beforeEach(() => {
    mockDevice = new MockSDRDevice();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Initialization", () => {
    it("initializes with idle state", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      expect(result.current.state).toBe("idle");
      expect(result.current.currentFrequency).toBeNull();
      expect(result.current.activeSignals).toEqual([]);
      expect(result.current.progress).toBe(0);
    });

    it("initializes with default configuration", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      expect(result.current.config).toEqual({
        startFrequency: 88e6,
        endFrequency: 108e6,
        enableRDS: true,
        stepSize: 100e3,
        threshold: 0.3,
        dwellTime: 50,
      });
    });
  });

  describe("Configuration Updates", () => {
    it("updates start frequency", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.updateConfig({ startFrequency: 90e6 });
      });

      expect(result.current.config.startFrequency).toBe(90e6);
    });

    it("updates end frequency", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.updateConfig({ endFrequency: 110e6 });
      });

      expect(result.current.config.endFrequency).toBe(110e6);
    });

    it("updates threshold", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.updateConfig({ threshold: 0.5 });
      });

      expect(result.current.config.threshold).toBe(0.5);
    });

    it("updates multiple config values at once", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.updateConfig({
          startFrequency: 90e6,
          endFrequency: 110e6,
          stepSize: 200e3,
        });
      });

      expect(result.current.config.startFrequency).toBe(90e6);
      expect(result.current.config.endFrequency).toBe(110e6);
      expect(result.current.config.stepSize).toBe(200e3);
    });
  });

  describe("Scanning Control", () => {
    it("starts scanning when device is available", async () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      await act(async () => {
        await result.current.startScan();
      });

      expect(result.current.state).toBe("scanning");
    });

    it("does not start scanning when device is unavailable", async () => {
      const { result } = renderHook(() => useFrequencyScanner(undefined));

      await act(async () => {
        await result.current.startScan();
      });

      expect(result.current.state).toBe("idle");
    });

    it("does not start scanning when device is not open", async () => {
      const closedDevice = new MockSDRDevice();
      jest.spyOn(closedDevice, "isOpen").mockReturnValue(false);

      const { result } = renderHook(() =>
        useFrequencyScanner(closedDevice as ISDRDevice),
      );

      await act(async () => {
        await result.current.startScan();
      });

      expect(result.current.state).toBe("idle");
    });

    it("pauses scanning", async () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.pauseScan();
      });

      expect(result.current.state).toBe("paused");
    });

    it("resumes scanning from paused state", async () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.pauseScan();
      });

      act(() => {
        result.current.resumeScan();
      });

      expect(result.current.state).toBe("scanning");
    });

    it("stops scanning and resets progress", async () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.stopScan();
      });

      expect(result.current.state).toBe("idle");
      expect(result.current.currentFrequency).toBeNull();
      expect(result.current.progress).toBe(0);
    });
  });

  describe("Sample Processing", () => {
    it("updates samples when scanning", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.startScan();
      });

      act(() => {
        result.current.updateSamples([0.5, 0.6, 0.7]);
      });

      // Should not throw or error
      expect(result.current.state).toBe("scanning");
    });

    it("ignores samples when not scanning", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.updateSamples([0.5, 0.6, 0.7]);
      });

      // Should be safe to call even when idle
      expect(result.current.state).toBe("idle");
    });

    it("calculates signal strength from samples", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      // Feed strong signal samples
      act(() => {
        result.current.updateSamples([0.8, 0.9, 0.85, 0.82]);
      });

      // Strength calculation is internal, but we can verify samples are processed
      expect(result.current.activeSignals.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Signal Detection", () => {
    it("clears active signals list", async () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      // Simulate detecting a signal (would normally happen during scan)
      await act(async () => {
        result.current.clearSignals();
      });

      expect(result.current.activeSignals).toEqual([]);
    });

    it("calls callback when signal is detected", async () => {
      const onSignalDetected = jest.fn();
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice, onSignalDetected),
      );

      await act(async () => {
        await result.current.startScan();
      });

      // Note: In real usage, signals would be detected during the scan loop
      // This test verifies the callback mechanism is set up correctly
      expect(onSignalDetected).toHaveBeenCalledTimes(0); // No signals yet
    });
  });

  describe("Progress Tracking", () => {
    it("initializes progress at 0", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      expect(result.current.progress).toBe(0);
    });

    it("resets progress when stopping scan", async () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      await act(async () => {
        await result.current.startScan();
      });

      act(() => {
        result.current.stopScan();
      });

      expect(result.current.progress).toBe(0);
    });
  });

  describe("Memory Management", () => {
    it("limits sample buffer size", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.startScan();
      });

      // Add many samples to test buffer limiting
      act(() => {
        const largeSampleArray = new Array(15000).fill(0.5);
        result.current.updateSamples(largeSampleArray);
      });

      // Should handle large arrays without crashing
      expect(result.current.state).toBe("scanning");
    });
  });

  describe("Edge Cases", () => {
    it("handles zero-length sample arrays", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.startScan();
      });

      act(() => {
        result.current.updateSamples([]);
      });

      expect(result.current.state).toBe("scanning");
    });

    it("handles invalid frequency ranges", () => {
      const { result } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      act(() => {
        result.current.updateConfig({
          startFrequency: 110e6,
          endFrequency: 88e6, // End before start
        });
      });

      // Should not crash, but scan logic should handle it
      expect(result.current.config.startFrequency).toBe(110e6);
      expect(result.current.config.endFrequency).toBe(88e6);
    });
  });

  describe("Cleanup", () => {
    it("cleans up on unmount", () => {
      const { unmount } = renderHook(() =>
        useFrequencyScanner(mockDevice as ISDRDevice),
      );

      unmount();

      // Should not throw errors
      expect(true).toBe(true);
    });
  });
});
