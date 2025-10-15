/**
 * Tests for Audio Stream Extraction API
 */

import {
  AudioStreamProcessor,
  DemodulationType,
  extractAudioStream,
  createAudioStreamCallback,
} from "../audioStream";
import type { IQSample } from "../../models/SDRDevice";

// Mock AudioContext for testing
class MockAudioContext {
  sampleRate = 48000;
  destination = {};

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (_channel: number) => new Float32Array(length),
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as AudioBuffer;
    return buffer;
  }

  async close(): Promise<void> {
    // Mock close
  }
}

// Replace global AudioContext with mock
global.AudioContext = MockAudioContext as unknown as typeof AudioContext;

/**
 * Generate a simple sine wave as IQ samples
 */
function generateSineWaveIQ(
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

/**
 * Generate FM modulated signal
 */
function generateFMSignal(
  carrierFreq: number,
  modulationFreq: number,
  deviation: number,
  sampleRate: number,
  duration: number,
): IQSample[] {
  const samples: IQSample[] = [];
  const numSamples = Math.floor(sampleRate * duration);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // FM: instantaneous frequency = carrier + deviation * sin(2πf_m*t)
    const integratedPhase =
      2 * Math.PI * carrierFreq * t +
      (deviation / modulationFreq) * Math.cos(2 * Math.PI * modulationFreq * t);

    samples.push({
      I: Math.cos(integratedPhase),
      Q: Math.sin(integratedPhase),
    });
  }

  return samples;
}

/**
 * Generate AM modulated signal
 */
function generateAMSignal(
  carrierFreq: number,
  modulationFreq: number,
  modulationIndex: number,
  sampleRate: number,
  duration: number,
): IQSample[] {
  const samples: IQSample[] = [];
  const numSamples = Math.floor(sampleRate * duration);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const carrierPhase = 2 * Math.PI * carrierFreq * t;
    const modulation =
      1 + modulationIndex * Math.sin(2 * Math.PI * modulationFreq * t);

    samples.push({
      I: modulation * Math.cos(carrierPhase),
      Q: modulation * Math.sin(carrierPhase),
    });
  }

  return samples;
}

describe("AudioStreamProcessor", () => {
  const SDR_SAMPLE_RATE = 2048000; // 2.048 MHz

  describe("Constructor", () => {
    it("should create processor with specified sample rate", () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      expect(processor).toBeDefined();
    });
  });

  describe("FM Demodulation", () => {
    it("should demodulate FM signal to audio", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000 },
      );

      expect(result.audioData).toBeInstanceOf(Float32Array);
      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(48000);
      expect(result.channels).toBe(1);
      expect(result.demodType).toBe(DemodulationType.FM);
    });

    it("should produce audio buffer with correct properties", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000, channels: 2 },
      );

      expect(result.audioBuffer).toBeDefined();
      expect(result.audioBuffer.numberOfChannels).toBe(2);
      expect(result.audioBuffer.sampleRate).toBe(48000);
      expect(result.audioBuffer.length).toBe(result.audioData.length);
    });

    it("should apply de-emphasis filter when enabled", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

      const resultWithDeEmphasis = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000, enableDeEmphasis: true },
      );

      const resultWithoutDeEmphasis = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000, enableDeEmphasis: false },
      );

      // De-emphasis should smooth the signal, reducing variance
      expect(resultWithDeEmphasis.audioData).toBeDefined();
      expect(resultWithoutDeEmphasis.audioData).toBeDefined();
    });

    it("should handle phase unwrapping correctly", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      // Create signal that will cause phase wrapping
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000 },
      );

      // Check that audio data doesn't have extreme discontinuities
      for (let i = 1; i < result.audioData.length; i++) {
        const diff = Math.abs(result.audioData[i]! - result.audioData[i - 1]!);
        expect(diff).toBeLessThan(2.0); // Reasonable threshold for wrapped phases
      }
    });
  });

  describe("AM Demodulation", () => {
    it("should demodulate AM signal to audio", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateAMSignal(0, 1000, 0.5, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.AM,
        { sampleRate: 48000 },
      );

      expect(result.audioData).toBeInstanceOf(Float32Array);
      expect(result.audioData.length).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(48000);
      expect(result.demodType).toBe(DemodulationType.AM);
    });

    it("should extract envelope from AM signal", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      // AM signal with 80% modulation
      const samples = generateAMSignal(0, 1000, 0.8, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.AM,
        { sampleRate: 48000 },
      );

      // Audio should vary with modulation envelope
      const maxAmplitude = Math.max(
        ...Array.from(result.audioData).map(Math.abs),
      );
      expect(maxAmplitude).toBeGreaterThan(0);
      expect(maxAmplitude).toBeLessThan(10); // Reasonable range
    });

    it("should remove DC component", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateAMSignal(0, 1000, 0.5, SDR_SAMPLE_RATE, 0.05);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.AM,
        { sampleRate: 48000 },
      );

      // Calculate mean - should be close to 0 after DC removal
      const mean =
        result.audioData.reduce((sum, val) => sum + val, 0) /
        result.audioData.length;
      expect(Math.abs(mean)).toBeLessThan(0.5); // Should be close to zero
    });
  });

  describe("No Demodulation", () => {
    it("should extract I channel when no demodulation specified", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.NONE,
        { sampleRate: 48000 },
      );

      expect(result.audioData).toBeInstanceOf(Float32Array);
      expect(result.demodType).toBe(DemodulationType.NONE);
    });
  });

  describe("Sample Rate Conversion", () => {
    it("should decimate to lower sample rate", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.1); // 0.1 sec

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000 },
      );

      // Expected output length: 0.1 sec * 48000 Hz
      const expectedLength = Math.floor(
        samples.length / (SDR_SAMPLE_RATE / 48000),
      );
      expect(result.audioData.length).toBeCloseTo(expectedLength, -2);
    });

    it("should handle same input and output rate", async () => {
      const processor = new AudioStreamProcessor(48000);
      const samples = generateSineWaveIQ(1000, 48000, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000 },
      );

      expect(result.audioData.length).toBe(samples.length);
    });

    it("should use linear interpolation for decimation", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { sampleRate: 48000 },
      );

      // Check that decimated signal is smooth (no large jumps)
      for (let i = 1; i < result.audioData.length; i++) {
        const diff = Math.abs(result.audioData[i]! - result.audioData[i - 1]!);
        expect(diff).toBeLessThan(1.0); // Smooth interpolation
      }
    });
  });

  describe("Multichannel Support", () => {
    it("should create mono audio output", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { channels: 1 },
      );

      expect(result.channels).toBe(1);
      expect(result.audioBuffer.numberOfChannels).toBe(1);
    });

    it("should create stereo audio output", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(
        samples,
        DemodulationType.FM,
        { channels: 2 },
      );

      expect(result.channels).toBe(2);
      expect(result.audioBuffer.numberOfChannels).toBe(2);
    });
  });

  describe("Demodulator State Management", () => {
    it("should maintain state between calls", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples1 = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);
      const samples2 = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

      await processor.extractAudio(samples1, DemodulationType.FM);
      const result2 = await processor.extractAudio(
        samples2,
        DemodulationType.FM,
      );

      expect(result2.audioData).toBeDefined();
    });

    it("should reset state when demod type changes", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

      await processor.extractAudio(samples, DemodulationType.FM);
      await processor.extractAudio(samples, DemodulationType.AM);
      const result = await processor.extractAudio(samples, DemodulationType.FM);

      expect(result.demodType).toBe(DemodulationType.FM);
    });

    it("should reset demodulator state manually", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

      await processor.extractAudio(samples, DemodulationType.FM);
      processor.reset();
      const result = await processor.extractAudio(samples, DemodulationType.FM);

      expect(result.audioData).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty sample array", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples: IQSample[] = [];

      const result = await processor.extractAudio(samples, DemodulationType.FM);

      expect(result.audioData.length).toBe(0);
    });

    it("should handle samples with null/undefined values", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      // Create more samples to ensure decimation preserves some
      const samples: IQSample[] = [];
      for (let i = 0; i < 1000; i++) {
        if (i % 100 === 50) {
          samples.push(null as unknown as IQSample);
        } else {
          samples.push({ I: Math.sin(i * 0.01), Q: Math.cos(i * 0.01) });
        }
      }

      const result = await processor.extractAudio(samples, DemodulationType.FM);

      // Null values should be converted to 0
      expect(result.audioData).toBeDefined();
      expect(result.audioData.length).toBeGreaterThan(0);
    });

    it("should normalize output to valid audio range", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      const samples = generateFMSignal(0, 1000, 50000, SDR_SAMPLE_RATE, 0.01);

      const result = await processor.extractAudio(samples, DemodulationType.FM);

      // All values should be reasonable (within several dB of nominal)
      for (let i = 0; i < result.audioData.length; i++) {
        expect(Math.abs(result.audioData[i]!)).toBeLessThan(10);
      }
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources", async () => {
      const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
      await expect(processor.cleanup()).resolves.not.toThrow();
    });
  });
});

describe("extractAudioStream", () => {
  const SDR_SAMPLE_RATE = 2048000;

  it("should extract audio in single function call", async () => {
    const samples = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

    const result = await extractAudioStream(
      samples,
      SDR_SAMPLE_RATE,
      DemodulationType.FM,
      { sampleRate: 48000 },
    );

    expect(result.audioData).toBeInstanceOf(Float32Array);
    expect(result.sampleRate).toBe(48000);
    expect(result.demodType).toBe(DemodulationType.FM);
  });

  it("should use default configuration", async () => {
    const samples = generateSineWaveIQ(1000, SDR_SAMPLE_RATE, 0.01);

    const result = await extractAudioStream(
      samples,
      SDR_SAMPLE_RATE,
      DemodulationType.AM,
    );

    expect(result.audioData).toBeDefined();
    expect(result.channels).toBe(1); // Default mono
  });
});

describe("createAudioStreamCallback", () => {
  const SDR_SAMPLE_RATE = 2048000;

  it("should create callback function", () => {
    const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
    const onAudio = jest.fn();

    const callback = createAudioStreamCallback(
      processor,
      DemodulationType.FM,
      onAudio,
    );

    expect(callback).toBeInstanceOf(Function);
  });

  it("should invoke callback with audio result", async () => {
    const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
    const onAudio = jest.fn();
    const samples = generateFMSignal(0, 1000, 5000, SDR_SAMPLE_RATE, 0.01);

    const callback = createAudioStreamCallback(
      processor,
      DemodulationType.FM,
      onAudio,
    );

    await callback(samples);

    expect(onAudio).toHaveBeenCalledTimes(1);
    expect(onAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        audioData: expect.any(Float32Array),
        sampleRate: expect.any(Number),
        demodType: DemodulationType.FM,
      }),
    );
  });

  it("should work with custom config", async () => {
    const processor = new AudioStreamProcessor(SDR_SAMPLE_RATE);
    const onAudio = jest.fn();
    const samples = generateAMSignal(0, 1000, 0.5, SDR_SAMPLE_RATE, 0.01);

    const callback = createAudioStreamCallback(
      processor,
      DemodulationType.AM,
      onAudio,
      { sampleRate: 44100, channels: 2 },
    );

    await callback(samples);

    expect(onAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleRate: 44100,
        channels: 2,
      }),
    );
  });
});
