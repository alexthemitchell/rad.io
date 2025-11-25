/**
 * Integration tests for useMultiVfoProcessor hook
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useMultiVfoProcessor } from "../useMultiVfoProcessor";
import { useStore } from "../../store";
import type { IQSample } from "../../models/SDRDevice";

// Mock FMDemodulatorPlugin
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockDemodulate = jest.fn().mockReturnValue(new Float32Array(1024));

jest.mock("../../plugins/demodulators/FMDemodulatorPlugin", () => ({
  FMDemodulatorPlugin: jest.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    activate: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
    setMode: jest.fn(),
    getParameters: jest.fn().mockReturnValue({ audioSampleRate: 48000 }),
    demodulate: mockDemodulate,
  })),
}));

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  state: "running",
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  createBuffer: jest.fn((_channels, _length, _rate) => ({
    copyToChannel: jest.fn(),
  })),
  createBufferSource: jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    onended: null,
  })),
  destination: {},
})) as unknown as typeof AudioContext;

// Mock Worker
global.Worker = jest.fn().mockImplementation(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
})) as unknown as typeof Worker;

describe("useMultiVfoProcessor", () => {
  beforeEach(() => {
    // Clear VFO store before each test
    const { clearVfos } = useStore.getState();
    clearVfos();
  });

  describe("Initialization", () => {
    it("should initialize processor on mount", () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Processor should be ready after initialization
      expect(result.current.isReady).toBe(true);
      expect(result.current.processSamples).toBeInstanceOf(Function);
    });

    it("should create audio context when audio is enabled", () => {
      renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: true,
        }),
      );

      // AudioContext should be created
      expect(AudioContext).toHaveBeenCalled();
    });

    it("should not create audio context when audio is disabled", () => {
      const audioContextSpy = jest.spyOn(global, "AudioContext");
      audioContextSpy.mockClear();

      renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // AudioContext should not be created
      expect(audioContextSpy).not.toHaveBeenCalled();
    });
  });

  describe("VFO Processing", () => {
    it("should process samples when VFOs exist", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Add a VFO
      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-1",
            centerHz: 100_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Test VFO",
          },
          {
            hardwareCenterHz: 100_000_000,
            sampleRateHz: 2_000_000,
          },
        );
      });

      // Create test IQ samples
      const samples: IQSample[] = [];
      for (let i = 0; i < 1024; i++) {
        samples.push({
          I: Math.sin((2 * Math.PI * i) / 100),
          Q: Math.cos((2 * Math.PI * i) / 100),
        });
      }

      // Wait for async VFO initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Process samples
      await act(async () => {
        await result.current.processSamples(samples);
      });

      // Verify VFO metrics were updated
      await waitFor(() => {
        const vfos = useStore.getState().getAllVfos();
        expect(vfos).toHaveLength(1);
        expect(vfos[0]?.metrics).toBeDefined();
        expect(vfos[0]?.metrics?.samplesProcessed).toBeGreaterThan(0);
      });
    });

    it("should handle multiple VFOs", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Add multiple VFOs
      act(() => {
        const { addVfo } = useStore.getState();
        const validationContext = {
          hardwareCenterHz: 100_000_000,
          sampleRateHz: 2_000_000,
        };

        addVfo(
          {
            id: "test-vfo-multi-1",
            centerHz: 99_900_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "VFO 1",
          },
          validationContext,
        );

        addVfo(
          {
            id: "test-vfo-multi-2",
            centerHz: 100_100_000,
            modeId: "nbfm",
            bandwidthHz: 12_500,
            audioEnabled: true,
            label: "VFO 2",
          },
          validationContext,
        );
      });

      // Create test IQ samples
      const samples: IQSample[] = [];
      for (let i = 0; i < 1024; i++) {
        samples.push({
          I: Math.sin((2 * Math.PI * i) / 100),
          Q: Math.cos((2 * Math.PI * i) / 100),
        });
      }

      // Wait for async VFO initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Process samples
      await act(async () => {
        await result.current.processSamples(samples);
      });

      // Verify both VFOs were processed
      await waitFor(() => {
        const vfos = useStore.getState().getAllVfos();
        expect(vfos).toHaveLength(2);
        expect(vfos[0]?.metrics?.samplesProcessed).toBeGreaterThan(0);
        expect(vfos[1]?.metrics?.samplesProcessed).toBeGreaterThan(0);
      });
    });

    it("should skip processing when no VFOs exist", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Create test IQ samples
      const samples: IQSample[] = [];
      for (let i = 0; i < 1024; i++) {
        samples.push({ I: Math.random(), Q: Math.random() });
      }

      // Process samples (should not throw)
      await act(async () => {
        await result.current.processSamples(samples);
      });

      // Verify no VFOs in store
      const vfos = useStore.getState().getAllVfos();
      expect(vfos).toHaveLength(0);
    });

    it("should only process VFOs with audio enabled", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Add VFOs with different audio states
      act(() => {
        const { addVfo } = useStore.getState();
        const validationContext = {
          hardwareCenterHz: 100_000_000,
          sampleRateHz: 2_000_000,
        };

        addVfo(
          {
            id: "test-vfo-enabled",
            centerHz: 99_900_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "VFO 1 (enabled)",
          },
          validationContext,
        );

        addVfo(
          {
            id: "test-vfo-disabled",
            centerHz: 100_100_000,
            modeId: "nbfm",
            bandwidthHz: 12_500,
            audioEnabled: false,
            label: "VFO 2 (disabled)",
          },
          validationContext,
        );
      });

      // Create test IQ samples
      const samples: IQSample[] = [];
      for (let i = 0; i < 1024; i++) {
        samples.push({ I: Math.random(), Q: Math.random() });
      }

      // Wait for async VFO initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Process samples
      await act(async () => {
        await result.current.processSamples(samples);
      });

      // Verify only enabled VFO was processed
      await waitFor(() => {
        const vfos = useStore.getState().getAllVfos();
        const enabledVfo = vfos.find((v) => v.audioEnabled);
        const disabledVfo = vfos.find((v) => !v.audioEnabled);

        expect(enabledVfo?.metrics?.samplesProcessed).toBeGreaterThan(0);
        // Disabled VFO should not have metrics updated (or remain at initial 0)
        expect(disabledVfo?.metrics?.samplesProcessed).toBe(0);
      });
    });

    it("should handle fallback for unsupported modes", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      act(() => {
        const { addVfo } = useStore.getState();
        const validationContext = {
          hardwareCenterHz: 100_000_000,
          sampleRateHz: 2_000_000,
        };

        addVfo(
          {
            id: "test-vfo-am",
            centerHz: 100_000_000,
            modeId: "am",
            bandwidthHz: 10_000,
            audioEnabled: true,
            label: "AM VFO",
          },
          validationContext,
        );

        addVfo(
          {
            id: "test-vfo-usb",
            centerHz: 100_100_000,
            modeId: "usb",
            bandwidthHz: 3_000,
            audioEnabled: true,
            label: "USB VFO",
          },
          validationContext,
        );
      });

      // Wait for async VFO initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("should handle VFO removal", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-remove",
            centerHz: 100_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Test VFO",
          },
          {
            hardwareCenterHz: 100_000_000,
            sampleRateHz: 2_000_000,
          },
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      act(() => {
        const { removeVfo } = useStore.getState();
        removeVfo("test-vfo-remove");
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should have cleaned up
      const vfos = useStore.getState().getAllVfos();
      expect(vfos).toHaveLength(0);
    });

    it("should handle VFO mode change", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-mode-change",
            centerHz: 100_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Test VFO",
          },
          {
            hardwareCenterHz: 100_000_000,
            sampleRateHz: 2_000_000,
          },
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      act(() => {
        const { updateVfo } = useStore.getState();
        updateVfo("test-vfo-mode-change", { modeId: "nbfm" });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const vfos = useStore.getState().getAllVfos();
      expect(vfos[0]?.modeId).toBe("nbfm");
    });

    it("should handle VFO update without mode change", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-update",
            centerHz: 100_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Test VFO",
          },
          { hardwareCenterHz: 100_000_000, sampleRateHz: 2_000_000 },
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      act(() => {
        const { updateVfo } = useStore.getState();
        updateVfo("test-vfo-update", { centerHz: 100_100_000 });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const vfos = useStore.getState().getAllVfos();
      expect(vfos[0]?.centerHz).toBe(100_100_000);
    });

    it("should handle empty samples", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      await act(async () => {
        await result.current.processSamples([]);
      });
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle demodulator initialization failure", async () => {
      mockInitialize.mockRejectedValueOnce(new Error("Init failed"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-fail",
            centerHz: 100_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Fail VFO",
          },
          { hardwareCenterHz: 100_000_000, sampleRateHz: 2_000_000 },
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to initialize demodulator"),
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it("should not process samples if processor is not ready", async () => {
      const { result, unmount } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );
      
      const processSamples = result.current.processSamples;
      unmount();
      
      // Should return early and not throw
      await act(async () => {
        await processSamples([{ I: 0, Q: 0 }]);
      });
    });

    it("should handle unknown VFO mode", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-unknown",
            centerHz: 100_000_000,
            modeId: "unknown-mode",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Unknown VFO",
          },
          { hardwareCenterHz: 100_000_000, sampleRateHz: 2_000_000 },
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown VFO mode"),
      );
      consoleErrorSpy.mockRestore();
    });
    it("should skip VFOs with missing demodulators during processing", async () => {
      const { result } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Add a VFO with unknown mode (will fail to create demodulator)
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-missing-demod",
            centerHz: 100_000_000,
            modeId: "unknown-mode",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Unknown VFO",
          },
          { hardwareCenterHz: 100_000_000, sampleRateHz: 2_000_000 },
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Process samples
      await act(async () => {
        await result.current.processSamples([{ I: 0, Q: 0 }]);
      });

      // Should not throw and should handle the missing demodulator gracefully
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup demodulators on unmount", async () => {
      const { unmount } = renderHook(() =>
        useMultiVfoProcessor({
          centerFrequencyHz: 100_000_000,
          sampleRate: 2_000_000,
          enableAudio: false,
        }),
      );

      // Add a VFO to create demodulator
      act(() => {
        const { addVfo } = useStore.getState();
        addVfo(
          {
            id: "test-vfo-cleanup",
            centerHz: 100_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
            label: "Test VFO",
          },
          {
            hardwareCenterHz: 100_000_000,
            sampleRateHz: 2_000_000,
          },
        );
      });

      // Wait for demodulator creation
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Unmount should trigger cleanup
      unmount();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
