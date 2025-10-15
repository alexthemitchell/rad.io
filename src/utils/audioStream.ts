/**
 * Audio Stream Extraction API
 *
 * Provides clean audio output from raw IQ samples through a complete
 * demodulation pipeline. This API extracts human-understandable audio
 * suitable for AI processing (speech recognition, etc.) from radio signals.
 *
 * Signal Processing Pipeline:
 * ===========================
 * 1. Raw IQ Samples (from SDR hardware)
 *    ↓
 * 2. Normalization (convert to -1.0 to 1.0 range)
 *    ↓
 * 3. Demodulation (FM or AM)
 *    - FM: Phase discrimination and differentiation
 *    - AM: Envelope detection via magnitude calculation
 *    ↓
 * 4. De-emphasis Filter (FM only, 75μs time constant)
 *    ↓
 * 5. Audio Decimation (downsample to audio rate, typically 48kHz)
 *    ↓
 * 6. Audio Output (stereo or mono Float32Array)
 *
 * @module audioStream
 */

import type { IQSample } from "../models/SDRDevice";

/**
 * Audio output format configuration
 */
export type AudioOutputConfig = {
  /** Output sample rate in Hz (default: 48000) */
  sampleRate?: number;
  /** Number of audio channels: 1 for mono, 2 for stereo (default: 1) */
  channels?: 1 | 2;
  /** Enable de-emphasis filter for FM (default: true) */
  enableDeEmphasis?: boolean;
};

/**
 * Demodulation type
 */
export enum DemodulationType {
  FM = "FM",
  AM = "AM",
  NONE = "NONE",
}

/**
 * Audio stream result containing processed audio data
 */
export type AudioStreamResult = {
  /** Demodulated audio samples as Float32Array (-1.0 to 1.0) */
  audioData: Float32Array;
  /** Sample rate of the audio data in Hz */
  sampleRate: number;
  /** Number of channels (1 = mono, 2 = stereo) */
  channels: number;
  /** Demodulation type used */
  demodType: DemodulationType;
  /** AudioBuffer for direct Web Audio API usage */
  audioBuffer: AudioBuffer;
};

/**
 * FM Demodulator Class
 *
 * Implements frequency demodulation using phase discrimination.
 * Converts frequency variations in the carrier to amplitude variations in audio.
 *
 * Algorithm:
 * 1. Calculate instantaneous phase: φ(t) = atan2(Q, I)
 * 2. Calculate phase difference: Δφ = φ(t) - φ(t-1)
 * 3. Unwrap phase (handle 2π discontinuities)
 * 4. Phase difference is proportional to frequency deviation
 * 5. Apply de-emphasis filter (75μs time constant for broadcast FM)
 */
class FMDemodulator {
  private previousPhase = 0;
  private deEmphasisState = 0;
  private readonly deEmphasisAlpha: number;

  constructor(sampleRate: number, enableDeEmphasis = true) {
    // De-emphasis filter: 75μs time constant for broadcast FM
    // α = 1 / (1 + RC*fs) where RC = 75e-6 for broadcast FM
    const RC = 75e-6;
    this.deEmphasisAlpha = enableDeEmphasis ? 1 / (1 + RC * sampleRate) : 1.0;
  }

  /**
   * Demodulate IQ samples to audio using FM discrimination
   */
  demodulate(samples: IQSample[]): Float32Array {
    const audioSamples = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        audioSamples[i] = 0;
        continue;
      }

      // Calculate instantaneous phase
      const phase = Math.atan2(sample.Q, sample.I);

      // Calculate phase difference (frequency deviation)
      let phaseDiff = phase - this.previousPhase;

      // Unwrap phase: handle 2π discontinuities
      if (phaseDiff > Math.PI) {
        phaseDiff -= 2 * Math.PI;
      } else if (phaseDiff < -Math.PI) {
        phaseDiff += 2 * Math.PI;
      }

      // Phase difference is proportional to frequency deviation
      // Normalize to audio range
      let audio = phaseDiff / Math.PI;

      // Apply de-emphasis filter (IIR low-pass filter)
      this.deEmphasisState =
        this.deEmphasisAlpha * audio +
        (1 - this.deEmphasisAlpha) * this.deEmphasisState;
      audio = this.deEmphasisState;

      audioSamples[i] = audio;
      this.previousPhase = phase;
    }

    return audioSamples;
  }

  /**
   * Reset demodulator state
   */
  reset(): void {
    this.previousPhase = 0;
    this.deEmphasisState = 0;
  }
}

/**
 * AM Demodulator Class
 *
 * Implements amplitude demodulation using envelope detection.
 * Extracts the amplitude envelope from the modulated carrier.
 *
 * Algorithm:
 * 1. Calculate magnitude: |signal| = sqrt(I² + Q²)
 * 2. Remove DC component (subtract running average)
 * 3. Normalize to audio range
 */
class AMDemodulator {
  private dcFilterState = 0;
  private readonly dcFilterAlpha = 0.001; // DC removal filter coefficient

  /**
   * Demodulate IQ samples to audio using envelope detection
   */
  demodulate(samples: IQSample[]): Float32Array {
    const audioSamples = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        audioSamples[i] = 0;
        continue;
      }

      // Calculate envelope (magnitude)
      const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);

      // Remove DC component using IIR filter
      this.dcFilterState =
        this.dcFilterAlpha * magnitude +
        (1 - this.dcFilterAlpha) * this.dcFilterState;

      // Subtract DC and normalize
      const audio = (magnitude - this.dcFilterState) * 2.0;

      audioSamples[i] = audio;
    }

    return audioSamples;
  }

  /**
   * Reset demodulator state
   */
  reset(): void {
    this.dcFilterState = 0;
  }
}

/**
 * Audio Stream Processor
 *
 * Main class for extracting clean audio from IQ samples.
 * Handles demodulation, decimation, and format conversion.
 */
export class AudioStreamProcessor {
  private fmDemodulator: FMDemodulator | null = null;
  private amDemodulator: AMDemodulator | null = null;
  private audioContext: AudioContext;
  private currentDemodType: DemodulationType = DemodulationType.NONE;

  constructor(private sdrSampleRate: number) {
    // Create audio context for buffer generation
    this.audioContext = new AudioContext();
  }

  /**
   * Extract audio from IQ samples using specified demodulation
   *
   * @param samples - Array of IQ samples from SDR
   * @param demodType - Type of demodulation to apply (FM or AM)
   * @param config - Audio output configuration
   * @returns Audio stream result with processed audio data
   *
   * @example
   * ```typescript
   * const processor = new AudioStreamProcessor(2048000); // 2.048 MHz sample rate
   * const result = await processor.extractAudio(iqSamples, DemodulationType.FM, {
   *   sampleRate: 48000,
   *   channels: 1,
   *   enableDeEmphasis: true
   * });
   *
   * // Use with Web Audio API
   * const source = audioContext.createBufferSource();
   * source.buffer = result.audioBuffer;
   * source.connect(audioContext.destination);
   * source.start();
   * ```
   */
  async extractAudio(
    samples: IQSample[],
    demodType: DemodulationType,
    config: AudioOutputConfig = {},
  ): Promise<AudioStreamResult> {
    const {
      sampleRate = 48000,
      channels = 1,
      enableDeEmphasis = true,
    } = config;

    // Initialize demodulator if needed
    if (this.currentDemodType !== demodType) {
      this.currentDemodType = demodType;
      this.fmDemodulator = null;
      this.amDemodulator = null;

      if (demodType === DemodulationType.FM) {
        this.fmDemodulator = new FMDemodulator(
          this.sdrSampleRate,
          enableDeEmphasis,
        );
      } else if (demodType === DemodulationType.AM) {
        this.amDemodulator = new AMDemodulator();
      }
    }

    // Demodulate based on type
    let audioSamples: Float32Array;
    if (demodType === DemodulationType.FM && this.fmDemodulator) {
      audioSamples = this.fmDemodulator.demodulate(samples);
    } else if (demodType === DemodulationType.AM && this.amDemodulator) {
      audioSamples = this.amDemodulator.demodulate(samples);
    } else {
      // No demodulation - just convert I/Q to mono by taking I channel
      audioSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        audioSamples[i] = samples[i]?.I || 0;
      }
    }

    // Decimate to target sample rate if needed
    const decimatedSamples = this.decimateAudio(
      audioSamples,
      this.sdrSampleRate,
      sampleRate,
    );

    // Create AudioBuffer for Web Audio API
    const audioBuffer = this.audioContext.createBuffer(
      channels,
      decimatedSamples.length,
      sampleRate,
    );

    // Fill audio buffer channels
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      channelData.set(decimatedSamples);
    }

    return {
      audioData: decimatedSamples,
      sampleRate,
      channels,
      demodType,
      audioBuffer,
    };
  }

  /**
   * Decimate audio samples to target sample rate
   *
   * Uses simple linear interpolation for downsampling.
   * For production use, consider adding anti-aliasing filter.
   */
  private decimateAudio(
    samples: Float32Array,
    inputRate: number,
    outputRate: number,
  ): Float32Array {
    if (inputRate === outputRate) {
      return samples;
    }

    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(samples.length / ratio);
    const decimated = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index0 = Math.floor(sourceIndex);
      const index1 = Math.min(index0 + 1, samples.length - 1);
      const frac = sourceIndex - index0;

      // Linear interpolation
      decimated[i] = samples[index0]! * (1 - frac) + samples[index1]! * frac;
    }

    return decimated;
  }

  /**
   * Reset all demodulator states
   */
  reset(): void {
    this.fmDemodulator?.reset();
    this.amDemodulator?.reset();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.audioContext.close();
  }
}

/**
 * Convenience function to extract audio from IQ samples
 *
 * Creates a temporary processor for one-time audio extraction.
 * For repeated use, create an AudioStreamProcessor instance.
 *
 * @param samples - Array of IQ samples from SDR
 * @param sdrSampleRate - Sample rate of the SDR device in Hz
 * @param demodType - Type of demodulation (FM or AM)
 * @param config - Audio output configuration
 * @returns Audio stream result
 *
 * @example
 * ```typescript
 * // Extract FM audio from HackRF samples
 * const result = await extractAudioStream(
 *   iqSamples,
 *   20000000,  // 20 MHz SDR sample rate
 *   DemodulationType.FM,
 *   { sampleRate: 48000, channels: 1 }
 * );
 *
 * // Play through speakers
 * const audioContext = new AudioContext();
 * const source = audioContext.createBufferSource();
 * source.buffer = result.audioBuffer;
 * source.connect(audioContext.destination);
 * source.start();
 * ```
 */
export async function extractAudioStream(
  samples: IQSample[],
  sdrSampleRate: number,
  demodType: DemodulationType,
  config: AudioOutputConfig = {},
): Promise<AudioStreamResult> {
  const processor = new AudioStreamProcessor(sdrSampleRate);
  const result = await processor.extractAudio(samples, demodType, config);
  await processor.cleanup();
  return result;
}

/**
 * Stream audio continuously from IQ sample callback
 *
 * Creates a streaming processor that can handle continuous IQ data.
 * Useful for real-time audio playback from SDR receiver.
 *
 * @example
 * ```typescript
 * const audioContext = new AudioContext();
 * const processor = new AudioStreamProcessor(2048000);
 *
 * // Setup audio playback
 * const playAudio = async (audioBuffer: AudioBuffer) => {
 *   const source = audioContext.createBufferSource();
 *   source.buffer = audioBuffer;
 *   source.connect(audioContext.destination);
 *   source.start();
 * };
 *
 * // Start receiving from SDR
 * await device.receive(async (dataView) => {
 *   const iqSamples = device.parseSamples(dataView);
 *   const result = await processor.extractAudio(
 *     iqSamples,
 *     DemodulationType.FM,
 *     { sampleRate: 48000 }
 *   );
 *   await playAudio(result.audioBuffer);
 * });
 * ```
 */
export function createAudioStreamCallback(
  processor: AudioStreamProcessor,
  demodType: DemodulationType,
  onAudio: (result: AudioStreamResult) => void,
  config: AudioOutputConfig = {},
): (samples: IQSample[]) => Promise<void> {
  return async (samples: IQSample[]) => {
    const result = await processor.extractAudio(samples, demodType, config);
    onAudio(result);
  };
}
