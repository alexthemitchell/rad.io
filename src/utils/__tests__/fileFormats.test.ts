/**
 * Tests for File Format Utilities
 */

import {
  exportIQRecording,
  importIQRecording,
  exportPresets,
  importPresets,
  validateFile,
  createIQRecording,
  createPresetCollection,
  IQRecording,
  PresetCollection,
} from "../fileFormats";
import { IQSample } from "../../models/SDRDevice";

describe("File Format Utilities", () => {
  describe("IQ Recording", () => {
    const sampleIQData: IQSample[] = [
      { I: 0.5, Q: 0.3 },
      { I: -0.2, Q: 0.8 },
      { I: 0.1, Q: -0.4 },
    ];

    const sampleRecording: IQRecording = {
      version: "1.0",
      timestamp: "2025-10-15T20:00:00.000Z",
      metadata: {
        centerFrequency: 100.3e6,
        sampleRate: 20e6,
        signalType: "FM",
        duration: 5.0,
        deviceInfo: "HackRF One",
        description: "Test recording",
      },
      samples: sampleIQData,
    };

    it("should export IQ recording to JSON", () => {
      const json = exportIQRecording(sampleRecording);
      expect(json).toBeTruthy();
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe("1.0");
      expect(parsed.metadata.centerFrequency).toBe(100.3e6);
      expect(parsed.samples.length).toBe(3);
    });

    it("should import valid IQ recording from JSON", () => {
      const json = exportIQRecording(sampleRecording);
      const imported = importIQRecording(json);

      expect(imported.version).toBe("1.0");
      expect(imported.metadata.centerFrequency).toBe(100.3e6);
      expect(imported.metadata.sampleRate).toBe(20e6);
      expect(imported.samples.length).toBe(3);
      expect(imported.samples[0]?.I).toBe(0.5);
      expect(imported.samples[0]?.Q).toBe(0.3);
    });

    it("should reject IQ recording without version", () => {
      const invalidJSON = JSON.stringify({
        metadata: { centerFrequency: 100e6, sampleRate: 20e6 },
        samples: sampleIQData,
      });

      expect(() => importIQRecording(invalidJSON)).toThrow(
        "Invalid IQ recording format",
      );
    });

    it("should reject IQ recording without metadata", () => {
      const invalidJSON = JSON.stringify({
        version: "1.0",
        samples: sampleIQData,
      });

      expect(() => importIQRecording(invalidJSON)).toThrow(
        "Invalid IQ recording format",
      );
    });

    it("should reject IQ recording with invalid metadata", () => {
      const invalidJSON = JSON.stringify({
        version: "1.0",
        timestamp: "2025-10-15T20:00:00.000Z",
        metadata: { centerFrequency: "invalid" },
        samples: sampleIQData,
      });

      expect(() => importIQRecording(invalidJSON)).toThrow(
        "Invalid metadata in IQ recording",
      );
    });

    it("should reject IQ recording with invalid samples", () => {
      const invalidJSON = JSON.stringify({
        version: "1.0",
        timestamp: "2025-10-15T20:00:00.000Z",
        metadata: { centerFrequency: 100e6, sampleRate: 20e6 },
        samples: [{ I: "invalid", Q: 0.5 }],
      });

      expect(() => importIQRecording(invalidJSON)).toThrow(
        "Invalid sample data in IQ recording",
      );
    });

    it("should create IQ recording with helper function", () => {
      const recording = createIQRecording(sampleIQData, {
        centerFrequency: 100.3e6,
        sampleRate: 20e6,
        signalType: "FM",
      });

      expect(recording.version).toBe("1.0");
      expect(recording.timestamp).toBeTruthy();
      expect(recording.metadata.centerFrequency).toBe(100.3e6);
      expect(recording.samples).toBe(sampleIQData);
    });
  });

  describe("Preset Collection", () => {
    const samplePresets: PresetCollection = {
      version: "1.0",
      name: "My Stations",
      description: "Favorite radio stations",
      stations: [
        { name: "NPR", frequency: 88.5e6, type: "FM" },
        { name: "Talk Radio", frequency: 710e3, type: "AM" },
        { name: "Jazz", frequency: 101.9e6, type: "FM", notes: "Smooth jazz" },
      ],
    };

    it("should export preset collection to JSON", () => {
      const json = exportPresets(samplePresets);
      expect(json).toBeTruthy();
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe("1.0");
      expect(parsed.name).toBe("My Stations");
      expect(parsed.stations.length).toBe(3);
    });

    it("should import valid preset collection from JSON", () => {
      const json = exportPresets(samplePresets);
      const imported = importPresets(json);

      expect(imported.version).toBe("1.0");
      expect(imported.name).toBe("My Stations");
      expect(imported.description).toBe("Favorite radio stations");
      expect(imported.stations.length).toBe(3);
      expect(imported.stations[0]?.name).toBe("NPR");
      expect(imported.stations[0]?.frequency).toBe(88.5e6);
    });

    it("should reject preset collection without version", () => {
      const invalidJSON = JSON.stringify({
        name: "Test",
        stations: [],
      });

      expect(() => importPresets(invalidJSON)).toThrow(
        "Invalid preset collection format",
      );
    });

    it("should reject preset collection without stations array", () => {
      const invalidJSON = JSON.stringify({
        version: "1.0",
        name: "Test",
      });

      expect(() => importPresets(invalidJSON)).toThrow(
        "Invalid preset collection format",
      );
    });

    it("should reject preset collection with invalid station data", () => {
      const invalidJSON = JSON.stringify({
        version: "1.0",
        name: "Test",
        stations: [{ name: "Station", frequency: "invalid" }],
      });

      expect(() => importPresets(invalidJSON)).toThrow(
        "Invalid station data in preset collection",
      );
    });

    it("should create preset collection with helper function", () => {
      const presets = createPresetCollection(
        "Test Collection",
        [
          { name: "FM Station", frequency: 100e6, type: "FM" },
          { name: "AM Station", frequency: 1000e3, type: "AM" },
        ],
        "Test description",
      );

      expect(presets.version).toBe("1.0");
      expect(presets.name).toBe("Test Collection");
      expect(presets.description).toBe("Test description");
      expect(presets.stations.length).toBe(2);
    });
  });

  describe("File Validation", () => {
    it("should accept valid JSON file within size limit", () => {
      const file = new File(['{"test": "data"}'], "test.json", {
        type: "application/json",
      });

      const result = validateFile(file, { maxSize: 1024 * 1024 });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject file exceeding size limit", () => {
      const file = new File(["x".repeat(1024 * 1024 + 1)], "test.json", {
        type: "application/json",
      });

      const result = validateFile(file, { maxSize: 1024 * 1024 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });

    it("should accept file with .json extension even if MIME type is missing", () => {
      const file = new File(['{"test": "data"}'], "test.json", {
        type: "",
      });

      const result = validateFile(file, {
        allowedTypes: ["application/json"],
      });
      expect(result.valid).toBe(true);
    });

    it("should reject file with wrong extension and MIME type", () => {
      const file = new File(["test data"], "test.txt", {
        type: "text/plain",
      });

      const result = validateFile(file, {
        allowedTypes: ["application/json"],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should accept file with correct MIME type", () => {
      const file = new File(['{"test": "data"}'], "test.json", {
        type: "application/json",
      });

      const result = validateFile(file, {
        allowedTypes: ["application/json"],
      });
      expect(result.valid).toBe(true);
    });

    it("should use default max size of 100MB", () => {
      const file = new File(["x".repeat(101 * 1024 * 1024)], "test.json", {
        type: "application/json",
      });

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("100.0MB");
    });

    it("should accept empty file", () => {
      const file = new File([""], "test.json", {
        type: "application/json",
      });

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });
  });
});
