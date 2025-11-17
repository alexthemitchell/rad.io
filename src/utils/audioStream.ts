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

import { LinearResampler } from "./audioResampler";
import {
  AudioWorkletManager,
  WorkletDemodType,
  AGCMode as WorkletAGCMode,
} from "./audioWorkletManager";
import { RDSDecoder } from "./rdsDecoder";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
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
  /** De-emphasis time constant in microseconds (default: 75 for USA, 50 for Europe) */
  deemphasisTau?: number;
  /** Enable de-emphasis (alias for enableDeEmphasis) */
  deemphasisEnabled?: boolean;
  /** Enable RDS decoding for FM signals (default: false) */
  enableRDS?: boolean;
  /** Enable AudioWorklet for low-latency processing (default: false) */
  useAudioWorklet?: boolean;
  /** AGC mode: 'off', 'slow', 'medium', 'fast' (default: 'medium') */
  agcMode?: "off" | "slow" | "medium" | "fast";
  /** AGC target level 0.0-1.0 (default: 0.5) */
  agcTarget?: number;
  /** Squelch threshold 0.0-1.0, 0.0 = off (default: 0.0) */
  squelchThreshold?: number;
  /** Output volume 0.0-1.0 (default: 1.0) */
  volume?: number;
};

/**
 * Demodulation type
 */
export enum DemodulationType {
  FM = "FM",
  AM = "AM",
  NFM = "NFM", // Narrow FM
  WFM = "WFM", // Wide FM (broadcast)
  USB = "USB", // Upper sideband
  LSB = "LSB", // Lower sideband
  CW = "CW", // Continuous wave (morse)
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
  /** RDS station data (if RDS decoding enabled and available) */
  rdsData?: RDSStationData;
  /** RDS decoder statistics (if RDS decoding enabled) */
  rdsStats?: RDSDecoderStats;
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
  private dcBlockerState = 0;
  private dcBlockerPrevInput = 0;
  private readonly deEmphasisAlpha: number;
  private readonly dcBlockerAlpha: number;

  constructor(sampleRate: number, enableDeEmphasis = true, deemphasisTau = 75) {
    // De-emphasis filter: time constant (75μs for USA, 50μs for Europe)
    // α = 1 / (1 + RC*fs) where RC is the time constant in seconds
    const RC = deemphasisTau * 1e-6; // Convert microseconds to seconds
    this.deEmphasisAlpha = enableDeEmphasis ? 1 / (1 + RC * sampleRate) : 1.0;

    // DC blocking filter: High-pass at ~0.5 Hz to remove DC drift
    // α = 1 - (2π * f_cutoff / f_s) for small cutoffs
    // Using α = 0.9999 gives cutoff ≈ 0.8 Hz at 48kHz sample rate
    const dcCutoffHz = 0.5;
    this.dcBlockerAlpha = 1 - (2 * Math.PI * dcCutoffHz) / sampleRate;
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

      // Apply DC blocking filter (IIR high-pass filter)
      // y[n] = α * (y[n-1] + x[n] - x[n-1])
      const dcBlocked =
        this.dcBlockerAlpha *
        (this.dcBlockerState + audio - this.dcBlockerPrevInput);
      this.dcBlockerState = dcBlocked;
      this.dcBlockerPrevInput = audio;

      audioSamples[i] = dcBlocked;
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
    this.dcBlockerState = 0;
    this.dcBlockerPrevInput = 0;
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
  private readonly dcFilterAlpha = 0.01; // DC removal filter coefficient (faster adaptation)
  private sampleCount = 0;
  private readonly initSamples = 100; // Initialization period

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

      // Initialize DC estimate with first samples
      if (this.sampleCount < this.initSamples) {
        this.dcFilterState += magnitude / this.initSamples;
        this.sampleCount++;
        audioSamples[i] = 0; // Output silence during initialization
        continue;
      }

      // Remove DC component using IIR filter
      this.dcFilterState =
        this.dcFilterAlpha * magnitude +
        (1 - this.dcFilterAlpha) * this.dcFilterState;

      // Subtract DC
      let audio = magnitude - this.dcFilterState;

      // Adaptive gain control (AGC) to maintain consistent audio level
      // Target RMS of 0.5 with gain limiting to prevent distortion
      const targetRMS = 0.5;
      const currentRMS = Math.abs(audio);
      const gain = currentRMS > 0.01 ? targetRMS / currentRMS : 2.0;
      audio *= Math.min(gain, 4.0); // Limit max gain to 4.0

      audioSamples[i] = audio;
    }

    return audioSamples;
  }

  /**
   * Reset demodulator state
   */
  reset(): void {
    this.dcFilterState = 0;
    this.sampleCount = 0;
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
  private rdsDecoder: RDSDecoder | null = null;
  private audioContext: AudioContext;
  private currentDemodType: DemodulationType = DemodulationType.NONE;
  private audioWorkletManager: AudioWorkletManager | null = null;
  private resampler: LinearResampler | null = null;

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
  extractAudio(
    samples: IQSample[],
    demodType: DemodulationType,
    config: AudioOutputConfig = {},
  ): AudioStreamResult {
    const {
      sampleRate = 48000,
      channels = 1,
      enableDeEmphasis = true,
      deemphasisTau = 75,
      enableRDS = false,
      useAudioWorklet = false,
      agcMode = "off", // Default to off for backward compatibility
      agcTarget = 0.5,
      squelchThreshold = 0.0,
    } = config;

    // If AudioWorklet is requested and available, use it
    if (useAudioWorklet && this.audioWorkletManager) {
      return this.extractAudioWithWorklet(samples, demodType, config);
    }

    // Initialize demodulator if needed
    if (this.currentDemodType !== demodType) {
      this.currentDemodType = demodType;
      this.fmDemodulator = null;
      this.amDemodulator = null;

      if (
        demodType === DemodulationType.FM ||
        demodType === DemodulationType.NFM ||
        demodType === DemodulationType.WFM
      ) {
        this.fmDemodulator = new FMDemodulator(
          this.sdrSampleRate,
          enableDeEmphasis,
          deemphasisTau,
        );
      } else if (demodType === DemodulationType.AM) {
        this.amDemodulator = new AMDemodulator();
      }
    }

    // Initialize RDS decoder if requested and using FM
    if (
      enableRDS &&
      (demodType === DemodulationType.FM ||
        demodType === DemodulationType.WFM) &&
      !this.rdsDecoder
    ) {
      this.rdsDecoder = new RDSDecoder(this.sdrSampleRate);
    } else if (!enableRDS && this.rdsDecoder) {
      this.rdsDecoder = null;
    }

    // Initialize resampler if needed
    // Use linear resampler for stability and minimal latency
    if (
      !this.resampler ||
      this.resampler.getRatio() !== this.sdrSampleRate / sampleRate
    ) {
      this.resampler = new LinearResampler(this.sdrSampleRate, sampleRate);
    }

    // Demodulate based on type
    let audioSamples: Float32Array;
    if (
      (demodType === DemodulationType.FM ||
        demodType === DemodulationType.NFM ||
        demodType === DemodulationType.WFM) &&
      this.fmDemodulator
    ) {
      audioSamples = this.fmDemodulator.demodulate(samples);

      // Extract RDS data from FM baseband if enabled
      if (this.rdsDecoder && audioSamples.length > 0) {
        this.rdsDecoder.processBaseband(audioSamples);
      }
    } else if (demodType === DemodulationType.AM && this.amDemodulator) {
      audioSamples = this.amDemodulator.demodulate(samples);
    } else {
      // No demodulation or unsupported type - just convert I/Q to mono by taking I channel
      audioSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        audioSamples[i] = samples[i]?.I ?? 0;
      }
    }

    // Resample to target sample rate using high-quality resampler
    const resampledSamples = this.resampler.resample(audioSamples);

    // Apply simple AGC if requested (for non-worklet path)
    const processedSamples = this.applySimpleAGC(
      resampledSamples,
      agcMode,
      agcTarget,
    );

    // Apply squelch if requested
    const finalSamples = this.applySimpleSquelch(
      processedSamples,
      squelchThreshold,
    );

    // Create AudioBuffer for Web Audio API
    const audioBuffer = this.audioContext.createBuffer(
      channels,
      finalSamples.length,
      sampleRate,
    );

    // Fill audio buffer channels
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      channelData.set(finalSamples);
    }

    const result: AudioStreamResult = {
      audioData: finalSamples,
      sampleRate,
      channels,
      demodType,
      audioBuffer,
    };

    // Add RDS data if decoder is active
    if (this.rdsDecoder) {
      result.rdsData = this.rdsDecoder.getStationData();
      result.rdsStats = this.rdsDecoder.getStats();
    }

    return result;
  }

  /**
   * Decimate audio samples to target sample rate (legacy method)
   *
   * Note: This method is kept for backward compatibility.
   * New code should use AudioResampler instead for better quality.
   *
   * @deprecated Use AudioResampler instead for better quality
   */
  // @ts-expect-error - Kept for backward compatibility
  private decimateAudio(
    samples: Float32Array,
    inputRate: number,
    outputRate: number,
  ): Float32Array {
    if (inputRate === outputRate) {
      return samples;
    }

    const ratio = inputRate / outputRate;

    // Step 1: Anti-aliasing low-pass filter
    // Filter cutoff should be at Nyquist frequency of output rate (outputRate / 2)
    // Moving average filter size based on decimation ratio
    const filterSize = Math.max(1, Math.ceil(ratio / 2));
    const filtered = new Float32Array(samples.length);

    // Apply moving average filter (simple but effective anti-aliasing)
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      let count = 0;

      // Average samples within filter window
      const startIdx = Math.max(0, i - filterSize);
      const endIdx = Math.min(samples.length - 1, i + filterSize);

      for (let j = startIdx; j <= endIdx; j++) {
        const sample = samples[j];
        if (sample !== undefined) {
          sum += sample;
          count++;
        }
      }

      filtered[i] = sum / count;
    }

    // Step 2: Decimate with linear interpolation
    const outputLength = Math.floor(samples.length / ratio);
    const decimated = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index0 = Math.floor(sourceIndex);
      const index1 = Math.min(index0 + 1, filtered.length - 1);
      const frac = sourceIndex - index0;

      // Linear interpolation on filtered samples
      const val0 = filtered[index0] ?? 0;
      const val1 = filtered[index1] ?? 0;
      decimated[i] = val0 * (1 - frac) + val1 * frac;
    }

    return decimated;
  }

  /**
   * Extract audio using AudioWorklet for low-latency processing
   */
  private extractAudioWithWorklet(
    samples: IQSample[],
    demodType: DemodulationType,
    config: AudioOutputConfig,
  ): AudioStreamResult {
    if (!this.audioWorkletManager) {
      throw new Error("AudioWorklet manager not initialized");
    }

    const { sampleRate = 48000, channels = 1 } = config;

    // Process samples through AudioWorklet
    this.audioWorkletManager.processSamples(samples);

    // For AudioWorklet, we return an empty buffer as audio is played directly
    // This is a placeholder result for API compatibility
    const audioData = new Float32Array(0);
    const audioBuffer = this.audioContext.createBuffer(channels, 0, sampleRate);

    return {
      audioData,
      sampleRate,
      channels,
      demodType,
      audioBuffer,
    };
  }

  /**
   * Initialize AudioWorklet for low-latency processing
   */
  async initializeAudioWorklet(config?: AudioOutputConfig): Promise<void> {
    if (this.audioWorkletManager) {
      console.warn("AudioWorklet already initialized");
      return;
    }

    const {
      agcMode = "medium",
      agcTarget = 0.5,
      squelchThreshold = 0.0,
      deemphasisEnabled = true,
      deemphasisTau = 75,
      volume = 1.0,
    } = config ?? {};

    // Map AGC mode string to enum
    const agcModeMap: Record<string, WorkletAGCMode> = {
      off: WorkletAGCMode.OFF,
      slow: WorkletAGCMode.SLOW,
      medium: WorkletAGCMode.MEDIUM,
      fast: WorkletAGCMode.FAST,
    };

    this.audioWorkletManager = new AudioWorkletManager();
    await this.audioWorkletManager.initialize({
      demodType: WorkletDemodType.FM, // Default, will be updated
      agcMode: agcModeMap[agcMode] ?? WorkletAGCMode.MEDIUM,
      agcTarget,
      squelchThreshold,
      deemphasisEnabled,
      deemphasisTau,
      volume,
    });
  }

  /**
   * Apply simple AGC for non-worklet path
   */
  private applySimpleAGC(
    samples: Float32Array,
    mode: string,
    target: number,
  ): Float32Array {
    if (mode === "off") {
      return samples;
    }

    const output = new Float32Array(samples.length);
    let rms = 0.1; // Initial RMS estimate

    // Time constants based on mode
    const alphaMap: Record<string, { attack: number; decay: number }> = {
      fast: { attack: 0.9, decay: 0.99 },
      medium: { attack: 0.95, decay: 0.995 },
      slow: { attack: 0.98, decay: 0.998 },
    };

    const timeConstants = alphaMap[mode] ?? alphaMap["medium"];
    if (!timeConstants) {
      return samples; // Fallback if mode is invalid
    }
    const { attack, decay } = timeConstants;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] ?? 0;
      const abs = Math.abs(sample);

      // Update RMS estimate
      if (abs > rms) {
        rms = attack * rms + (1 - attack) * abs;
      } else {
        rms = decay * rms + (1 - decay) * abs;
      }

      // Calculate and apply gain
      const gain = rms > 0.001 ? target / rms : 1.0;
      const limitedGain = Math.max(0.1, Math.min(10.0, gain));
      output[i] = sample * limitedGain;
    }

    return output;
  }

  /**
   * Apply simple squelch for non-worklet path
   */
  private applySimpleSquelch(
    samples: Float32Array,
    threshold: number,
  ): Float32Array {
    if (threshold <= 0) {
      return samples;
    }

    const output = new Float32Array(samples.length);
    let rms = 0.0;
    let isOpen = true;
    const alpha = 0.99; // Smoothing factor

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] ?? 0;

      // Update RMS estimate
      rms = alpha * rms + (1 - alpha) * Math.abs(sample);

      // Determine squelch state with hysteresis
      if (rms > threshold) {
        isOpen = true;
      } else if (rms < threshold * 0.7) {
        isOpen = false;
      }

      output[i] = isOpen ? sample : 0;
    }

    return output;
  }

  /**
   * Reset all demodulator states
   */
  reset(): void {
    this.fmDemodulator?.reset();
    this.amDemodulator?.reset();
    this.rdsDecoder?.reset();
    this.resampler?.reset();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.audioWorkletManager) {
      await this.audioWorkletManager.cleanup();
      this.audioWorkletManager = null;
    }
    await this.audioContext.close();
    this.rdsDecoder = null;
    this.resampler = null;
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
  const result = processor.extractAudio(samples, demodType, config);
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
): (samples: IQSample[]) => void {
  return (samples: IQSample[]) => {
    const result = processor.extractAudio(samples, demodType, config);
    onAudio(result);
  };
}
