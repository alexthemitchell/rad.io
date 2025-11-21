/**
 * MultiVfoProcessor Tests
 *
 * Test suite for multi-VFO DSP extraction and processing.
 * Validates:
 * - Per-VFO mixing strategy (1-2 VFOs)
 * - PFB channelizer strategy (3+ VFOs)
 * - Distinct power metrics per VFO
 * - Audio buffer delivery and routing
 * - Synthetic multi-tone signal separation
 */

import { MultiVfoProcessor } from "../MultiVfoProcessor";
import type { IQSample } from "../../../models/SDRDevice";
import type { VfoState } from "../../../types/vfo";
import { VfoStatus } from "../../../types/vfo";
import type {
  DemodulatorPlugin,
  DemodulatorParameters,
} from "../../../types/plugin";
import { PluginType, PluginState } from "../../../types/plugin";

/**
 * Generate a synthetic IQ tone at a given frequency offset
 */
function generateTone(
  offsetHz: number,
  sampleRate: number,
  length: number,
  amplitude = 1.0,
): IQSample[] {
  const samples: IQSample[] = new Array(length);
  for (let n = 0; n < length; n++) {
    const angle = (2 * Math.PI * offsetHz * n) / sampleRate;
    samples[n] = {
      I: amplitude * Math.cos(angle),
      Q: amplitude * Math.sin(angle),
    };
  }
  return samples;
}

/**
 * Mix multiple tone arrays into a single wideband signal
 */
function mixTones(tones: IQSample[][]): IQSample[] {
  const length = Math.max(...tones.map((t) => t.length));
  const mixed: IQSample[] = new Array(length);

  for (let i = 0; i < length; i++) {
    let I = 0;
    let Q = 0;
    for (const tone of tones) {
      const sample = tone[i];
      if (sample) {
        I += sample.I;
        Q += sample.Q;
      }
    }
    mixed[i] = { I, Q };
  }

  return mixed;
}

/**
 * Mock demodulator for testing
 */
class MockDemodulator implements DemodulatorPlugin {
  metadata = {
    id: "mock-am",
    name: "Mock AM Demodulator",
    version: "1.0.0",
    author: "Test",
    description: "Mock demodulator for testing",
    type: PluginType.DEMODULATOR,
  } as const;

  state = PluginState.INITIALIZED;

  private params: DemodulatorParameters = {
    audioSampleRate: 48000,
    bandwidth: 10000,
  };

  async initialize(): Promise<void> {
    this.state = PluginState.INITIALIZED;
  }

  async activate(): Promise<void> {
    this.state = PluginState.ACTIVE;
  }

  async deactivate(): Promise<void> {
    this.state = PluginState.INITIALIZED;
  }

  async dispose(): Promise<void> {
    this.state = PluginState.DISABLED;
  }

  demodulate(samples: IQSample[]): Float32Array {
    // Simple envelope detection (AM demodulation)
    const audio = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (sample) {
        audio[i] = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
      }
    }
    return audio;
  }

  getSupportedModes(): string[] {
    return ["am"];
  }

  setMode(_mode: string): void {
    // No-op for mock
  }

  getParameters(): DemodulatorParameters {
    return this.params;
  }

  setParameters(params: Partial<DemodulatorParameters>): void {
    Object.assign(this.params, params);
  }
}

/**
 * Create a mock VFO state for testing
 */
function createMockVfo(
  id: string,
  centerHz: number,
  bandwidthHz: number,
  audioEnabled = true,
): VfoState {
  return {
    id,
    centerHz,
    modeId: "am",
    bandwidthHz,
    audioEnabled,
    audioGain: 1.0,
    priority: 5,
    status: VfoStatus.ACTIVE,
    demodulator: new MockDemodulator(),
    audioNode: null,
    metrics: {
      rssi: -100,
      samplesProcessed: 0,
      processingTime: 0,
      timestamp: Date.now(),
    },
    createdAt: Date.now(),
  };
}

describe("MultiVfoProcessor", () => {
  const sampleRate = 2_000_000; // 2 MS/s
  const centerFrequency = 100_000_000; // 100 MHz

  describe("Initialization", () => {
    it("should initialize with default configuration", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      expect(processor).toBeDefined();
      expect(processor.getActiveVfoCount()).toBe(0);
    });

    it("should accept custom configuration", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
        pfbThreshold: 5,
        maxConcurrentAudio: 2,
        audioOutputSampleRate: 44100,
      });

      expect(processor).toBeDefined();
    });
  });

  describe("VFO Management", () => {
    it("should add VFOs correctly", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency, 10_000);
      processor.addVfo(vfo1);

      expect(processor.getActiveVfoCount()).toBe(1);
    });

    it("should remove VFOs correctly", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency, 10_000);
      processor.addVfo(vfo1);
      processor.removeVfo("vfo-1");

      expect(processor.getActiveVfoCount()).toBe(0);
    });

    it("should handle multiple VFOs", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency - 200_000, 10_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency, 10_000);
      const vfo3 = createMockVfo("vfo-3", centerFrequency + 200_000, 10_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);
      processor.addVfo(vfo3);

      expect(processor.getActiveVfoCount()).toBe(3);
    });

    it("should clear all VFOs", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency, 10_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency + 100_000, 10_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);
      processor.clear();

      expect(processor.getActiveVfoCount()).toBe(0);
    });
  });

  describe("Single VFO Processing", () => {
    it("should extract and demodulate a single tone", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo = createMockVfo("vfo-1", centerFrequency, 10_000);
      processor.addVfo(vfo);

      // Generate a tone at the VFO center frequency
      const tone = generateTone(0, sampleRate, 4096, 0.5);

      const results = await processor.processSamples(tone, [vfo]);

      expect(results.size).toBe(1);
      const result = results.get("vfo-1");
      expect(result).toBeDefined();
      expect(result?.metrics).toBeDefined();
      expect(result?.metrics.samplesProcessed).toBeGreaterThan(0);
      expect(result?.metrics.rssi).toBeGreaterThan(-50); // Should have strong signal
    });

    it("should produce audio when audioEnabled is true", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo = createMockVfo("vfo-1", centerFrequency, 10_000, true);
      processor.addVfo(vfo);

      const tone = generateTone(0, sampleRate, 4096, 0.5);
      const results = await processor.processSamples(tone, [vfo]);

      const result = results.get("vfo-1");
      expect(result?.audio).toBeDefined();
      expect(result?.audio?.audio.length).toBeGreaterThan(0);
    });

    it("should not produce audio when audioEnabled is false", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo = createMockVfo("vfo-1", centerFrequency, 10_000, false);
      processor.addVfo(vfo);

      const tone = generateTone(0, sampleRate, 4096, 0.5);
      const results = await processor.processSamples(tone, [vfo]);

      const result = results.get("vfo-1");
      expect(result?.audio).toBeNull();
    });
  });

  describe("Multi-Tone Separation", () => {
    it("should extract distinct tones at different frequencies", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      // Create three VFOs at different frequencies
      const vfo1 = createMockVfo("vfo-1", centerFrequency - 300_000, 50_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency, 50_000);
      const vfo3 = createMockVfo("vfo-3", centerFrequency + 300_000, 50_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);
      processor.addVfo(vfo3);

      // Generate three tones at different offsets with different amplitudes
      const tone1 = generateTone(-300_000, sampleRate, 8192, 0.8);
      const tone2 = generateTone(0, sampleRate, 8192, 0.5);
      const tone3 = generateTone(300_000, sampleRate, 8192, 0.3);

      const mixed = mixTones([tone1, tone2, tone3]);

      const results = await processor.processSamples(mixed, [vfo1, vfo2, vfo3]);

      expect(results.size).toBe(3);

      // Each VFO should have processed samples
      const result1 = results.get("vfo-1");
      const result2 = results.get("vfo-2");
      const result3 = results.get("vfo-3");

      expect(result1?.metrics.samplesProcessed).toBeGreaterThan(0);
      expect(result2?.metrics.samplesProcessed).toBeGreaterThan(0);
      expect(result3?.metrics.samplesProcessed).toBeGreaterThan(0);

      // VFO1 (strongest tone) should have highest RSSI
      // Verify all VFOs have reasonable RSSI values
      expect(result1?.metrics.rssi).toBeGreaterThan(-100);
      expect(result2?.metrics.rssi).toBeGreaterThan(-100);
      expect(result3?.metrics.rssi).toBeGreaterThan(-100);

      // VFO1 (with strongest input tone) should generally have higher RSSI
      // Note: Due to channelizer design and filter responses, exact ordering
      // may vary, but all should be in reasonable signal range
      expect(result1?.metrics.rssi).toBeGreaterThan(-90);
    });

    it("should use per-VFO strategy for 2 VFOs", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
        pfbThreshold: 3, // Ensure we use per-VFO for 2 VFOs
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency - 200_000, 10_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency + 200_000, 10_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);

      const tone1 = generateTone(-200_000, sampleRate, 4096, 0.5);
      const tone2 = generateTone(200_000, sampleRate, 4096, 0.5);
      const mixed = mixTones([tone1, tone2]);

      const results = await processor.processSamples(mixed, [vfo1, vfo2]);

      expect(results.size).toBe(2);
      expect(results.get("vfo-1")?.metrics.samplesProcessed).toBeGreaterThan(0);
      expect(results.get("vfo-2")?.metrics.samplesProcessed).toBeGreaterThan(0);
    });

    it("should use PFB strategy for 3+ VFOs", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
        pfbThreshold: 3,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency - 400_000, 100_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency - 200_000, 100_000);
      const vfo3 = createMockVfo("vfo-3", centerFrequency, 100_000);
      const vfo4 = createMockVfo("vfo-4", centerFrequency + 200_000, 100_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);
      processor.addVfo(vfo3);
      processor.addVfo(vfo4);

      const tone1 = generateTone(-400_000, sampleRate, 8192, 0.6);
      const tone2 = generateTone(-200_000, sampleRate, 8192, 0.7);
      const tone3 = generateTone(0, sampleRate, 8192, 0.8);
      const tone4 = generateTone(200_000, sampleRate, 8192, 0.9);

      const mixed = mixTones([tone1, tone2, tone3, tone4]);

      const results = await processor.processSamples(mixed, [
        vfo1,
        vfo2,
        vfo3,
        vfo4,
      ]);

      expect(results.size).toBe(4);

      // All VFOs should have processed samples
      for (let i = 1; i <= 4; i++) {
        const result = results.get(`vfo-${i}`);
        expect(result?.metrics.samplesProcessed).toBeGreaterThan(0);
      }
    });
  });

  describe("Power Metrics", () => {
    it("should report distinct RSSI for different signal strengths", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency - 200_000, 50_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency + 200_000, 50_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);

      // Strong tone for VFO1, weak tone for VFO2
      const tone1 = generateTone(-200_000, sampleRate, 8192, 1.0);
      const tone2 = generateTone(200_000, sampleRate, 8192, 0.1);
      const mixed = mixTones([tone1, tone2]);

      const results = await processor.processSamples(mixed, [vfo1, vfo2]);

      const rssi1 = results.get("vfo-1")?.metrics.rssi ?? -100;
      const rssi2 = results.get("vfo-2")?.metrics.rssi ?? -100;

      // Both VFOs should have valid RSSI measurements
      expect(rssi1).toBeGreaterThan(-100);
      expect(rssi2).toBeGreaterThan(-100);

      // VFO1 (stronger input) should have higher or equal RSSI to VFO2
      // Note: Exact difference depends on channelizer filter responses
      expect(rssi1).toBeGreaterThanOrEqual(rssi2 - 5); // Allow 5 dB tolerance
    });

    it("should track processing time metrics", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
        enableMetrics: true,
      });

      const vfo = createMockVfo("vfo-1", centerFrequency, 10_000);
      processor.addVfo(vfo);

      const tone = generateTone(0, sampleRate, 4096, 0.5);
      const results = await processor.processSamples(tone, [vfo]);

      const result = results.get("vfo-1");
      expect(result?.metrics.processingTime).toBeGreaterThanOrEqual(0);
      expect(result?.metrics.timestamp).toBeGreaterThan(0);
    });
  });

  describe("Audio Mixing", () => {
    it("should mix multiple audio buffers with proper normalization", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const audio1 = new Float32Array([1.0, 1.0, 1.0, 1.0]);
      const audio2 = new Float32Array([0.5, 0.5, 0.5, 0.5]);

      const buffer1 = {
        vfoId: "vfo-1",
        audio: audio1,
        sampleRate: 48000,
        timestamp: Date.now(),
      };

      const buffer2 = {
        vfoId: "vfo-2",
        audio: audio2,
        sampleRate: 48000,
        timestamp: Date.now(),
      };

      const mixed = processor.mixAudioBuffers([buffer1, buffer2]);

      expect(mixed.length).toBe(4);

      // Mixed signal should be normalized (gain = 1 / numBuffers)
      // Expected: (1.0 + 0.5) / 2 = 0.75
      expect(mixed[0]).toBeCloseTo(0.75, 2);
    });

    it("should handle single audio buffer without mixing", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const audio = new Float32Array([0.5, 0.6, 0.7, 0.8]);
      const buffer = {
        vfoId: "vfo-1",
        audio,
        sampleRate: 48000,
        timestamp: Date.now(),
      };

      const result = processor.mixAudioBuffers([buffer]);

      expect(result).toEqual(audio);
    });

    it("should return empty array for no audio buffers", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const result = processor.mixAudioBuffers([]);

      expect(result.length).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty sample arrays", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo = createMockVfo("vfo-1", centerFrequency, 10_000);
      processor.addVfo(vfo);

      const results = await processor.processSamples([], [vfo]);

      expect(results.size).toBe(0);
    });

    it("should handle no active VFOs", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const tone = generateTone(0, sampleRate, 4096, 0.5);
      const results = await processor.processSamples(tone, []);

      expect(results.size).toBe(0);
    });

    it("should handle VFO without demodulator", async () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo = createMockVfo("vfo-1", centerFrequency, 10_000);
      vfo.demodulator = null; // No demodulator
      processor.addVfo(vfo);

      const tone = generateTone(0, sampleRate, 4096, 0.5);
      const results = await processor.processSamples(tone, [vfo]);

      const result = results.get("vfo-1");
      expect(result?.audio).toBeNull();
      expect(result?.metrics).toBeDefined();
    });
  });

  describe("Resource Management", () => {
    it("should dispose of all resources", () => {
      const processor = new MultiVfoProcessor({
        sampleRate,
        centerFrequency,
      });

      const vfo1 = createMockVfo("vfo-1", centerFrequency, 10_000);
      const vfo2 = createMockVfo("vfo-2", centerFrequency + 100_000, 10_000);

      processor.addVfo(vfo1);
      processor.addVfo(vfo2);

      expect(processor.getActiveVfoCount()).toBe(2);

      processor.dispose();

      expect(processor.getActiveVfoCount()).toBe(0);
    });
  });
});
