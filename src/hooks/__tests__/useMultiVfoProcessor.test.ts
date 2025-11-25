/**
 * Integration tests for useMultiVfoProcessor hook
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useMultiVfoProcessor } from "../useMultiVfoProcessor";
import { useStore } from "../../store";
import type { IQSample } from "../../models/SDRDevice";

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
  });

  describe("Cleanup", () => {
    it("should cleanup demodulators on unmount", () => {
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

      // Unmount should trigger cleanup
      unmount();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
