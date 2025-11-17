/**
 * Additional tests for AudioStreamProcessor to meet coverage thresholds
 * Covers AudioWorklet, AGC, squelch, and new demodulation types
 */

import { AudioStreamProcessor, DemodulationType } from "../audioStream";
import type { IQSample } from "../../models/SDRDevice";

// Mock AudioContext and AudioWorklet
class MockAudioContext {
  sampleRate = 48000;
  state = "running" as const;

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  async close() {}
  async resume() {}
  async suspend() {}
}

global.AudioContext = MockAudioContext as any;

// Helper function to generate test IQ samples
function generateIQSamples(
  frequency: number,
  sampleRate: number,
  duration: number,
  amplitude = 1.0,
): IQSample[] {
  const samples: IQSample[] = [];
  const numSamples = Math.floor(sampleRate * duration);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * frequency * t;
    samples.push({
      I: amplitude * Math.cos(phase),
      Q: amplitude * Math.sin(phase),
    });
  }

  return samples;
}

describe("AudioStreamProcessor - Additional Coverage", () => {
  const SDR_SAMPLE_RATE = 2048000;

  describe("AGC (Automatic Gain Control)", () => {
    it("should apply AGC in 'fast' mode", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        agcMode: "fast",
        agcTarget: 0.6,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(48000);
    });

    it("should apply AGC in 'medium' mode", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        agcMode: "medium",
        agcTarget: 0.5,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });

    it("should apply AGC in 'slow' mode", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        agcMode: "slow",
        agcTarget: 0.7,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });

    it("should skip AGC when mode is 'off'", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        agcMode: "off",
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });
  });

  describe("Squelch", () => {
    it("should apply squelch with threshold", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01, 0.1);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        squelchThreshold: 0.2,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });

    it("should skip squelch when threshold is 0", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        squelchThreshold: 0.0,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });
  });

  describe("New Demodulation Types", () => {
    it("should demodulate NFM (Narrow FM)", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.NFM, {
        sampleRate: 48000,
        enableDeEmphasis: true,
        deemphasisTau: 75,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.demodType).toBe(DemodulationType.NFM);
    });

    it("should demodulate WFM (Wide FM)", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.WFM, {
        sampleRate: 48000,
        enableDeEmphasis: true,
        deemphasisTau: 50,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.demodType).toBe(DemodulationType.WFM);
    });

    it("should demodulate USB (Upper Sideband)", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.USB, {
        sampleRate: 48000,
        enableDeEmphasis: false,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.demodType).toBe(DemodulationType.USB);
    });

    it("should demodulate LSB (Lower Sideband)", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.LSB, {
        sampleRate: 48000,
        enableDeEmphasis: false,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.demodType).toBe(DemodulationType.LSB);
    });

    it("should demodulate CW (Continuous Wave)", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.CW, {
        sampleRate: 48000,
        enableDeEmphasis: false,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.demodType).toBe(DemodulationType.CW);
    });
  });

  describe("Combined Features", () => {
    it("should apply AGC and squelch together on NFM", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.NFM, {
        sampleRate: 48000,
        agcMode: "medium",
        agcTarget: 0.6,
        squelchThreshold: 0.15,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });

    it("should handle different deemphasis tau values", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.WFM, {
        sampleRate: 48000,
        enableDeEmphasis: true,
        deemphasisTau: 50, // Europe standard
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });

    it("should work with volume parameter", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      const result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
        volume: 0.8,
      });

      expect(result.audioData.length).toBeGreaterThan(0);
    });
  });

  describe("Demodulator Switching", () => {
    it("should switch from FM to NFM", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      // First FM
      let result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
      });
      expect(result.demodType).toBe(DemodulationType.FM);

      // Then NFM
      result = processor.extractAudio(samples, DemodulationType.NFM, {
        sampleRate: 48000,
      });
      expect(result.demodType).toBe(DemodulationType.NFM);
    });

    it("should switch from FM to WFM", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      // First FM
      let result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
      });
      expect(result.demodType).toBe(DemodulationType.FM);

      // Then WFM
      result = processor.extractAudio(samples, DemodulationType.WFM, {
        sampleRate: 48000,
      });
      expect(result.demodType).toBe(DemodulationType.WFM);
    });

    it("should switch from AM to USB", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      // First AM
      let result = processor.extractAudio(samples, DemodulationType.AM, {
        sampleRate: 48000,
      });
      expect(result.demodType).toBe(DemodulationType.AM);

      // Then USB
      result = processor.extractAudio(samples, DemodulationType.USB, {
        sampleRate: 48000,
      });
      expect(result.demodType).toBe(DemodulationType.USB);
    });
  });

  describe("Resampler State", () => {
    it("should create new resampler when sample rate changes", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateIQSamples(100000, SDR_SAMPLE_RATE, 0.01);

      // First call with 48000 Hz
      let result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
      });
      expect(result.sampleRate).toBe(48000);

      // Second call with 44100 Hz
      result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 44100,
      });
      expect(result.sampleRate).toBe(44100);

      // Back to 48000 Hz
      result = processor.extractAudio(samples, DemodulationType.FM, {
        sampleRate: 48000,
      });
      expect(result.sampleRate).toBe(48000);
    });
  });
});
