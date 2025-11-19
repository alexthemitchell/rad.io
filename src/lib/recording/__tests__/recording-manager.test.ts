/**
 * Tests for RecordingManager class
 */

import { RecordingManager } from "../recording-manager";
import type { IQRecording as UtilsIQRecording } from "../../../utils/iqRecorder";
import type { IQSample } from "../../../models/SDRDevice";

// Mock the recording storage
jest.mock("../recording-storage", () => {
  const mockStorage = {
    init: jest.fn().mockResolvedValue(undefined),
    saveRecording: jest.fn().mockResolvedValue(undefined),
    loadRecording: jest.fn().mockResolvedValue(null),
    deleteRecording: jest.fn().mockResolvedValue(undefined),
    listRecordings: jest.fn().mockResolvedValue([]),
    getStorageUsage: jest.fn().mockResolvedValue({
      used: 1024 * 1024,
      quota: 100 * 1024 * 1024,
      percent: 1,
    }),
    hasAvailableSpace: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  };

  return {
    RecordingStorage: jest.fn(() => mockStorage),
    recordingStorage: mockStorage,
  };
});

describe("RecordingManager", () => {
  let manager: RecordingManager;

  beforeEach(() => {
    manager = new RecordingManager();
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("should initialize storage", async () => {
      const { recordingStorage } = require("../recording-storage");
      await manager.init();
      expect(recordingStorage.init).toHaveBeenCalled();
    });
  });

  describe("saveRecording", () => {
    it("should save a recording and return ID", async () => {
      const { recordingStorage } = require("../recording-storage");

      const samples: IQSample[] = [
        { I: 0.5, Q: 0.3 },
        { I: -0.2, Q: 0.7 },
        { I: 0.1, Q: -0.4 },
      ];

      const recording: UtilsIQRecording = {
        metadata: {
          timestamp: new Date().toISOString(),
          frequency: 100e6,
          sampleRate: 2e6,
          sampleCount: samples.length,
          duration: samples.length / 2e6,
          deviceName: "HackRF One",
          signalType: "FM",
        },
        samples,
      };

      const id = await manager.saveRecording(recording);

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      expect(recordingStorage.saveRecording).toHaveBeenCalled();
    });

    it("should throw error when insufficient storage", async () => {
      const { recordingStorage } = require("../recording-storage");
      recordingStorage.hasAvailableSpace.mockResolvedValueOnce(false);

      const samples: IQSample[] = Array(1000).fill({ I: 0, Q: 0 });
      const recording: UtilsIQRecording = {
        metadata: {
          timestamp: new Date().toISOString(),
          frequency: 100e6,
          sampleRate: 2e6,
          sampleCount: samples.length,
          duration: samples.length / 2e6,
        },
        samples,
      };

      await expect(manager.saveRecording(recording)).rejects.toThrow(
        "Insufficient storage",
      );
    });

    it("should chunk large recordings", async () => {
      const { recordingStorage } = require("../recording-storage");

      // Create a large recording (>10MB worth of samples)
      const largeSize = 2 * 1024 * 1024; // 2M samples = 16MB
      const samples: IQSample[] = Array(largeSize)
        .fill(null)
        .map(() => ({ I: Math.random(), Q: Math.random() }));

      const recording: UtilsIQRecording = {
        metadata: {
          timestamp: new Date().toISOString(),
          frequency: 100e6,
          sampleRate: 2e6,
          sampleCount: samples.length,
          duration: samples.length / 2e6,
        },
        samples,
      };

      await manager.saveRecording(recording);

      expect(recordingStorage.saveRecording).toHaveBeenCalled();
      const savedEntry = recordingStorage.saveRecording.mock.calls[0][0];
      expect(savedEntry.chunks.length).toBeGreaterThan(1);
    });
  });

  describe("loadRecording", () => {
    it("should load a recording by ID", async () => {
      const { recordingStorage } = require("../recording-storage");

      const samples: IQSample[] = [
        { I: 0.5, Q: 0.3 },
        { I: -0.2, Q: 0.7 },
      ];

      // Create chunks
      const buffer = new ArrayBuffer(samples.length * 8);
      const view = new DataView(buffer);
      samples.forEach((s, i) => {
        view.setFloat32(i * 8, s.I, true);
        view.setFloat32(i * 8 + 4, s.Q, true);
      });

      const blob = new Blob([buffer]);
      // Mock arrayBuffer method for Node environment
      if (!blob.arrayBuffer) {
        (blob as any).arrayBuffer = async () => buffer;
      }

      recordingStorage.loadRecording.mockResolvedValueOnce({
        id: "test-id",
        metadata: {
          frequency: 100e6,
          sampleRate: 2e6,
          timestamp: new Date().toISOString(),
          duration: 1,
          tags: [],
        },
        chunks: [blob],
      });

      const recording = await manager.loadRecording("test-id");

      expect(recording.id).toBe("test-id");
      expect(recording.samples).toHaveLength(2);
      expect(recording.samples[0]?.I).toBeCloseTo(0.5, 5);
      expect(recording.samples[0]?.Q).toBeCloseTo(0.3, 5);
    });

    it("should throw error when recording not found", async () => {
      const { recordingStorage } = require("../recording-storage");
      recordingStorage.loadRecording.mockResolvedValueOnce(null);

      await expect(manager.loadRecording("non-existent")).rejects.toThrow(
        "Recording not found",
      );
    });
  });

  describe("deleteRecording", () => {
    it("should delete a recording", async () => {
      const { recordingStorage } = require("../recording-storage");

      await manager.deleteRecording("test-id");

      expect(recordingStorage.deleteRecording).toHaveBeenCalledWith("test-id");
    });
  });

  describe("listRecordings", () => {
    it("should list all recordings", async () => {
      const { recordingStorage } = require("../recording-storage");

      const mockMeta = [
        {
          id: "1",
          frequency: 100e6,
          timestamp: new Date().toISOString(),
          duration: 10,
          size: 1024,
        },
        {
          id: "2",
          frequency: 200e6,
          timestamp: new Date().toISOString(),
          duration: 20,
          size: 2048,
        },
      ];

      recordingStorage.listRecordings.mockResolvedValueOnce(mockMeta);

      const recordings = await manager.listRecordings();

      expect(recordings).toEqual(mockMeta);
      expect(recordingStorage.listRecordings).toHaveBeenCalled();
    });
  });

  describe("getStorageUsage", () => {
    it("should return storage usage", async () => {
      const usage = await manager.getStorageUsage();

      expect(usage.used).toBe(1024 * 1024);
      expect(usage.quota).toBe(100 * 1024 * 1024);
      expect(usage.percent).toBe(1);
    });
  });

  describe("updateMetadata", () => {
    it("should update recording metadata", async () => {
      const { recordingStorage } = require("../recording-storage");

      recordingStorage.loadRecording.mockResolvedValueOnce({
        id: "test-id",
        metadata: {
          frequency: 100e6,
          sampleRate: 2e6,
          timestamp: new Date().toISOString(),
          duration: 10,
          tags: [],
        },
        chunks: [],
      });

      await manager.updateMetadata("test-id", { label: "New Label" });

      // Now we use put() so no delete is called
      expect(recordingStorage.saveRecording).toHaveBeenCalled();
    });

    it("should throw error when recording not found", async () => {
      const { recordingStorage } = require("../recording-storage");
      recordingStorage.loadRecording.mockResolvedValueOnce(null);

      await expect(
        manager.updateMetadata("non-existent", { label: "Test" }),
      ).rejects.toThrow("Recording not found");
    });
  });
});
