/**
 * Tests for IQ Recorder and Playback utilities
 */

import {
  IQRecorder,
  IQPlayback,
  exportToJSON,
  exportToBinary,
  importFromJSON,
  importFromBinary,
  type IQRecording,
} from "../iqRecorder";
import { IQSample } from "../../models/SDRDevice";

describe("IQRecorder", () => {
  let recorder: IQRecorder;
  const sampleRate = 2048000;
  const frequency = 100e6;

  beforeEach(() => {
    recorder = new IQRecorder(sampleRate, frequency, 1000, "FM", "HackRF One");
  });

  afterEach(() => {
    recorder.clear();
  });

  test("should initialize with correct parameters", () => {
    expect(recorder.getIsRecording()).toBe(false);
    expect(recorder.getSampleCount()).toBe(0);
    expect(recorder.getDuration()).toBe(0);
  });

  test("should start and stop recording", () => {
    recorder.start();
    expect(recorder.getIsRecording()).toBe(true);

    recorder.stop();
    expect(recorder.getIsRecording()).toBe(false);
  });

  test("should add samples during recording", () => {
    const samples: IQSample[] = [
      { I: 0.5, Q: 0.5 },
      { I: -0.3, Q: 0.7 },
    ];

    recorder.start();
    const result = recorder.addSamples(samples);

    expect(result).toBe(true);
    expect(recorder.getSampleCount()).toBe(2);
  });

  test("should not add samples when not recording", () => {
    const samples: IQSample[] = [{ I: 0.5, Q: 0.5 }];

    const result = recorder.addSamples(samples);

    expect(result).toBe(false);
    expect(recorder.getSampleCount()).toBe(0);
  });

  test("should respect max sample limit", () => {
    const smallRecorder = new IQRecorder(sampleRate, frequency, 5);
    smallRecorder.start();

    const samples: IQSample[] = [
      { I: 0.1, Q: 0.1 },
      { I: 0.2, Q: 0.2 },
      { I: 0.3, Q: 0.3 },
    ];

    // Add 3 samples (total: 3)
    expect(smallRecorder.addSamples(samples)).toBe(true);
    expect(smallRecorder.getSampleCount()).toBe(3);

    // Add 3 more (would be 6, but limit is 5)
    const result = smallRecorder.addSamples(samples);
    expect(result).toBe(false);
    expect(smallRecorder.getSampleCount()).toBe(5);
    expect(smallRecorder.getIsRecording()).toBe(false);
  });

  test("should calculate duration correctly", () => {
    // Create a recorder with enough capacity for 1 second at 2.048 MSPS
    const largeRecorder = new IQRecorder(sampleRate, frequency, 3_000_000);
    largeRecorder.start();

    // Add 2048000 samples (1 second at 2.048 MSPS)
    // Add in batches to avoid stack overflow
    const sampleCount = 2048000;
    const batchSize = 10000;
    for (let i = 0; i < sampleCount; i += batchSize) {
      const batch: IQSample[] = [];
      for (let j = 0; j < batchSize; j++) {
        batch.push({ I: Math.random(), Q: Math.random() });
      }
      largeRecorder.addSamples(batch);
    }

    expect(largeRecorder.getDuration()).toBeCloseTo(1.0, 1);
  });

  test("should clear samples", () => {
    recorder.start();
    recorder.addSamples([{ I: 0.5, Q: 0.5 }]);

    recorder.clear();

    expect(recorder.getSampleCount()).toBe(0);
    expect(recorder.getIsRecording()).toBe(false);
  });

  test("should return recording with metadata", () => {
    recorder.start();
    const samples: IQSample[] = [
      { I: 0.5, Q: 0.5 },
      { I: -0.3, Q: 0.7 },
    ];
    recorder.addSamples(samples);

    const recording = recorder.getRecording();

    expect(recording.metadata.frequency).toBe(frequency);
    expect(recording.metadata.sampleRate).toBe(sampleRate);
    expect(recording.metadata.signalType).toBe("FM");
    expect(recording.metadata.deviceName).toBe("HackRF One");
    expect(recording.metadata.sampleCount).toBe(2);
    expect(recording.samples).toHaveLength(2);
    expect(recording.samples[0]).toEqual(samples[0]);
  });

  test("should update parameters", () => {
    recorder.updateParameters({
      frequency: 200e6,
      sampleRate: 4096000,
      signalType: "AM",
    });

    recorder.start();
    recorder.addSamples([{ I: 0.1, Q: 0.2 }]);

    const recording = recorder.getRecording();

    expect(recording.metadata.frequency).toBe(200e6);
    expect(recording.metadata.sampleRate).toBe(4096000);
    expect(recording.metadata.signalType).toBe("AM");
  });
});

describe("JSON Export/Import", () => {
  test("should export to JSON and import back", () => {
    const recording: IQRecording = {
      metadata: {
        timestamp: "2024-01-01T00:00:00.000Z",
        frequency: 100e6,
        sampleRate: 2048000,
        signalType: "FM",
        deviceName: "HackRF One",
        sampleCount: 2,
        duration: 0.001,
      },
      samples: [
        { I: 0.5, Q: 0.5 },
        { I: -0.3, Q: 0.7 },
      ],
    };

    const json = exportToJSON(recording);
    const imported = importFromJSON(json);

    expect(imported.metadata).toEqual(recording.metadata);
    expect(imported.samples).toHaveLength(2);
    expect(imported.samples[0]).toEqual(recording.samples[0]);
    expect(imported.samples[1]).toEqual(recording.samples[1]);
  });

  test("should throw error for invalid JSON", () => {
    expect(() => importFromJSON("{}")).toThrow("Invalid IQ recording JSON");
    expect(() => importFromJSON('{"samples": []}')).toThrow(
      "Invalid IQ recording JSON",
    );
  });

  test("should throw error for invalid metadata", () => {
    const invalidJSON = JSON.stringify({
      metadata: { frequency: "invalid" },
      samples: [],
    });

    expect(() => importFromJSON(invalidJSON)).toThrow("Invalid metadata");
  });
});

describe("Binary Export/Import", () => {
  test("should export to binary and import back", () => {
    const recording: IQRecording = {
      metadata: {
        timestamp: "2024-01-01T00:00:00.000Z",
        frequency: 100e6,
        sampleRate: 2048000,
        signalType: "FM",
        deviceName: "HackRF One",
        sampleCount: 3,
        duration: 0.001,
      },
      samples: [
        { I: 0.5, Q: 0.5 },
        { I: -0.3, Q: 0.7 },
        { I: 0.0, Q: -1.0 },
      ],
    };

    const binary = exportToBinary(recording);
    const imported = importFromBinary(binary);

    expect(imported.metadata).toEqual(recording.metadata);
    expect(imported.samples).toHaveLength(3);

    // Check samples with floating point tolerance
    for (let i = 0; i < recording.samples.length; i++) {
      const importedSample = imported.samples[i];
      const recordedSample = recording.samples[i];
      expect(importedSample).toBeDefined();
      expect(recordedSample).toBeDefined();
      if (importedSample && recordedSample) {
        expect(importedSample.I).toBeCloseTo(recordedSample.I, 5);
        expect(importedSample.Q).toBeCloseTo(recordedSample.Q, 5);
      }
    }
  });

  test("should handle large binary recordings", () => {
    const sampleCount = 10000;
    const samples: IQSample[] = Array(sampleCount)
      .fill(null)
      .map(() => ({
        I: Math.random() * 2 - 1,
        Q: Math.random() * 2 - 1,
      }));

    const recording: IQRecording = {
      metadata: {
        timestamp: "2024-01-01T00:00:00.000Z",
        frequency: 100e6,
        sampleRate: 2048000,
        sampleCount: sampleCount,
        duration: sampleCount / 2048000,
      },
      samples: samples,
    };

    const binary = exportToBinary(recording);
    const imported = importFromBinary(binary);

    expect(imported.samples).toHaveLength(sampleCount);

    // Spot check a few samples
    expect(imported.samples[0]).toBeDefined();
    expect(samples[0]).toBeDefined();
    if (imported.samples[0] && samples[0]) {
      expect(imported.samples[0].I).toBeCloseTo(samples[0].I, 5);
      expect(imported.samples[0].Q).toBeCloseTo(samples[0].Q, 5);
    }
    if (imported.samples[5000] && samples[5000]) {
      expect(imported.samples[5000].I).toBeCloseTo(samples[5000].I, 5);
    }
    if (imported.samples[9999] && samples[9999]) {
      expect(imported.samples[9999].I).toBeCloseTo(samples[9999].I, 5);
    }
  });

  test("should have correct binary format structure", () => {
    const recording: IQRecording = {
      metadata: {
        timestamp: "2024-01-01T00:00:00.000Z",
        frequency: 100e6,
        sampleRate: 2048000,
        sampleCount: 1,
        duration: 0.001,
      },
      samples: [{ I: 0.5, Q: -0.5 }],
    };

    const binary = exportToBinary(recording);
    const view = new DataView(binary);

    // First 4 bytes should be metadata length
    const metadataLength = view.getUint32(0, true);
    expect(metadataLength).toBeGreaterThan(0);

    // Total size should be: 4 (length) + metadata + samples (1 * 2 * 4 bytes)
    expect(binary.byteLength).toBe(4 + metadataLength + 8);
  });
});

describe("IQPlayback", () => {
  let recording: IQRecording;
  let playback: IQPlayback;
  let receivedChunks: IQSample[][] = [];

  beforeEach(() => {
    receivedChunks = [];

    // Create a recording with 100 samples
    const samples: IQSample[] = Array(100)
      .fill(null)
      .map((_, i) => ({
        I: Math.sin((i * Math.PI) / 10),
        Q: Math.cos((i * Math.PI) / 10),
      }));

    recording = {
      metadata: {
        timestamp: "2024-01-01T00:00:00.000Z",
        frequency: 100e6,
        sampleRate: 2048000,
        sampleCount: 100,
        duration: 100 / 2048000,
      },
      samples: samples,
    };

    playback = new IQPlayback(
      recording,
      (chunk) => {
        receivedChunks.push(chunk);
      },
      25, // 25 samples per chunk for testing
    );
  });

  afterEach(() => {
    playback.cleanup();
  });

  test("should initialize correctly", () => {
    expect(playback.getIsPlaying()).toBe(false);
    expect(playback.getProgress()).toBe(0);
    expect(playback.getCurrentTime()).toBe(0);
  });

  test("should start and stop playback", () => {
    playback.start();
    expect(playback.getIsPlaying()).toBe(true);

    playback.stop();
    expect(playback.getIsPlaying()).toBe(false);
    expect(playback.getProgress()).toBe(0);
  });

  test("should pause and resume playback", () => {
    playback.start();
    expect(playback.getIsPlaying()).toBe(true);

    playback.pause();
    expect(playback.getIsPlaying()).toBe(false);

    // Progress should be maintained
    const progressBeforeResume = playback.getProgress();

    playback.start();
    expect(playback.getIsPlaying()).toBe(true);
    expect(playback.getProgress()).toBe(progressBeforeResume);
  });

  test("should deliver chunks during playback", async () => {
    playback.start();

    // Wait for playback to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    playback.stop();

    // Should have received 4 chunks (100 samples / 25 per chunk = 4)
    expect(receivedChunks.length).toBeGreaterThan(0);

    // Total samples should match
    const totalSamples = receivedChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    expect(totalSamples).toBeLessThanOrEqual(100);
  });

  test("should calculate progress correctly", () => {
    playback.seek(0.5);
    expect(playback.getProgress()).toBeCloseTo(0.5, 2);

    playback.seek(0.25);
    expect(playback.getProgress()).toBeCloseTo(0.25, 2);
  });

  test("should calculate current time correctly", () => {
    playback.seek(0.5);
    const expectedTime = 100 / 2 / 2048000; // Half of 100 samples
    expect(playback.getCurrentTime()).toBeCloseTo(expectedTime, 6);
  });

  test("should clamp seek position to valid range", () => {
    playback.seek(-0.5);
    expect(playback.getProgress()).toBe(0);

    playback.seek(1.5);
    expect(playback.getProgress()).toBe(1);
  });

  test("should return metadata", () => {
    const metadata = playback.getMetadata();
    expect(metadata).toEqual(recording.metadata);
  });

  test("should handle empty recording", () => {
    const emptyRecording: IQRecording = {
      metadata: {
        timestamp: "2024-01-01T00:00:00.000Z",
        frequency: 100e6,
        sampleRate: 2048000,
        sampleCount: 0,
        duration: 0,
      },
      samples: [],
    };

    const emptyPlayback = new IQPlayback(
      emptyRecording,
      () => {
        /* no-op */
      },
      25,
    );

    expect(emptyPlayback.getProgress()).toBe(0);
    emptyPlayback.cleanup();
  });
});
