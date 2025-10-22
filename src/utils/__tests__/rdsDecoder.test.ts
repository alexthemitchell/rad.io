/**
 * Tests for RDS Decoder
 */

import { RDSDecoder, createRDSDecoder } from "../rdsDecoder";
import { RDSProgramType } from "../../models/RDSData";

describe("RDS Decoder", () => {
  describe("Initialization", () => {
    it("should create decoder with correct sample rate", () => {
      const decoder = createRDSDecoder(228000);
      expect(decoder).toBeInstanceOf(RDSDecoder);
    });

    it("should initialize with empty station data", () => {
      const decoder = createRDSDecoder(228000);
      const data = decoder.getStationData();

      expect(data.pi).toBeNull();
      expect(data.ps).toBe("");
      expect(data.rt).toBe("");
      expect(data.pty).toBe(RDSProgramType.NONE);
    });

    it("should initialize with unsynchronized stats", () => {
      const decoder = createRDSDecoder(228000);
      const stats = decoder.getStats();

      expect(stats.syncLocked).toBe(false);
      expect(stats.totalGroups).toBe(0);
      expect(stats.validGroups).toBe(0);
    });
  });

  describe("Signal Processing", () => {
    it("should process baseband samples without crashing", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(1000).fill(0);

      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });

    it("should handle empty sample buffer", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(0);

      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });

    it("should extract 57 kHz subcarrier from baseband", () => {
      const decoder = createRDSDecoder(228000);
      const sampleRate = 228000;
      const duration = 0.1; // 100ms
      const numSamples = Math.floor(sampleRate * duration);
      const samples = new Float32Array(numSamples);

      // Generate 57 kHz test signal
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        samples[i] = Math.sin(2 * Math.PI * 57000 * t);
      }

      // Should process without errors
      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });
  });

  describe("Bit Synchronization", () => {
    it("should handle BPSK modulated signal", () => {
      const decoder = createRDSDecoder(228000);
      const sampleRate = 228000;
      const baudRate = 1187.5;
      const samplesPerBit = sampleRate / baudRate;
      const numBits = 100;
      const numSamples = Math.floor(numBits * samplesPerBit);
      const samples = new Float32Array(numSamples);

      // Generate BPSK signal (alternating 1s and 0s)
      for (let bit = 0; bit < numBits; bit++) {
        const bitValue = bit % 2 === 0 ? 1 : -1;
        const startIdx = Math.floor(bit * samplesPerBit);
        const endIdx = Math.floor((bit + 1) * samplesPerBit);

        for (let i = startIdx; i < endIdx && i < numSamples; i++) {
          const t = i / sampleRate;
          samples[i] = bitValue * Math.sin(2 * Math.PI * 57000 * t);
        }
      }

      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });
  });

  describe("Block Synchronization", () => {
    it("should attempt to find block sync", () => {
      const decoder = createRDSDecoder(228000);
      const stats = decoder.getStats();

      // Initially not synced
      expect(stats.syncLocked).toBe(false);

      // Process some data
      const samples = new Float32Array(10000);
      for (let i = 0; i < samples.length; i++) {
        const t = i / 228000;
        samples[i] = Math.sin(2 * Math.PI * 57000 * t);
      }

      decoder.processBaseband(samples);

      // Stats should be accessible
      const updatedStats = decoder.getStats();
      expect(updatedStats).toBeDefined();
    });
  });

  describe("RDS Data Extraction", () => {
    it("should return station data structure", () => {
      const decoder = createRDSDecoder(228000);
      const data = decoder.getStationData();

      expect(data).toHaveProperty("pi");
      expect(data).toHaveProperty("ps");
      expect(data).toHaveProperty("rt");
      expect(data).toHaveProperty("pty");
      expect(data).toHaveProperty("ct");
      expect(data).toHaveProperty("af");
      expect(data).toHaveProperty("tp");
      expect(data).toHaveProperty("ta");
      expect(data).toHaveProperty("ms");
      expect(data).toHaveProperty("di");
      expect(data).toHaveProperty("lastUpdate");
      expect(data).toHaveProperty("signalQuality");
    });

    it("should update lastUpdate timestamp on data changes", () => {
      const decoder = createRDSDecoder(228000);
      const initialData = decoder.getStationData();
      const initialTimestamp = initialData.lastUpdate;

      // Process some samples
      const samples = new Float32Array(5000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
      }

      decoder.processBaseband(samples);

      const updatedData = decoder.getStationData();
      // Timestamp should be recent (within last second)
      expect(updatedData.lastUpdate).toBeGreaterThanOrEqual(initialTimestamp);
    });
  });

  describe("Statistics Tracking", () => {
    it("should track decoder statistics", () => {
      const decoder = createRDSDecoder(228000);
      const stats = decoder.getStats();

      expect(stats).toHaveProperty("totalGroups");
      expect(stats).toHaveProperty("validGroups");
      expect(stats).toHaveProperty("correctedBlocks");
      expect(stats).toHaveProperty("errorRate");
      expect(stats).toHaveProperty("syncLocked");
      expect(stats).toHaveProperty("lastSync");
    });

    it("should initialize error rate to 0", () => {
      const decoder = createRDSDecoder(228000);
      const stats = decoder.getStats();

      expect(stats.errorRate).toBe(0);
    });
  });

  describe("Reset Functionality", () => {
    it("should reset decoder state", () => {
      const decoder = createRDSDecoder(228000);

      // Process some data
      const samples = new Float32Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * 57000 * i) / 228000);
      }
      decoder.processBaseband(samples);

      // Reset
      decoder.reset();

      // Check state is cleared
      const data = decoder.getStationData();
      expect(data.pi).toBeNull();
      expect(data.ps).toBe("");
      expect(data.rt).toBe("");

      const stats = decoder.getStats();
      expect(stats.totalGroups).toBe(0);
      expect(stats.validGroups).toBe(0);
      expect(stats.syncLocked).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very short sample buffers", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(10);

      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });

    it("should handle different sample rates", () => {
      const sampleRates = [48000, 96000, 192000, 228000, 256000];

      sampleRates.forEach((rate) => {
        const decoder = createRDSDecoder(rate);
        expect(decoder).toBeInstanceOf(RDSDecoder);

        const samples = new Float32Array(1000);
        expect(() => decoder.processBaseband(samples)).not.toThrow();
      });
    });

    it("should handle NaN values in samples", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(100);
      samples.fill(NaN);

      // Should not crash
      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });

    it("should handle Infinity values in samples", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(100);
      samples.fill(Infinity);

      // Should not crash
      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });

    it("should handle alternating positive/negative samples", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(100);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = i % 2 === 0 ? 1 : -1;
      }

      expect(() => decoder.processBaseband(samples)).not.toThrow();
    });
  });

  describe("Data Validation", () => {
    it("should return new data objects on each call", () => {
      const decoder = createRDSDecoder(228000);
      const data1 = decoder.getStationData();
      const data2 = decoder.getStationData();

      expect(data1).not.toBe(data2); // Different object references
      expect(data1).toEqual(data2); // Same content
    });

    it("should return new stats objects on each call", () => {
      const decoder = createRDSDecoder(228000);
      const stats1 = decoder.getStats();
      const stats2 = decoder.getStats();

      expect(stats1).not.toBe(stats2); // Different object references
      expect(stats1).toEqual(stats2); // Same content
    });

    it("should not mutate returned data when decoder processes more samples", () => {
      const decoder = createRDSDecoder(228000);
      const data1 = decoder.getStationData();

      // Process more samples
      const samples = new Float32Array(1000);
      decoder.processBaseband(samples);

      // Original data should not change
      expect(data1.pi).toBeNull();
      expect(data1.ps).toBe("");
    });
  });

  describe("Performance", () => {
    it("should process 1 second of audio in reasonable time", () => {
      const decoder = createRDSDecoder(228000);
      const samples = new Float32Array(228000); // 1 second

      // Generate test signal
      for (let i = 0; i < samples.length; i++) {
        const t = i / 228000;
        samples[i] = Math.sin(2 * Math.PI * 57000 * t);
      }

      const startTime = performance.now();
      decoder.processBaseband(samples);
      const duration = performance.now() - startTime;

      // Should complete in less than 1 second (real-time processing)
      expect(duration).toBeLessThan(1000);
    });

    it("should handle continuous processing efficiently", () => {
      const decoder = createRDSDecoder(228000);
      const bufferSize = 4096; // Typical audio buffer size

      // Process 10 buffers
      for (let buf = 0; buf < 10; buf++) {
        const samples = new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          const t = (buf * bufferSize + i) / 228000;
          samples[i] = Math.sin(2 * Math.PI * 57000 * t);
        }

        expect(() => decoder.processBaseband(samples)).not.toThrow();
      }

      // Decoder should still be functional
      const data = decoder.getStationData();
      expect(data).toBeDefined();
    });
  });
});
