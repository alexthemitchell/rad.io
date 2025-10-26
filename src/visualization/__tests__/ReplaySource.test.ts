/**
 * Tests for ReplaySource
 */

import { type IQSample } from "../../models/SDRDevice";
import { type IQRecording } from "../../utils/iqRecorder";
import { ReplaySource } from "../ReplaySource";

describe("ReplaySource", () => {
  const sampleRate = 2048000;
  const frequency = 100e6;
  const signalType = "FM";
  const deviceName = "HackRF One";

  /**
   * Create a test recording with specified number of samples
   */
  function createTestRecording(
    sampleCount: number,
    pattern: "sine" | "noise" = "sine",
  ): IQRecording {
    const samples: IQSample[] = [];

    for (let i = 0; i < sampleCount; i++) {
      if (pattern === "sine") {
        // Simple sine wave
        const t = i / sampleRate;
        const freq = 1000; // 1 kHz
        samples.push({
          I: Math.cos(2 * Math.PI * freq * t),
          Q: Math.sin(2 * Math.PI * freq * t),
        });
      } else {
        // Random noise
        samples.push({
          I: Math.random() * 2 - 1,
          Q: Math.random() * 2 - 1,
        });
      }
    }

    return {
      metadata: {
        sampleRate,
        frequency,
        signalType,
        deviceName,
        timestamp: new Date().toISOString(),
        duration: sampleCount / sampleRate,
        sampleCount,
      },
      samples,
    };
  }

  describe("constructor", () => {
    it("should create a replay source with default chunk size", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);

      expect(source).toBeInstanceOf(ReplaySource);
      expect(source.isStreaming()).toBe(false);
    });

    it("should create a replay source with custom chunk size", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, 512);

      expect(source).toBeInstanceOf(ReplaySource);
    });
  });

  describe("getMetadata", () => {
    it("should return recording metadata", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);
      const metadata = source.getMetadata();

      expect(metadata.name).toBe("Replay Source");
      expect(metadata.sampleRate).toBe(sampleRate);
      expect(metadata.centerFrequency).toBe(frequency);
      expect(metadata["signalType"]).toBe(signalType);
      expect(metadata["deviceName"]).toBe(deviceName);
      expect(metadata["timestamp"]).toBeDefined();
      expect(metadata["duration"]).toBeDefined();
    });
  });

  describe("streaming lifecycle", () => {
    it("should start streaming and deliver samples", (done) => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, 512);

      let callCount = 0;
      const callback = (samples: IQSample[]) => {
        callCount++;
        expect(samples.length).toBeGreaterThan(0);
        expect(samples.length).toBeLessThanOrEqual(512);

        // After receiving some chunks, stop
        if (callCount >= 2) {
          void source.stopStreaming().then(() => {
            expect(source.isStreaming()).toBe(false);
            done();
          });
        }
      };

      void source.startStreaming(callback).then(() => {
        expect(source.isStreaming()).toBe(true);
      });
    });

    it("should not start streaming if already streaming", async () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, 512);

      const callback = jest.fn();

      await source.startStreaming(callback);
      expect(source.isStreaming()).toBe(true);

      // Try to start again
      await source.startStreaming(callback);
      expect(source.isStreaming()).toBe(true);

      await source.stopStreaming();
    });

    it("should stop streaming", async () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, 512);

      await source.startStreaming(jest.fn());
      expect(source.isStreaming()).toBe(true);

      await source.stopStreaming();
      expect(source.isStreaming()).toBe(false);
    });

    it("should handle stopStreaming when not streaming", async () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);

      await expect(source.stopStreaming()).resolves.toBeUndefined();
      expect(source.isStreaming()).toBe(false);
    });
  });

  describe("playback control", () => {
    it("should pause and resume playback", async () => {
      const recording = createTestRecording(2048);
      const source = new ReplaySource(recording, 512);

      await source.startStreaming(jest.fn());
      expect(source.isStreaming()).toBe(true);

      source.pause();
      expect(source.isStreaming()).toBe(false);

      source.resume();
      expect(source.isStreaming()).toBe(true);

      await source.stopStreaming();
    });

    it("should get playback progress", async () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, 512);

      expect(source.getProgress()).toBe(0);

      await source.startStreaming(jest.fn());

      // Wait a bit for some playback
      await new Promise((resolve) => setTimeout(resolve, 100));

      const progress = source.getProgress();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);

      await source.stopStreaming();
    });

    it("should get current playback time", async () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, 512);

      expect(source.getCurrentTime()).toBe(0);

      await source.startStreaming(jest.fn());

      // Wait a bit for some playback
      await new Promise((resolve) => setTimeout(resolve, 100));

      const currentTime = source.getCurrentTime();
      expect(currentTime).toBeGreaterThanOrEqual(0);

      await source.stopStreaming();
    });

    it("should seek to a specific position", async () => {
      const recording = createTestRecording(2048);
      const source = new ReplaySource(recording, 512);

      await source.startStreaming(jest.fn());

      // Seek to middle
      source.seek(0.5);
      const progress = source.getProgress();
      expect(progress).toBeCloseTo(0.5, 1);

      // Seek to end
      source.seek(0.9);
      const progressEnd = source.getProgress();
      expect(progressEnd).toBeCloseTo(0.9, 1);

      await source.stopStreaming();
    });
  });

  describe("sample delivery", () => {
    it("should deliver correct number of samples per chunk", (done) => {
      const samplesPerChunk = 256;
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording, samplesPerChunk);

      let firstChunk = true;
      const callback = (samples: IQSample[]) => {
        if (firstChunk) {
          expect(samples.length).toBe(samplesPerChunk);
          firstChunk = false;
          void source.stopStreaming().then(done);
        }
      };

      void source.startStreaming(callback);
    });

    it("should deliver all samples from recording", (done) => {
      const totalSamples = 1024;
      const samplesPerChunk = 256;
      const recording = createTestRecording(totalSamples);
      const source = new ReplaySource(recording, samplesPerChunk);

      let receivedSamples = 0;

      const callback = (samples: IQSample[]) => {
        receivedSamples += samples.length;

        // Check if we've received all samples
        if (receivedSamples >= totalSamples) {
          expect(receivedSamples).toBe(totalSamples);
          void source.stopStreaming().then(done);
        }
      };

      void source.startStreaming(callback);
    });

    it("should maintain sample integrity", (done) => {
      const recording = createTestRecording(512, "sine");
      const source = new ReplaySource(recording, 256);

      const callback = (samples: IQSample[]) => {
        // Verify samples are valid IQ pairs
        expect(samples.length).toBeGreaterThan(0);
        samples.forEach((sample) => {
          expect(sample.I).toBeDefined();
          expect(sample.Q).toBeDefined();
          expect(typeof sample.I).toBe("number");
          expect(typeof sample.Q).toBe("number");
          expect(Math.abs(sample.I)).toBeLessThanOrEqual(1);
          expect(Math.abs(sample.Q)).toBeLessThanOrEqual(1);
        });

        void source.stopStreaming().then(done);
      };

      void source.startStreaming(callback);
    });
  });

  describe("edge cases", () => {
    it("should handle empty recording", async () => {
      const recording: IQRecording = {
        metadata: {
          sampleRate,
          frequency,
          signalType,
          deviceName,
          timestamp: new Date().toISOString(),
          duration: 0,
          sampleCount: 0,
        },
        samples: [],
      };

      const source = new ReplaySource(recording);
      const callback = jest.fn();

      await source.startStreaming(callback);

      // Wait a bit to ensure no callbacks
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).not.toHaveBeenCalled();
      expect(source.isStreaming()).toBe(false);

      await source.stopStreaming();
    });

    it("should handle very small recording", (done) => {
      const recording = createTestRecording(10);
      const source = new ReplaySource(recording, 512);

      const callback = (samples: IQSample[]) => {
        expect(samples.length).toBeLessThanOrEqual(10);
        void source.stopStreaming().then(done);
      };

      void source.startStreaming(callback);
    });

    it("should handle pause before start", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);

      expect(() => source.pause()).not.toThrow();
      expect(source.isStreaming()).toBe(false);
    });

    it("should handle resume before start", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);

      expect(() => source.resume()).not.toThrow();
      expect(source.isStreaming()).toBe(false);
    });

    it("should handle seek before start", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);

      expect(() => source.seek(0.5)).not.toThrow();
    });
  });

  describe("getRecording", () => {
    it("should return the underlying recording", () => {
      const recording = createTestRecording(1024);
      const source = new ReplaySource(recording);

      const retrievedRecording = source.getRecording();
      expect(retrievedRecording).toBe(recording);
      expect(retrievedRecording.samples.length).toBe(1024);
    });
  });
});
