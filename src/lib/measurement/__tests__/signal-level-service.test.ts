/**
 * Unit tests for SignalLevelService
 */

import { SignalLevelService } from "../signal-level-service";
import type { Sample } from "../../dsp/types";
import type { SignalLevel } from "../types";

describe("SignalLevelService", () => {
  // Helper to create mock IQ samples
  const createMockSamples = (amplitude = 0.5, count = 1000): Sample[] => {
    const samples: Sample[] = [];
    for (let i = 0; i < count; i++) {
      const phase = (i / count) * 2 * Math.PI;
      samples.push({
        I: amplitude * Math.cos(phase),
        Q: amplitude * Math.sin(phase),
      });
    }
    return samples;
  };

  beforeEach(() => {
    // Clear any timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Constructor and Configuration", () => {
    it("should create service with default update interval", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const config = service.getConfig();
      expect(config.updateIntervalMs).toBe(100); // Default
      expect(config.frequencyHz).toBe(100e6);
      expect(config.calibration.kCal).toBe(-60);
    });

    it("should create service with custom update interval", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -70,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "signal-generator",
          accuracyDb: 2,
        },
        frequencyHz: 145e6,
        updateIntervalMs: 250,
      });

      const config = service.getConfig();
      expect(config.updateIntervalMs).toBe(250);
    });
  });

  describe("Subscribe/Unsubscribe", () => {
    it("should allow subscribing to updates", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const callback = jest.fn();
      service.subscribe(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should allow unsubscribing", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const callback = jest.fn();
      const unsubscribe = service.subscribe(callback);

      unsubscribe();

      // Start service - callback should not be called after unsubscribe
      service.start(() => createMockSamples());
      jest.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();

      service.stop();
    });
  });

  describe("Start/Stop", () => {
    it("should start and stop successfully", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      expect(service.isRunning()).toBe(false);

      service.start(() => createMockSamples());
      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it("should not start twice", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      service.start(() => createMockSamples());
      service.start(() => createMockSamples()); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(
        "SignalLevelService is already running",
      );

      service.stop();
      consoleSpy.mockRestore();
    });

    it("should emit updates on interval", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
        updateIntervalMs: 100,
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => createMockSamples(0.5));

      // Initial sample happens immediately
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance timer by interval
      jest.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(3);

      service.stop();
    });

    it("should handle empty samples gracefully", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => []); // Empty samples

      // Should not call callback with empty samples
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(callback).not.toHaveBeenCalled();

      service.stop();
    });
  });

  describe("Signal Level Calculation", () => {
    it("should calculate correct signal level for VHF band", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "signal-generator",
          accuracyDb: 2,
        },
        frequencyHz: 100e6, // VHF
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => createMockSamples(0.5));

      expect(callback).toHaveBeenCalled();
      const level: SignalLevel = callback.mock.calls[0][0];

      expect(level.band).toBe("VHF");
      expect(level.dBfs).toBeLessThan(0);
      expect(level.dBmApprox).toBeLessThan(level.dBfs); // dBm = dBFS + kCal (kCal is negative)
      expect(level.sUnit).toBeGreaterThanOrEqual(0);
      expect(level.sUnit).toBeLessThanOrEqual(9);
      expect(level.calibrationStatus).toBe("user"); // signal-generator method
      expect(level.uncertaintyDb).toBe(2);
      expect(level.timestamp).toBeGreaterThan(0);

      service.stop();
    });

    it("should calculate correct signal level for HF band", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -50,
          frequencyRange: { min: 1e6, max: 30e6 },
          method: "reference-station",
          accuracyDb: 5,
        },
        frequencyHz: 14e6, // HF (14 MHz)
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => createMockSamples(0.3));

      expect(callback).toHaveBeenCalled();
      const level: SignalLevel = callback.mock.calls[0][0];

      expect(level.band).toBe("HF");
      expect(level.calibrationStatus).toBe("factory"); // reference-station method

      service.stop();
    });

    it("should handle strong signals (S9+)", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -30, // High calibration constant for strong signal
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => createMockSamples(0.8)); // Strong signal

      const level: SignalLevel = callback.mock.calls[0][0];

      expect(level.sUnit).toBe(9);
      expect(level.overS9).toBeGreaterThan(0); // Above S9

      service.stop();
    });
  });

  describe("Configuration Updates", () => {
    it("should update calibration", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      service.updateConfig({
        calibration: {
          kCal: -70,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "signal-generator",
          accuracyDb: 2,
        },
      });

      const config = service.getConfig();
      expect(config.calibration.kCal).toBe(-70);
      expect(config.calibration.method).toBe("signal-generator");
    });

    it("should update frequency", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      service.updateConfig({ frequencyHz: 145e6 });

      const config = service.getConfig();
      expect(config.frequencyHz).toBe(145e6);
    });

    it("should update calibration offset", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
        calibrationOffsetDb: 0,
      });

      service.updateConfig({ calibrationOffsetDb: 5 });

      const config = service.getConfig();
      expect(config.calibrationOffsetDb).toBe(5);
    });

    it("should apply calibration offset to signal measurements", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
        calibrationOffsetDb: 10, // +10 dB offset
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => createMockSamples(0.5));

      expect(callback).toHaveBeenCalled();
      const level: SignalLevel = callback.mock.calls[0][0];

      // The dBm value should include the calibration offset
      // dBm = dBFS + kCal + calibrationOffset
      // With +10 dB offset, the dBm should be 10 dB higher
      expect(level.dBmApprox).toBeGreaterThan(level.dBfs + -60);

      service.stop();
    });

    it("should update interval and restart if running", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
        updateIntervalMs: 100,
      });

      const callback = jest.fn();
      service.subscribe(callback);

      service.start(() => createMockSamples());

      // Update interval while running
      service.updateConfig({ updateIntervalMs: 200 });

      expect(service.isRunning()).toBe(true);

      const config = service.getConfig();
      expect(config.updateIntervalMs).toBe(200);

      service.stop();
    });
  });

  describe("Cleanup", () => {
    it("should destroy cleanly", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const callback = jest.fn();
      service.subscribe(callback);
      service.start(() => createMockSamples());

      service.destroy();

      expect(service.isRunning()).toBe(false);

      // Advancing timer should not trigger callbacks after destroy
      jest.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe("Error Handling", () => {
    it("should handle sample provider errors", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      service.start(() => {
        throw new Error("Sample provider error");
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error sampling signal level:",
        expect.any(Error),
      );

      service.stop();
      consoleSpy.mockRestore();
    });

    it("should handle callback errors without stopping service", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6,
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const badCallback = jest.fn(() => {
        throw new Error("Callback error");
      });
      const goodCallback = jest.fn();

      service.subscribe(badCallback);
      service.subscribe(goodCallback);

      service.start(() => createMockSamples());

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error in SignalLevel subscriber callback:",
        expect.any(Error),
      );
      expect(goodCallback).toHaveBeenCalled(); // Good callback still executed

      service.stop();
      consoleSpy.mockRestore();
    });
  });

  describe("Band Detection", () => {
    it("should correctly identify HF band for frequencies below 30 MHz", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 1e6, max: 30e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 14e6, // 14 MHz - HF
      });

      const callback = jest.fn();
      service.subscribe(callback);
      service.start(() => createMockSamples(0.5));

      expect(callback).toHaveBeenCalled();
      const level: SignalLevel = callback.mock.calls[0][0];
      expect(level.band).toBe("HF");

      service.stop();
    });

    it("should correctly identify VHF band for frequencies at or above 30 MHz", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -70,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 100e6, // 100 MHz - VHF
      });

      const callback = jest.fn();
      service.subscribe(callback);
      service.start(() => createMockSamples(0.5));

      expect(callback).toHaveBeenCalled();
      const level: SignalLevel = callback.mock.calls[0][0];
      expect(level.band).toBe("VHF");

      service.stop();
    });

    it("should treat 30 MHz exactly as VHF band boundary", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -65,
          frequencyRange: { min: 28e6, max: 32e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 30e6, // Exactly 30 MHz
      });

      const callback = jest.fn();
      service.subscribe(callback);
      service.start(() => createMockSamples(0.5));

      expect(callback).toHaveBeenCalled();
      const level: SignalLevel = callback.mock.calls[0][0];
      expect(level.band).toBe("VHF"); // >= 30 MHz is VHF

      service.stop();
    });

    it("should update band when frequency changes", () => {
      const service = new SignalLevelService({
        calibration: {
          kCal: -60,
          frequencyRange: { min: 1e6, max: 200e6 },
          method: "default",
          accuracyDb: 10,
        },
        frequencyHz: 14e6, // Start with HF
      });

      const callback = jest.fn();
      service.subscribe(callback);
      service.start(() => createMockSamples(0.5));

      // Check initial HF band
      expect(callback).toHaveBeenCalled();
      let level: SignalLevel = callback.mock.calls[0][0];
      expect(level.band).toBe("HF");

      callback.mockClear();

      // Update to VHF frequency
      service.updateConfig({ frequencyHz: 145e6 });

      // Trigger another measurement
      jest.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalled();
      level = callback.mock.calls[0][0];
      expect(level.band).toBe("VHF");

      service.stop();
    });
  });
});
