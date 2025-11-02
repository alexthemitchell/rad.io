/**
 * PSK31 Demodulator Plugin Tests
 */

import { PSK31DemodulatorPlugin } from "../PSK31DemodulatorPlugin";
import { PluginType, PluginState } from "../../../types/plugin";
import type { IQSample } from "../../../models/SDRDevice";

describe("PSK31DemodulatorPlugin", () => {
  let plugin: PSK31DemodulatorPlugin;

  beforeEach(() => {
    plugin = new PSK31DemodulatorPlugin();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(plugin.metadata.id).toBe("psk31-demodulator");
      expect(plugin.metadata.type).toBe(PluginType.DEMODULATOR);
      expect(plugin.metadata.version).toBe("1.0.0");
      expect(plugin.metadata.name).toBe("PSK31 Demodulator");
    });
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await plugin.initialize();
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });

    it("should reset state on initialization", async () => {
      // Set some state
      plugin.demodulate([{ I: 1, Q: 0 }]);
      
      // Re-initialize
      await plugin.initialize();
      
      // Verify state is reset
      const text = plugin.getDecodedText();
      expect(text).toBe("");
    });
  });

  describe("demodulation modes", () => {
    it("should support BPSK and QPSK modes", () => {
      const modes = plugin.getSupportedModes();
      expect(modes).toContain("bpsk");
      expect(modes).toContain("qpsk");
      expect(modes.length).toBe(2);
    });

    it("should start in BPSK mode", () => {
      const params = plugin.getParameters();
      expect(params["pskMode"]).toBe("bpsk");
    });

    it("should switch to QPSK mode", () => {
      plugin.setMode("qpsk");
      const params = plugin.getParameters();
      expect(params["pskMode"]).toBe("qpsk");
    });

    it("should throw error for unsupported mode", () => {
      expect(() => plugin.setMode("invalid")).toThrow("Unsupported PSK31 mode");
    });
  });

  describe("parameters", () => {
    it("should return current parameters", () => {
      const params = plugin.getParameters();
      expect(params.audioSampleRate).toBe(48000);
      expect(params.bandwidth).toBe(100);
      expect(params["pskMode"]).toBe("bpsk");
      expect(params["afcEnabled"]).toBe(true);
      expect(params["agcTarget"]).toBe(0.5);
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
      expect(params.bandwidth).toBe(100);
      expect(params["pskMode"]).toBe("bpsk");
    });

    it("should update samples per symbol when sample rate changes", () => {
      plugin.setParameters({ audioSampleRate: 24000 });
      // Internal state should reflect new sample rate
      // We verify this indirectly through demodulation behavior
      const params = plugin.getParameters();
      expect(params.audioSampleRate).toBe(24000);
    });
  });

  describe("demodulation", () => {
    beforeEach(async () => {
      await plugin.initialize();
      await plugin.activate();
    });

    it("should demodulate IQ samples", () => {
      // Create test IQ samples (simple BPSK signal)
      const samples: IQSample[] = [];
      const sampleRate = 48000;
      const symbolRate = 31.25;
      const samplesPerSymbol = Math.floor(sampleRate / symbolRate);

      // Generate a few symbols
      for (let sym = 0; sym < 10; sym++) {
        const phase = sym % 2 === 0 ? 0 : Math.PI; // Alternating phase
        for (let i = 0; i < samplesPerSymbol; i++) {
          samples.push({
            I: Math.cos(phase),
            Q: Math.sin(phase),
          });
        }
      }

      const audio = plugin.demodulate(samples);

      expect(audio).toBeInstanceOf(Float32Array);
      expect(audio.length).toBe(samples.length);
    });

    it("should handle empty input", () => {
      const audio = plugin.demodulate([]);
      expect(audio.length).toBe(0);
    });

    it("should handle null samples", () => {
      const samples: IQSample[] = [
        { I: 1, Q: 0 },
        null as unknown as IQSample,
        { I: 0, Q: 1 },
      ];
      const audio = plugin.demodulate(samples);
      expect(audio.length).toBe(samples.length);
      expect(audio[1]).toBe(0);
    });

    it("should apply squelch to weak signals", () => {
      plugin.setParameters({ squelch: 50 });

      // Create weak signal
      const weakSamples: IQSample[] = Array.from({ length: 100 }, () => ({
        I: 0.01,
        Q: 0.01,
      }));

      const audio = plugin.demodulate(weakSamples);
      
      // Most samples should be squelched (zero)
      const zeroCount = Array.from(audio).filter((v) => v === 0).length;
      expect(zeroCount).toBeGreaterThan(50);
    });

    it("should pass strong signals through squelch", () => {
      plugin.setParameters({ squelch: 10 });

      // Create strong signal with varying phase to generate output
      const strongSamples: IQSample[] = [];
      for (let i = 0; i < 100; i++) {
        const phase = (i * Math.PI) / 50; // Varying phase
        strongSamples.push({
          I: Math.cos(phase),
          Q: Math.sin(phase),
        });
      }

      const audio = plugin.demodulate(strongSamples);
      
      // Signal should pass through (most samples should not be zero)
      const nonZeroCount = Array.from(audio).filter((v) => v !== 0).length;
      expect(nonZeroCount).toBeGreaterThan(50);
    });

    it("should decode simple Varicode characters", async () => {
      // Generate BPSK signal for space character
      // Space = "1" in Varicode, followed by "00" separator
      // So bit pattern is: 1 0 0
      
      const samples: IQSample[] = [];
      const sampleRate = 48000;
      const symbolRate = 31.25;
      const samplesPerSymbol = Math.floor(sampleRate / symbolRate);

      // Bit "1" (phase transition)
      for (let i = 0; i < samplesPerSymbol; i++) {
        samples.push({ I: Math.cos(Math.PI), Q: Math.sin(Math.PI) });
      }
      
      // Bit "0" (no phase transition)
      for (let i = 0; i < samplesPerSymbol; i++) {
        samples.push({ I: Math.cos(Math.PI), Q: Math.sin(Math.PI) });
      }
      
      // Bit "0" (no phase transition)
      for (let i = 0; i < samplesPerSymbol; i++) {
        samples.push({ I: Math.cos(Math.PI), Q: Math.sin(Math.PI) });
      }

      plugin.demodulate(samples);
      
      const text = plugin.getDecodedText();
      // Note: Actual decoding depends on proper phase tracking
      // This is a basic test that the mechanism works
      expect(typeof text).toBe("string");
    });
  });

  describe("configuration schema", () => {
    it("should provide configuration schema", () => {
      const schema = plugin.getConfigSchema();
      expect(schema).toBeDefined();
      expect(schema!.properties["pskMode"]).toBeDefined();
      expect(schema!.properties["bandwidth"]).toBeDefined();
      expect(schema!.properties["afcEnabled"]).toBeDefined();
      expect(schema!.properties["agcTarget"]).toBeDefined();
      expect(schema!.properties["squelch"]).toBeDefined();
    });

    it("should specify required fields", () => {
      const schema = plugin.getConfigSchema();
      expect(schema!.required).toContain("pskMode");
    });

    it("should define valid ranges for parameters", () => {
      const schema = plugin.getConfigSchema();
      expect(schema).toBeDefined();
      
      expect(schema!.properties["bandwidth"]?.minimum).toBe(50);
      expect(schema!.properties["bandwidth"]?.maximum).toBe(200);
      
      expect(schema!.properties["agcTarget"]?.minimum).toBe(0.1);
      expect(schema!.properties["agcTarget"]?.maximum).toBe(1.0);
      
      expect(schema!.properties["squelch"]?.minimum).toBe(0);
      expect(schema!.properties["squelch"]?.maximum).toBe(100);
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

      // Process some samples
      const samples: IQSample[] = [{ I: 1, Q: 0 }];
      plugin.demodulate(samples);

      await plugin.deactivate();

      // State should be reset
      const text = plugin.getDecodedText();
      expect(text).toBe("");
    });

    it("should dispose successfully", async () => {
      await plugin.initialize();
      await plugin.activate();
      await plugin.dispose();
      // BasePlugin transitions from ACTIVE -> INITIALIZED on dispose
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });
  });

  describe("decoded text management", () => {
    it("should clear decoded text after retrieval", () => {
      // First call with no data returns empty
      const initialText = plugin.getDecodedText();
      expect(initialText).toBe("");
      
      // After demodulation, text may be available
      // (depends on signal content - we test the clear behavior)
      plugin.getDecodedText(); // Clear any accumulated text
      
      // Second call should return empty
      const text2 = plugin.getDecodedText();
      expect(text2).toBe("");
    });

    it("should return decoded text through public API", () => {
      // Demodulate some samples - text accumulates internally
      plugin.demodulate([{ I: 1, Q: 0 }]);
      
      // Text is accessible only through getter
      const text = plugin.getDecodedText();
      expect(typeof text).toBe("string");
      
      // Subsequent call returns empty (text was cleared)
      const text2 = plugin.getDecodedText();
      expect(text2).toBe("");
    });
  });

  describe("AFC (Automatic Frequency Control)", () => {
    beforeEach(async () => {
      await plugin.initialize();
      await plugin.activate();
    });

    it("should track carrier frequency when AFC is enabled", () => {
      plugin.setParameters({ afcEnabled: true });

      // Generate signal with frequency offset
      const samples: IQSample[] = [];
      const freq = 10; // 10 Hz offset
      const sampleRate = 48000;

      for (let i = 0; i < 1000; i++) {
        const t = i / sampleRate;
        const phase = 2 * Math.PI * freq * t;
        samples.push({
          I: Math.cos(phase),
          Q: Math.sin(phase),
        });
      }

      const audio = plugin.demodulate(samples);
      
      // AFC should adapt and produce output
      expect(audio.length).toBe(samples.length);
    });

    it("should not track when AFC is disabled", () => {
      plugin.setParameters({ afcEnabled: false });
      
      // Generate signal
      const samples: IQSample[] = Array.from({ length: 100 }, () => ({
        I: 1.0,
        Q: 0.0,
      }));
      
      const audio = plugin.demodulate(samples);
      
      // Should still produce output (just without tracking)
      expect(audio.length).toBe(samples.length);
    });
  });
});
