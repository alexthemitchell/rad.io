/**
 * FM Demodulator Plugin Tests
 */

import { FMDemodulatorPlugin } from "../FMDemodulatorPlugin";
import { PluginType, PluginState } from "../../../types/plugin";
import type { IQSample } from "../../../models/SDRDevice";

describe("FMDemodulatorPlugin", () => {
  let plugin: FMDemodulatorPlugin;

  beforeEach(() => {
    plugin = new FMDemodulatorPlugin();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(plugin.metadata.id).toBe("fm-demodulator");
      expect(plugin.metadata.type).toBe(PluginType.DEMODULATOR);
      expect(plugin.metadata.version).toBe("1.0.0");
    });
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await plugin.initialize();
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });
  });

  describe("demodulation modes", () => {
    it("should support WBFM and NBFM modes", () => {
      const modes = plugin.getSupportedModes();
      expect(modes).toContain("wbfm");
      expect(modes).toContain("nbfm");
    });

    it("should start in WBFM mode", () => {
      const params = plugin.getParameters();
      expect(params.bandwidth).toBe(200000); // 200 kHz for WBFM
    });

    it("should switch to NBFM mode", () => {
      plugin.setMode("nbfm");
      const params = plugin.getParameters();
      expect(params.bandwidth).toBe(12500); // 12.5 kHz for NBFM
    });

    it("should throw error for unsupported mode", () => {
      expect(() => plugin.setMode("invalid")).toThrow("Unsupported mode");
    });
  });

  describe("parameters", () => {
    it("should return current parameters", () => {
      const params = plugin.getParameters();
      expect(params.audioSampleRate).toBe(48000);
      expect(params.bandwidth).toBe(200000);
      expect(params.squelch).toBe(0);
    });

    it("should update parameters", () => {
      plugin.setParameters({ squelch: 50 });
      const params = plugin.getParameters();
      expect(params.squelch).toBe(50);
    });

    it("should preserve other parameters when updating", () => {
      plugin.setParameters({ squelch: 50 });
      const params = plugin.getParameters();
      expect(params.audioSampleRate).toBe(48000);
      expect(params.bandwidth).toBe(200000);
    });
  });

  describe("demodulation", () => {
    it("should demodulate IQ samples", () => {
      // Create test IQ samples (simple sine wave)
      const samples: IQSample[] = [];
      const frequency = 1000; // 1 kHz test tone
      const sampleRate = 48000;

      for (let i = 0; i < 100; i++) {
        const t = i / sampleRate;
        const phase = 2 * Math.PI * frequency * t;
        samples.push({
          I: Math.cos(phase),
          Q: Math.sin(phase),
        });
      }

      const audio = plugin.demodulate(samples);

      expect(audio).toBeInstanceOf(Float32Array);
      expect(audio.length).toBe(samples.length);
    });

    it("should handle empty input", () => {
      const audio = plugin.demodulate([]);
      expect(audio.length).toBe(0);
    });

    it("should handle single sample", () => {
      const samples: IQSample[] = [{ I: 1, Q: 0 }];
      const audio = plugin.demodulate(samples);
      expect(audio.length).toBe(1);
    });
  });

  describe("configuration schema", () => {
    it("should provide configuration schema", () => {
      const schema = plugin.getConfigSchema();
      expect(schema).toBeDefined();
      expect(schema!.properties["mode"]).toBeDefined();
      expect(schema!.properties["bandwidth"]).toBeDefined();
      expect(schema!.properties["squelch"]).toBeDefined();
    });

    it("should specify required fields", () => {
      const schema = plugin.getConfigSchema();
      expect(schema!.required).toContain("mode");
    });
  });

  describe("lifecycle", () => {
    it("should activate successfully", async () => {
      await plugin.initialize();
      await plugin.activate();
      expect(plugin.state).toBe(PluginState.ACTIVE);
    });

    it("should deactivate successfully", async () => {
      await plugin.initialize();
      await plugin.activate();
      await plugin.deactivate();
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });

    it("should reset state on deactivation", async () => {
      await plugin.initialize();
      await plugin.activate();

      // Demodulate some samples to create state
      const samples: IQSample[] = [{ I: 1, Q: 0 }];
      plugin.demodulate(samples);

      await plugin.deactivate();

      // After deactivation, phase should be reset
      const audio = plugin.demodulate(samples);
      expect(audio[0]).toBe(0); // First sample after reset should be 0
    });
  });
});
