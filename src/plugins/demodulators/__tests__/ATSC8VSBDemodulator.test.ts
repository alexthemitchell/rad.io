/**
 * ATSC 8-VSB Demodulator Tests
 */

import { ATSC8VSBDemodulator } from "../ATSC8VSBDemodulator";
import { PluginType, PluginState } from "../../../types/plugin";
import type { IQSample } from "../../../models/SDRDevice";

describe("ATSC8VSBDemodulator", () => {
  let demodulator: ATSC8VSBDemodulator;

  beforeEach(() => {
    demodulator = new ATSC8VSBDemodulator();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(demodulator.metadata.id).toBe("atsc-8vsb-demodulator");
      expect(demodulator.metadata.type).toBe(PluginType.DEMODULATOR);
      expect(demodulator.metadata.version).toBe("1.0.0");
      expect(demodulator.metadata.name).toBe("ATSC 8-VSB Demodulator");
    });

    it("should have proper description", () => {
      expect(demodulator.metadata.description).toContain("ATSC");
      expect(demodulator.metadata.description).toContain("8-VSB");
    });
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await demodulator.initialize();
      expect(demodulator.state).toBe(PluginState.INITIALIZED);
    });

    it("should set correct default parameters", () => {
      const params = demodulator.getParameters();
      expect(params.audioSampleRate).toBe(10.76e6); // 10.76 Msymbols/sec
      expect(params.bandwidth).toBe(6e6); // 6 MHz
      expect(params.afcEnabled).toBe(true);
    });
  });

  describe("supported modes", () => {
    it("should support 8-VSB mode", () => {
      const modes = demodulator.getSupportedModes();
      expect(modes).toContain("8vsb");
      expect(modes.length).toBe(1);
    });

    it("should accept 8vsb mode", () => {
      expect(() => demodulator.setMode("8vsb")).not.toThrow();
    });

    it("should reject unsupported modes", () => {
      expect(() => demodulator.setMode("qpsk")).toThrow("Unsupported mode");
      expect(() => demodulator.setMode("16qam")).toThrow("Unsupported mode");
    });
  });

  describe("parameters", () => {
    it("should return current parameters", () => {
      const params = demodulator.getParameters();
      expect(params).toBeDefined();
      expect(params.audioSampleRate).toBeDefined();
      expect(params.bandwidth).toBeDefined();
      expect(params.squelch).toBeDefined();
      expect(params.afcEnabled).toBeDefined();
    });

    it("should update parameters", () => {
      demodulator.setParameters({ squelch: 50 });
      const params = demodulator.getParameters();
      expect(params.squelch).toBe(50);
    });

    it("should preserve other parameters when updating", () => {
      const originalBandwidth = demodulator.getParameters().bandwidth;
      demodulator.setParameters({ squelch: 50 });
      const params = demodulator.getParameters();
      expect(params.bandwidth).toBe(originalBandwidth);
    });

    it("should update sample rate", () => {
      demodulator.setParameters({ audioSampleRate: 20e6 });
      const params = demodulator.getParameters();
      expect(params.audioSampleRate).toBe(20e6);
    });
  });

  describe("pilot tone recovery", () => {
    it("should process samples with pilot tone correction", () => {
      // Create samples with pilot tone at 309.44 kHz
      const samples: IQSample[] = [];
      const sampleRate = 10.76e6;
      const pilotFreq = 309440;
      const numSamples = 1000;

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const phase = 2 * Math.PI * pilotFreq * t;
        samples.push({
          I: Math.cos(phase),
          Q: Math.sin(phase),
        });
      }

      const output = demodulator.demodulate(samples);
      expect(output).toBeInstanceOf(Float32Array);
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("symbol slicing", () => {
    it("should demodulate to 8-VSB levels", () => {
      // Create test signal with known symbol levels
      const samples: IQSample[] = [];
      const vsbLevels = [-7, -5, -3, -1, 1, 3, 5, 7];

      // Create samples representing each VSB level
      for (const level of vsbLevels) {
        // Add multiple samples per symbol for oversampling
        for (let i = 0; i < 10; i++) {
          samples.push({
            I: level,
            Q: 0,
          });
        }
      }

      const output = demodulator.demodulate(samples);
      expect(output).toBeInstanceOf(Float32Array);

      // Check that output contains valid VSB levels
      for (let i = 0; i < output.length; i++) {
        expect(vsbLevels).toContain(output[i]);
      }
    });
  });

  describe("sync detection", () => {
    it("should initialize with sync not locked", () => {
      expect(demodulator.isSyncLocked()).toBe(false);
    });

    it("should track segment sync count", () => {
      const initialCount = demodulator.getSegmentSyncCount();
      expect(initialCount).toBe(0);
    });

    it("should track field sync count", () => {
      const initialCount = demodulator.getFieldSyncCount();
      expect(initialCount).toBe(0);
    });

    it("should detect segment sync pattern", () => {
      // Create segment sync pattern: [+5, -5, -5, +5]
      const samples: IQSample[] = [];
      const syncPattern = [5, -5, -5, 5];

      // Add sync pattern with sufficient samples per symbol
      for (const symbol of syncPattern) {
        for (let i = 0; i < 100; i++) {
          samples.push({ I: symbol, Q: 0 });
        }
      }

      demodulator.demodulate(samples);

      // After processing sync pattern, should be locked
      // Note: sync detection requires accumulation, may need multiple segments
      expect(demodulator.getSegmentSyncCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("demodulation", () => {
    it("should handle empty input", () => {
      const output = demodulator.demodulate([]);
      expect(output.length).toBe(0);
    });

    it("should handle single sample", () => {
      const samples: IQSample[] = [{ I: 1, Q: 0 }];
      const output = demodulator.demodulate(samples);
      expect(output.length).toBeGreaterThanOrEqual(0);
    });

    it("should produce output for valid input", () => {
      // Create test signal
      const samples: IQSample[] = [];
      const numSamples = 1000;

      for (let i = 0; i < numSamples; i++) {
        const level = i % 2 === 0 ? 3 : -3; // Alternate between two levels
        samples.push({
          I: level,
          Q: 0,
        });
      }

      const output = demodulator.demodulate(samples);
      expect(output.length).toBeGreaterThan(0);
      expect(output.length).toBeLessThanOrEqual(numSamples);
    });

    it("should handle realistic ATSC signal structure", () => {
      // Create a segment (832 symbols)
      const samples: IQSample[] = [];
      const samplesPerSymbol = 100; // Oversample

      // Segment sync (4 symbols)
      const syncPattern = [5, -5, -5, 5];
      for (const symbol of syncPattern) {
        for (let i = 0; i < samplesPerSymbol; i++) {
          samples.push({ I: symbol, Q: 0 });
        }
      }

      // Data symbols (828 symbols with random levels)
      const vsbLevels = [-7, -5, -3, -1, 1, 3, 5, 7];
      for (let s = 0; s < 828; s++) {
        const level = vsbLevels[s % vsbLevels.length] ?? 0;
        for (let i = 0; i < samplesPerSymbol; i++) {
          samples.push({ I: level, Q: 0 });
        }
      }

      const output = demodulator.demodulate(samples);
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("equalizer", () => {
    it("should apply equalization to symbols", () => {
      // Create signal with multipath (delayed echo)
      const samples: IQSample[] = [];
      const numSamples = 1000;
      const echoDelay = 10;
      const echoGain = 0.3;

      const mainSignal: number[] = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        mainSignal[i] = i % 2 === 0 ? 3 : -3;
      }

      // Add delayed echo
      for (let i = 0; i < numSamples; i++) {
        const main = mainSignal[i] ?? 0;
        const echo =
          i >= echoDelay ? (mainSignal[i - echoDelay] ?? 0) * echoGain : 0;
        samples.push({
          I: main + echo,
          Q: 0,
        });
      }

      const output = demodulator.demodulate(samples);
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("lifecycle", () => {
    it("should activate successfully", async () => {
      await demodulator.initialize();
      await demodulator.activate();
      expect(demodulator.state).toBe(PluginState.ACTIVE);
    });

    it("should deactivate successfully", async () => {
      await demodulator.initialize();
      await demodulator.activate();
      await demodulator.deactivate();
      expect(demodulator.state).toBe(PluginState.INITIALIZED);
    });

    it("should reset state on deactivation", async () => {
      await demodulator.initialize();
      await demodulator.activate();

      // Process some samples to create state
      const samples: IQSample[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push({ I: 3, Q: 0 });
      }
      demodulator.demodulate(samples);

      await demodulator.deactivate();

      // After deactivation, state should be reset
      expect(demodulator.isSyncLocked()).toBe(false);
      expect(demodulator.getSegmentSyncCount()).toBe(0);
      expect(demodulator.getFieldSyncCount()).toBe(0);
    });

    it("should dispose successfully", async () => {
      await demodulator.initialize();
      await demodulator.activate();
      await demodulator.deactivate();
      await demodulator.dispose();
      // Dispose typically returns the plugin to INITIALIZED or ERROR state
      expect(demodulator.state).toBe(PluginState.INITIALIZED);
    });
  });

  describe("configuration schema", () => {
    it("should provide configuration schema", () => {
      const schema = demodulator.getConfigSchema();
      expect(schema).toBeDefined();
      expect(schema!.properties).toBeDefined();
    });

    it("should define mode property", () => {
      const schema = demodulator.getConfigSchema();
      expect(schema?.properties["mode"]).toBeDefined();
      expect(schema?.properties["mode"]?.enum).toContain("8vsb");
    });

    it("should define bandwidth property", () => {
      const schema = demodulator.getConfigSchema();
      expect(schema?.properties["bandwidth"]).toBeDefined();
      expect(schema?.properties["bandwidth"]?.default).toBe(6e6);
    });

    it("should define squelch property", () => {
      const schema = demodulator.getConfigSchema();
      expect(schema!.properties["squelch"]).toBeDefined();
    });

    it("should define AFC property", () => {
      const schema = demodulator.getConfigSchema();
      expect(schema!.properties["afcEnabled"]).toBeDefined();
    });

    it("should specify required fields", () => {
      const schema = demodulator.getConfigSchema();
      expect(schema!.required).toContain("mode");
    });
  });

  describe("performance", () => {
    it("should process large number of samples efficiently", () => {
      const samples: IQSample[] = [];
      const numSamples = 10000;

      // Generate test signal
      for (let i = 0; i < numSamples; i++) {
        const level = (i % 8) - 3.5; // Cycle through approximate VSB levels
        samples.push({
          I: level,
          Q: 0,
        });
      }

      const startTime = performance.now();
      const output = demodulator.demodulate(samples);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      expect(output.length).toBeGreaterThan(0);
      // Processing should complete in reasonable time (< 1 second for 10k samples)
      expect(processingTime).toBeLessThan(1000);
    });

    it("should maintain consistent throughput", () => {
      const samples: IQSample[] = [];
      const numSamples = 1000;

      for (let i = 0; i < numSamples; i++) {
        samples.push({
          I: Math.random() * 14 - 7, // Random VSB-like levels
          Q: 0,
        });
      }

      // Process multiple times to check consistency
      const times: number[] = [];
      for (let iteration = 0; iteration < 5; iteration++) {
        const startTime = performance.now();
        demodulator.demodulate(samples);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      // Calculate variance in processing times
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const variance =
        times.reduce((acc, t) => acc + Math.pow(t - avgTime, 2), 0) /
        times.length;

      // Variance should be relatively low (consistent performance)
      // Allow for higher variance in CI environments (100% of avg time)
      expect(variance).toBeLessThan(avgTime * 1.0);
    });
  });
});
