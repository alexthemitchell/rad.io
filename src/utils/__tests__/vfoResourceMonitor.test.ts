/**
 * Tests for VFO Resource Monitor
 */

import { VfoStatus, VfoResourceWarning } from "../../types/vfo";
import type { VfoState } from "../../types/vfo";
import {
  calculateTotalDspTime,
  estimateVfoMemoryUsage,
  countAudioStreams,
  checkVfoResources,
  getWarningMessage,
  logResourceWarnings,
  suggestVfoToPause,
} from "../vfoResourceMonitor";
import {
  DSP_TIME_WARNING_THRESHOLD_MS,
  DSP_TIME_CRITICAL_THRESHOLD_MS,
  MEMORY_WARNING_THRESHOLD_BYTES,
  MAX_CONCURRENT_AUDIO_VFOS,
} from "../../constants/vfoLimits";

// Helper to create mock VFO state
function createMockVfo(overrides: Partial<VfoState> = {}): VfoState {
  return {
    id: `vfo-${Math.random()}`,
    centerHz: 100_000_000,
    modeId: "am",
    bandwidthHz: 10_000,
    audioEnabled: false,
    status: VfoStatus.ACTIVE,
    demodulator: null,
    audioNode: null,
    metrics: {
      rssi: -50,
      samplesProcessed: 1024,
      processingTime: 1.0,
      timestamp: Date.now(),
    },
    audioGain: 1.0,
    priority: 5,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("vfoResourceMonitor", () => {
  describe("calculateTotalDspTime", () => {
    it("should return 0 for empty array", () => {
      expect(calculateTotalDspTime([])).toBe(0);
    });

    it("should sum processing times from all VFOs", () => {
      const vfos = [
        createMockVfo({
          metrics: { ...createMockVfo().metrics, processingTime: 2.0 },
        }),
        createMockVfo({
          metrics: { ...createMockVfo().metrics, processingTime: 3.5 },
        }),
        createMockVfo({
          metrics: { ...createMockVfo().metrics, processingTime: 1.5 },
        }),
      ];
      expect(calculateTotalDspTime(vfos)).toBe(7.0);
    });

    it("should handle VFOs with 0 processing time", () => {
      const vfos = [
        createMockVfo({
          metrics: { ...createMockVfo().metrics, processingTime: 0 },
        }),
        createMockVfo({
          metrics: { ...createMockVfo().metrics, processingTime: 5.0 },
        }),
      ];
      expect(calculateTotalDspTime(vfos)).toBe(5.0);
    });
  });

  describe("estimateVfoMemoryUsage", () => {
    it("should return 0 for 0 VFOs", () => {
      expect(estimateVfoMemoryUsage(0)).toBe(0);
    });

    it("should estimate memory linearly", () => {
      const perVfo = estimateVfoMemoryUsage(1);
      expect(estimateVfoMemoryUsage(4)).toBe(perVfo * 4);
      expect(estimateVfoMemoryUsage(8)).toBe(perVfo * 8);
    });

    it("should return positive values", () => {
      expect(estimateVfoMemoryUsage(1)).toBeGreaterThan(0);
      expect(estimateVfoMemoryUsage(10)).toBeGreaterThan(0);
    });
  });

  describe("countAudioStreams", () => {
    it("should return 0 for empty array", () => {
      expect(countAudioStreams([])).toBe(0);
    });

    it("should count only VFOs with audio enabled", () => {
      const vfos = [
        createMockVfo({ audioEnabled: true }),
        createMockVfo({ audioEnabled: false }),
        createMockVfo({ audioEnabled: true }),
        createMockVfo({ audioEnabled: true }),
      ];
      expect(countAudioStreams(vfos)).toBe(3);
    });

    it("should return 0 when no audio enabled", () => {
      const vfos = [
        createMockVfo({ audioEnabled: false }),
        createMockVfo({ audioEnabled: false }),
      ];
      expect(countAudioStreams(vfos)).toBe(0);
    });
  });

  describe("checkVfoResources", () => {
    it("should return no warnings for healthy state", () => {
      const vfos = [
        createMockVfo({
          audioEnabled: true,
          metrics: { ...createMockVfo().metrics, processingTime: 1.0 },
        }),
        createMockVfo({
          audioEnabled: false,
          metrics: { ...createMockVfo().metrics, processingTime: 1.5 },
        }),
      ];

      const stats = checkVfoResources(vfos);
      expect(stats.warnings).toEqual([]);
      expect(stats.totalDspTime).toBe(2.5);
      expect(stats.audioStreamCount).toBe(1);
    });

    it("should warn when DSP time exceeds warning threshold", () => {
      const vfos = [
        createMockVfo({
          metrics: {
            ...createMockVfo().metrics,
            processingTime: DSP_TIME_WARNING_THRESHOLD_MS,
          },
        }),
      ];

      const stats = checkVfoResources(vfos);
      expect(stats.warnings).toContain(VfoResourceWarning.DSP_TIME_WARNING);
      expect(stats.warnings).not.toContain(
        VfoResourceWarning.DSP_TIME_CRITICAL,
      );
    });

    it("should issue critical warning when DSP time exceeds critical threshold", () => {
      const vfos = [
        createMockVfo({
          metrics: {
            ...createMockVfo().metrics,
            processingTime: DSP_TIME_CRITICAL_THRESHOLD_MS,
          },
        }),
      ];

      const stats = checkVfoResources(vfos);
      expect(stats.warnings).toContain(VfoResourceWarning.DSP_TIME_CRITICAL);
      // Critical warning should override regular warning
      expect(stats.warnings).not.toContain(VfoResourceWarning.DSP_TIME_WARNING);
    });

    it("should warn when too many audio streams", () => {
      const vfos = Array.from({ length: MAX_CONCURRENT_AUDIO_VFOS + 1 }, () =>
        createMockVfo({
          audioEnabled: true,
          metrics: { ...createMockVfo().metrics, processingTime: 0.5 },
        }),
      );

      const stats = checkVfoResources(vfos);
      expect(stats.warnings).toContain(VfoResourceWarning.AUDIO_LIMIT);
      expect(stats.audioStreamCount).toBe(MAX_CONCURRENT_AUDIO_VFOS + 1);
    });

    it("should handle multiple simultaneous warnings", () => {
      const vfos = Array.from({ length: MAX_CONCURRENT_AUDIO_VFOS + 1 }, () =>
        createMockVfo({
          audioEnabled: true,
          metrics: {
            ...createMockVfo().metrics,
            processingTime:
              DSP_TIME_WARNING_THRESHOLD_MS / (MAX_CONCURRENT_AUDIO_VFOS + 1) +
              0.5,
          },
        }),
      );

      const stats = checkVfoResources(vfos);
      expect(stats.warnings.length).toBeGreaterThan(0);
      // Should have both DSP and audio warnings
      expect(
        stats.warnings.includes(VfoResourceWarning.DSP_TIME_WARNING) ||
          stats.warnings.includes(VfoResourceWarning.DSP_TIME_CRITICAL),
      ).toBe(true);
      expect(stats.warnings).toContain(VfoResourceWarning.AUDIO_LIMIT);
    });

    it("should include timestamp in stats", () => {
      const before = Date.now();
      const stats = checkVfoResources([]);
      const after = Date.now();

      expect(stats.timestamp).toBeGreaterThanOrEqual(before);
      expect(stats.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("getWarningMessage", () => {
    it("should return empty string for NONE warning", () => {
      const stats = {
        totalDspTime: 1.0,
        estimatedMemory: 1000,
        audioStreamCount: 1,
        warnings: [],
        timestamp: Date.now(),
      };
      expect(getWarningMessage(VfoResourceWarning.NONE, stats)).toBe("");
    });

    it("should return message for DSP_TIME_WARNING", () => {
      const stats = {
        totalDspTime: DSP_TIME_WARNING_THRESHOLD_MS,
        estimatedMemory: 1000,
        audioStreamCount: 1,
        warnings: [VfoResourceWarning.DSP_TIME_WARNING],
        timestamp: Date.now(),
      };
      const message = getWarningMessage(
        VfoResourceWarning.DSP_TIME_WARNING,
        stats,
      );
      expect(message).toContain("High CPU usage");
      expect(message).toContain(DSP_TIME_WARNING_THRESHOLD_MS.toFixed(1));
    });

    it("should return message for DSP_TIME_CRITICAL", () => {
      const stats = {
        totalDspTime: DSP_TIME_CRITICAL_THRESHOLD_MS,
        estimatedMemory: 1000,
        audioStreamCount: 1,
        warnings: [VfoResourceWarning.DSP_TIME_CRITICAL],
        timestamp: Date.now(),
      };
      const message = getWarningMessage(
        VfoResourceWarning.DSP_TIME_CRITICAL,
        stats,
      );
      expect(message).toContain("Critical CPU usage");
      expect(message).toContain(DSP_TIME_CRITICAL_THRESHOLD_MS.toFixed(1));
    });

    it("should return message for MEMORY_WARNING", () => {
      const stats = {
        totalDspTime: 1.0,
        estimatedMemory: MEMORY_WARNING_THRESHOLD_BYTES,
        audioStreamCount: 1,
        warnings: [VfoResourceWarning.MEMORY_WARNING],
        timestamp: Date.now(),
      };
      const message = getWarningMessage(
        VfoResourceWarning.MEMORY_WARNING,
        stats,
      );
      expect(message).toContain("High memory usage");
      expect(message).toContain("MB");
    });

    it("should return message for AUDIO_LIMIT", () => {
      const stats = {
        totalDspTime: 1.0,
        estimatedMemory: 1000,
        audioStreamCount: MAX_CONCURRENT_AUDIO_VFOS + 1,
        warnings: [VfoResourceWarning.AUDIO_LIMIT],
        timestamp: Date.now(),
      };
      const message = getWarningMessage(VfoResourceWarning.AUDIO_LIMIT, stats);
      expect(message).toContain("Too many audio streams");
      expect(message).toContain((MAX_CONCURRENT_AUDIO_VFOS + 1).toString());
    });
  });

  describe("logResourceWarnings", () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("should not log when no warnings", () => {
      const stats = {
        totalDspTime: 1.0,
        estimatedMemory: 1000,
        audioStreamCount: 1,
        warnings: [],
        timestamp: Date.now(),
      };
      logResourceWarnings(stats);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should log each warning", () => {
      const stats = {
        totalDspTime: DSP_TIME_CRITICAL_THRESHOLD_MS,
        estimatedMemory: 1000,
        audioStreamCount: MAX_CONCURRENT_AUDIO_VFOS + 1,
        warnings: [
          VfoResourceWarning.DSP_TIME_CRITICAL,
          VfoResourceWarning.AUDIO_LIMIT,
        ],
        timestamp: Date.now(),
      };
      logResourceWarnings(stats);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it("should not log NONE warning type", () => {
      const stats = {
        totalDspTime: 1.0,
        estimatedMemory: 1000,
        audioStreamCount: 1,
        warnings: [VfoResourceWarning.NONE],
        timestamp: Date.now(),
      };
      logResourceWarnings(stats);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("suggestVfoToPause", () => {
    it("should return null for empty array", () => {
      expect(suggestVfoToPause([])).toBeNull();
    });

    it("should suggest lowest priority VFO", () => {
      const vfos = [
        createMockVfo({ id: "vfo-high", priority: 10 }),
        createMockVfo({ id: "vfo-low", priority: 1 }),
        createMockVfo({ id: "vfo-mid", priority: 5 }),
      ];
      expect(suggestVfoToPause(vfos)).toBe("vfo-low");
    });

    it("should suggest oldest VFO when priorities are equal", () => {
      const now = Date.now();
      const vfos = [
        createMockVfo({ id: "vfo-new", priority: 5, createdAt: now }),
        createMockVfo({ id: "vfo-old", priority: 5, createdAt: now - 10000 }),
        createMockVfo({ id: "vfo-mid", priority: 5, createdAt: now - 5000 }),
      ];
      expect(suggestVfoToPause(vfos)).toBe("vfo-old");
    });

    it("should prioritize priority over age", () => {
      const now = Date.now();
      const vfos = [
        createMockVfo({
          id: "vfo-old-high",
          priority: 10,
          createdAt: now - 10000,
        }),
        createMockVfo({ id: "vfo-new-low", priority: 1, createdAt: now }),
      ];
      expect(suggestVfoToPause(vfos)).toBe("vfo-new-low");
    });

    it("should handle VFOs with default priority (5)", () => {
      const vfos = [
        createMockVfo({ id: "vfo-1" }),
        createMockVfo({ id: "vfo-2" }),
      ];
      const result = suggestVfoToPause(vfos);
      expect(result).toBeTruthy();
      expect(["vfo-1", "vfo-2"]).toContain(result!);
    });

    it("should handle undefined priority as default (5)", () => {
      const now = Date.now();
      const vfos = [
        createMockVfo({ id: "vfo-explicit", priority: 5, createdAt: now }),
        createMockVfo({
          id: "vfo-undefined",
          priority: undefined,
          createdAt: now - 1000,
        }),
      ];
      // Both have effective priority 5, so older one should be suggested
      expect(suggestVfoToPause(vfos)).toBe("vfo-undefined");
    });
  });
});
