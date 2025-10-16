/**
 * Tests for RecordingManager
 */

import { RecordingManager, RecordingState } from "../recordingManager";
import type { IQSample } from "../../models/SDRDevice";

describe("RecordingManager", () => {
  let manager: RecordingManager;

  beforeEach(() => {
    manager = new RecordingManager();
  });

  describe("Recording Lifecycle", () => {
    it("should start in IDLE state", () => {
      expect(manager.getState()).toBe(RecordingState.IDLE);
      expect(manager.isRecording()).toBe(false);
    });

    it("should start recording with correct metadata", () => {
      const frequency = 100e6;
      const sampleRate = 20e6;
      const description = "Test recording";

      manager.startRecording(frequency, sampleRate, description);

      expect(manager.getState()).toBe(RecordingState.RECORDING);
      expect(manager.isRecording()).toBe(true);
      expect(manager.getSampleCount()).toBe(0);
    });

    it("should throw error when starting recording while already recording", () => {
      manager.startRecording(100e6, 20e6);
      expect(() => manager.startRecording(100e6, 20e6)).toThrow(
        "Recording already in progress",
      );
    });

    it("should stop recording", () => {
      manager.startRecording(100e6, 20e6);
      manager.stopRecording();

      expect(manager.getState()).toBe(RecordingState.STOPPED);
      expect(manager.isRecording()).toBe(false);
    });

    it("should throw error when stopping without active recording", () => {
      expect(() => manager.stopRecording()).toThrow("No recording in progress");
    });

    it("should reset to IDLE state", () => {
      manager.startRecording(100e6, 20e6);
      manager.addSamples([{ I: 0.5, Q: 0.5 }]);
      manager.stopRecording();
      manager.reset();

      expect(manager.getState()).toBe(RecordingState.IDLE);
      expect(manager.getSampleCount()).toBe(0);
      expect(manager.getDuration()).toBe(0);
    });
  });

  describe("Sample Recording", () => {
    const testSamples: IQSample[] = [
      { I: 0.1, Q: 0.2 },
      { I: 0.3, Q: 0.4 },
      { I: 0.5, Q: 0.6 },
    ];

    it("should add samples during recording", () => {
      manager.startRecording(100e6, 20e6);
      manager.addSamples(testSamples);

      expect(manager.getSampleCount()).toBe(testSamples.length);
    });

    it("should not add samples when not recording", () => {
      manager.addSamples(testSamples);
      expect(manager.getSampleCount()).toBe(0);
    });

    it("should accumulate samples across multiple calls", () => {
      manager.startRecording(100e6, 20e6);
      manager.addSamples(testSamples);
      manager.addSamples(testSamples);

      expect(manager.getSampleCount()).toBe(testSamples.length * 2);
    });
  });

  describe("Duration Calculation", () => {
    it("should calculate duration based on sample count and rate", () => {
      const sampleRate = 20e6;
      const sampleCount = 1000;
      const expectedDuration = sampleCount / sampleRate;

      manager.startRecording(100e6, sampleRate);
      const samples = new Array(sampleCount).fill({ I: 0, Q: 0 });
      manager.addSamples(samples);
      manager.stopRecording();

      expect(manager.getDuration()).toBeCloseTo(expectedDuration, 6);
    });

    it("should return 0 duration for IDLE state", () => {
      expect(manager.getDuration()).toBe(0);
    });
  });

  describe("Export Functionality", () => {
    it("should export recording with correct metadata", () => {
      const frequency = 100e6;
      const sampleRate = 20e6;
      const description = "Test recording";

      manager.startRecording(frequency, sampleRate, description);
      manager.addSamples([{ I: 0.1, Q: 0.2 }]);
      manager.stopRecording();

      const recording = manager.exportRecording();

      expect(recording.metadata.version).toBe("1.0");
      expect(recording.metadata.frequency).toBe(frequency);
      expect(recording.metadata.sampleRate).toBe(sampleRate);
      expect(recording.metadata.description).toBe(description);
      expect(recording.metadata.sampleCount).toBe(1);
      expect(recording.samples).toHaveLength(1);
    });

    it("should throw error when exporting without recording", () => {
      expect(() => manager.exportRecording()).toThrow("No recording to export");
    });

    it("should export as valid JSON string", () => {
      manager.startRecording(100e6, 20e6);
      manager.addSamples([{ I: 0.1, Q: 0.2 }]);
      manager.stopRecording();

      const json = manager.exportAsJSON();
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.samples).toBeDefined();
      expect(Array.isArray(parsed.samples)).toBe(true);
    });

    it("should export as Blob with correct type", () => {
      manager.startRecording(100e6, 20e6);
      manager.addSamples([{ I: 0.1, Q: 0.2 }]);
      manager.stopRecording();

      const blob = manager.exportAsBlob();

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
    });

    it("should include timestamp in ISO format", () => {
      manager.startRecording(100e6, 20e6);
      manager.stopRecording();

      const recording = manager.exportRecording();
      const timestamp = new Date(recording.metadata.timestamp);

      expect(timestamp.toISOString()).toBe(recording.metadata.timestamp);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty recordings", () => {
      manager.startRecording(100e6, 20e6);
      manager.stopRecording();

      const recording = manager.exportRecording();

      expect(recording.samples).toHaveLength(0);
      expect(recording.metadata.sampleCount).toBe(0);
    });

    it("should handle large sample counts", () => {
      manager.startRecording(100e6, 20e6);

      // Add 1000 samples in chunks
      for (let i = 0; i < 10; i++) {
        const chunk = new Array(100).fill({ I: 0, Q: 0 });
        manager.addSamples(chunk);
      }

      expect(manager.getSampleCount()).toBe(1000);
    });
  });
});
