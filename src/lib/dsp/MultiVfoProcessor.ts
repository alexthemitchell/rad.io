/**
 * Multi-VFO Processor
 *
 * Orchestrates parallel extraction and demodulation of multiple VFOs from a
 * wideband IQ capture. Implements the DSP pipeline for Phase 3 of multi-VFO
 * architecture.
 *
 * Architecture:
 * 1. Wideband IQ input → channelizer (per-VFO or PFB based on count)
 * 2. Per-VFO decimated IQ → demodulator plugin
 * 3. Demodulated audio → audio mixer/router
 * 4. Metrics collection → VFO state updates
 *
 * Strategy:
 * - 1-2 VFOs: Per-VFO frequency shift + filter + decimate (via WASM multi-mixer)
 * - 3+ VFOs: Polyphase Filter Bank channelizer (amortizes FFT cost)
 *
 * Related: docs/reference/multi-vfo-architecture.md
 */

import { loader } from "../../utils/dspWasm";
import { pfbChannelize } from "./pfbChannelizer";
import type { IQSample } from "../../models/SDRDevice";
import type { DemodulatorPlugin } from "../../types/plugin";
import type { VfoState, VfoMetrics } from "../../types/vfo";

/**
 * Audio buffer for a single VFO output
 */
export interface VfoAudioBuffer {
  vfoId: string;
  audio: Float32Array;
  sampleRate: number;
  timestamp: number;
}

/**
 * Multi-VFO processor configuration
 */
export interface MultiVfoProcessorConfig {
  /** Wideband sample rate in Hz */
  sampleRate: number;

  /** Wideband center frequency in Hz */
  centerFrequency: number;

  /** VFO threshold to switch from per-VFO to PFB channelizer */
  pfbThreshold?: number;

  /** Maximum concurrent audio streams (default: 1 per spec) */
  maxConcurrentAudio?: number;

  /** Audio output sample rate (default: 48000 Hz) */
  audioOutputSampleRate?: number;

  /** Enable performance metrics collection */
  enableMetrics?: boolean;
}

/**
 * Per-VFO processing state
 */
interface VfoProcessingState {
  /** Current NCO phase for frequency shifting */
  phase: number;

  /** Demodulator instance */
  demodulator: DemodulatorPlugin | null;

  /** Last processing timestamp */
  lastProcessedAt: number;

  /** Accumulated samples for partial buffer processing */
  bufferI: Float32Array;
  bufferQ: Float32Array;
  bufferFill: number;
}

/**
 * Multi-VFO Processor
 *
 * Processes multiple VFOs in parallel from wideband IQ samples
 */
export class MultiVfoProcessor {
  private config: Required<MultiVfoProcessorConfig>;
  private vfoStates = new Map<string, VfoProcessingState>();
  private wasmMultiMixer:
    | ((
        iSamples: Float32Array,
        qSamples: Float32Array,
        inputSize: number,
        vfoFreqOffsets: Float64Array,
        numVfos: number,
        sampleRate: number,
        decimationFactor: number,
        filterTaps: number,
        vfoPhases: Float64Array,
        outputBuffer: Float32Array,
      ) => Float64Array)
    | null = null;

  constructor(config: MultiVfoProcessorConfig) {
    this.config = {
      pfbThreshold: 3,
      maxConcurrentAudio: 1,
      audioOutputSampleRate: 48000,
      enableMetrics: true,
      ...config,
    };

    this.initializeWasm();
  }

  /**
   * Initialize WASM DSP functions
   */
  private initializeWasm(): void {
    // Async initialization, fallback to JS on failure
    if (loader) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      loader
        .then((instance) => {
          this.wasmMultiMixer = instance.exports
            .multiVfoMixer as typeof this.wasmMultiMixer;
        })
        .catch((error: unknown) => {
          console.warn(
            "⚠️ MultiVfoProcessor: WASM initialization failed, falling back to JS implementation",
            error,
          );
        });
    }
  }

  /**
   * Update processor configuration
   */
  updateConfig(updates: Partial<MultiVfoProcessorConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Add a VFO to the processor
   */
  addVfo(vfo: VfoState): void {
    if (this.vfoStates.has(vfo.id)) {
      console.warn(`⚠️ MultiVfoProcessor: VFO ${vfo.id} already exists`);
      return;
    }

    // Calculate decimation factor based on VFO bandwidth
    const decimationFactor = Math.max(
      1,
      Math.floor(this.config.sampleRate / (vfo.bandwidthHz * 2)),
    );
    const decimatedSampleRate = this.config.sampleRate / decimationFactor;

    // Pre-allocate buffers for this VFO
    const bufferSize = 8192; // Fixed buffer size for accumulation
    this.vfoStates.set(vfo.id, {
      phase: 0,
      demodulator: vfo.demodulator,
      lastProcessedAt: Date.now(),
      bufferI: new Float32Array(bufferSize),
      bufferQ: new Float32Array(bufferSize),
      bufferFill: 0,
    });

    console.debug(
      `🎛️ MultiVfoProcessor: Added VFO ${vfo.id} (${vfo.modeId}) at ${vfo.centerHz} Hz, decimation: ${decimationFactor}x → ${decimatedSampleRate} Hz`,
    );
  }

  /**
   * Remove a VFO from the processor
   */
  removeVfo(vfoId: string): void {
    if (!this.vfoStates.has(vfoId)) {
      console.warn(
        `⚠️ MultiVfoProcessor: Attempted to remove non-existent VFO ${vfoId}`,
      );
      return;
    }

    this.vfoStates.delete(vfoId);
    console.debug(`🎛️ MultiVfoProcessor: Removed VFO ${vfoId}`);
  }

  /**
   * Update VFO demodulator instance
   */
  updateVfoDemodulator(vfoId: string, demodulator: DemodulatorPlugin): void {
    const state = this.vfoStates.get(vfoId);
    if (!state) {
      console.warn(
        `⚠️ MultiVfoProcessor: Cannot update demodulator for non-existent VFO ${vfoId}`,
      );
      return;
    }

    state.demodulator = demodulator;
  }

  /**
   * Process wideband IQ samples and extract per-VFO audio
   *
   * @param samples - Wideband IQ samples
   * @param activeVfos - Array of active VFO configurations
   * @returns Map of VFO ID to audio buffer and updated metrics
   */
  async processSamples(
    samples: IQSample[],
    activeVfos: VfoState[],
  ): Promise<
    Map<string, { audio: VfoAudioBuffer | null; metrics: VfoMetrics }>
  > {
    const results = new Map<
      string,
      { audio: VfoAudioBuffer | null; metrics: VfoMetrics }
    >();

    if (samples.length === 0 || activeVfos.length === 0) {
      return results;
    }

    const startTime = performance.now();

    // Choose channelization strategy based on VFO count
    const usePFB = activeVfos.length >= this.config.pfbThreshold;

    if (usePFB) {
      // Strategy: Polyphase Filter Bank channelizer (3+ VFOs)
      await this.processSamplesWithPFB(samples, activeVfos, results);
    } else {
      // Strategy: Per-VFO mixing (1-2 VFOs)
      this.processSamplesPerVfo(samples, activeVfos, results);
    }

    if (this.config.enableMetrics) {
      const totalTime = performance.now() - startTime;
      console.debug(
        `📊 MultiVfoProcessor: Processed ${samples.length} samples for ${activeVfos.length} VFOs in ${totalTime.toFixed(2)}ms (${usePFB ? "PFB" : "per-VFO"} strategy)`,
      );
    }

    return results;
  }

  /**
   * Process samples using per-VFO mixing strategy (1-2 VFOs)
   */
  private processSamplesPerVfo(
    samples: IQSample[],
    activeVfos: VfoState[],
    results: Map<string, { audio: VfoAudioBuffer | null; metrics: VfoMetrics }>,
  ): void {
    // Use WASM multi-mixer if available, otherwise fall back to JS
    if (this.wasmMultiMixer && activeVfos.length > 0) {
      this.processSamplesPerVfoWasm(samples, activeVfos, results);
    } else {
      this.processSamplesPerVfoJS(samples, activeVfos, results);
    }
  }

  /**
   * Process samples using WASM multi-mixer
   */
  private processSamplesPerVfoWasm(
    samples: IQSample[],
    activeVfos: VfoState[],
    results: Map<string, { audio: VfoAudioBuffer | null; metrics: VfoMetrics }>,
  ): void {
    if (!this.wasmMultiMixer) return;

    const inputSize = samples.length;
    const numVfos = activeVfos.length;

    // Prepare input arrays
    const iSamples = new Float32Array(inputSize);
    const qSamples = new Float32Array(inputSize);
    for (let i = 0; i < inputSize; i++) {
      const sample = samples[i];
      if (sample) {
        iSamples[i] = sample.I;
        qSamples[i] = sample.Q;
      }
    }

    // Prepare VFO parameters
    const vfoFreqOffsets = new Float64Array(numVfos);
    const vfoPhases = new Float64Array(numVfos);
    const decimationFactors: number[] = [];

    for (let i = 0; i < numVfos; i++) {
      const vfo = activeVfos[i];
      if (!vfo) continue;

      const state = this.vfoStates.get(vfo.id);
      if (!state) continue;

      // Frequency offset from wideband center
      vfoFreqOffsets[i] = vfo.centerHz - this.config.centerFrequency;
      vfoPhases[i] = state.phase;

      // Calculate decimation factor
      const decimationFactor = Math.max(
        1,
        Math.floor(this.config.sampleRate / (vfo.bandwidthHz * 2)),
      );
      decimationFactors.push(decimationFactor);
    }

    // Use first VFO's decimation factor for all (simplified for now)
    const decimationFactor = decimationFactors[0] ?? 1;
    const outputSize = Math.ceil(inputSize / decimationFactor);
    const filterTaps = Math.min(21, Math.floor(decimationFactor * 2) + 1);

    // Allocate output buffer: [vfo0_I[], vfo0_Q[], vfo1_I[], vfo1_Q[], ...]
    const outputBuffer = new Float32Array(numVfos * 2 * outputSize);

    // Call WASM multi-mixer
    const updatedPhases = this.wasmMultiMixer(
      iSamples,
      qSamples,
      inputSize,
      vfoFreqOffsets,
      numVfos,
      this.config.sampleRate,
      decimationFactor,
      filterTaps,
      vfoPhases,
      outputBuffer,
    );

    // Process each VFO's output
    for (let i = 0; i < numVfos; i++) {
      const vfo = activeVfos[i];
      if (!vfo) continue;

      const state = this.vfoStates.get(vfo.id);
      if (!state) continue;

      // Update phase for next iteration
      state.phase = updatedPhases[i] ?? 0;

      // Extract decimated IQ for this VFO
      const vfoIOffset = i * 2 * outputSize;
      const vfoQOffset = vfoIOffset + outputSize;
      const decimatedI = outputBuffer.subarray(
        vfoIOffset,
        vfoIOffset + outputSize,
      );
      const decimatedQ = outputBuffer.subarray(
        vfoQOffset,
        vfoQOffset + outputSize,
      );

      // Convert to IQSample array for demodulator
      const decimatedSamples: IQSample[] = [];
      for (let j = 0; j < outputSize; j++) {
        decimatedSamples.push({ I: decimatedI[j] ?? 0, Q: decimatedQ[j] ?? 0 });
      }

      // Demodulate and collect results
      this.demodulateAndCollectResults(vfo, state, decimatedSamples, results);
    }
  }

  /**
   * Process samples using JavaScript per-VFO mixing (fallback)
   */
  private processSamplesPerVfoJS(
    samples: IQSample[],
    activeVfos: VfoState[],
    results: Map<string, { audio: VfoAudioBuffer | null; metrics: VfoMetrics }>,
  ): void {
    // Simple JS implementation for fallback
    for (const vfo of activeVfos) {
      const state = this.vfoStates.get(vfo.id);
      if (!state) continue;

      const freqOffset = vfo.centerHz - this.config.centerFrequency;

      // Frequency shift
      const shifted = this.frequencyShiftJS(
        samples,
        freqOffset,
        this.config.sampleRate,
        state.phase,
      );
      state.phase = shifted.finalPhase;

      // Simple decimation (no filtering in JS fallback for simplicity)
      const decimationFactor = Math.max(
        1,
        Math.floor(this.config.sampleRate / (vfo.bandwidthHz * 2)),
      );
      const decimated: IQSample[] = [];
      for (let i = 0; i < shifted.samples.length; i += decimationFactor) {
        const sample = shifted.samples[i];
        if (sample) {
          decimated.push(sample);
        }
      }

      this.demodulateAndCollectResults(vfo, state, decimated, results);
    }
  }

  /**
   * JavaScript frequency shift implementation (fallback)
   */
  private frequencyShiftJS(
    samples: IQSample[],
    frequencyHz: number,
    sampleRate: number,
    initialPhase: number,
  ): { samples: IQSample[]; finalPhase: number } {
    const phaseIncrement = (-2 * Math.PI * frequencyHz) / sampleRate;
    let phase = initialPhase;
    const shifted: IQSample[] = [];

    for (const sample of samples) {
      if (!sample) continue;

      const cosPhase = Math.cos(phase);
      const sinPhase = Math.sin(phase);

      shifted.push({
        I: sample.I * cosPhase - sample.Q * sinPhase,
        Q: sample.I * sinPhase + sample.Q * cosPhase,
      });

      phase += phaseIncrement;
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      } else if (phase < -2 * Math.PI) {
        phase += 2 * Math.PI;
      }
    }

    return { samples: shifted, finalPhase: phase };
  }

  /**
   * Process samples using PFB channelizer strategy (3+ VFOs)
   */
  private async processSamplesWithPFB(
    samples: IQSample[],
    activeVfos: VfoState[],
    results: Map<string, { audio: VfoAudioBuffer | null; metrics: VfoMetrics }>,
  ): Promise<void> {
    // Determine channel bandwidth (use maximum VFO bandwidth)
    const maxBandwidth = Math.max(
      ...activeVfos.map((vfo) => vfo.bandwidthHz),
      200_000,
    );

    // Extract center frequencies
    const channelFreqs = activeVfos.map((vfo) => vfo.centerHz);

    // Use PFB channelizer to extract all channels in one pass
    const channelOutputs = await pfbChannelize(
      samples,
      this.config.sampleRate,
      this.config.centerFrequency,
      maxBandwidth,
      channelFreqs,
      { tapsPerPhase: 8 },
    );

    // Process each VFO's channelized output
    for (const vfo of activeVfos) {
      const state = this.vfoStates.get(vfo.id);
      if (!state) continue;

      const decimatedSamples = channelOutputs.get(vfo.centerHz);
      if (decimatedSamples) {
        this.demodulateAndCollectResults(vfo, state, decimatedSamples, results);
      }
    }
  }

  /**
   * Demodulate VFO samples and collect audio + metrics
   */
  private demodulateAndCollectResults(
    vfo: VfoState,
    state: VfoProcessingState,
    decimatedSamples: IQSample[],
    results: Map<string, { audio: VfoAudioBuffer | null; metrics: VfoMetrics }>,
  ): void {
    const startTime = performance.now();

    let audio: VfoAudioBuffer | null = null;

    // Demodulate if we have a demodulator
    if (state.demodulator && decimatedSamples.length > 0) {
      try {
        const audioSamples = state.demodulator.demodulate(decimatedSamples);

        // Only create audio buffer if audio is enabled for this VFO
        if (vfo.audioEnabled && audioSamples.length > 0) {
          audio = {
            vfoId: vfo.id,
            audio: audioSamples,
            sampleRate:
              state.demodulator.getParameters().audioSampleRate ||
              this.config.audioOutputSampleRate,
            timestamp: Date.now(),
          };
        }
      } catch (error) {
        console.error(
          `❌ MultiVfoProcessor: Demodulation failed for VFO ${vfo.id}:`,
          error,
        );
      }
    }

    // Calculate metrics
    const processingTime = performance.now() - startTime;
    const rssi = this.calculateRSSI(decimatedSamples);

    const metrics: VfoMetrics = {
      rssi,
      samplesProcessed: decimatedSamples.length,
      processingTime,
      timestamp: Date.now(),
    };

    state.lastProcessedAt = Date.now();
    results.set(vfo.id, { audio, metrics });
  }

  /**
   * Calculate RSSI from IQ samples
   */
  private calculateRSSI(samples: IQSample[]): number {
    if (samples.length === 0) return -100;

    let sumPower = 0;
    for (const sample of samples) {
      const power = sample.I * sample.I + sample.Q * sample.Q;
      sumPower += power;
    }

    const avgPower = sumPower / samples.length;
    const rssi = 10 * Math.log10(avgPower + 1e-10);
    return rssi;
  }

  /**
   * Mix multiple audio buffers with proper gain normalization
   *
   * @param audioBuffers - Array of audio buffers to mix
   * @returns Mixed audio buffer
   */
  mixAudioBuffers(audioBuffers: VfoAudioBuffer[]): Float32Array {
    if (audioBuffers.length === 0) {
      return new Float32Array(0);
    }

    if (audioBuffers.length === 1) {
      const buffer = audioBuffers[0];
      return buffer ? buffer.audio : new Float32Array(0);
    }

    // Find the maximum length
    const maxLength = Math.max(...audioBuffers.map((buf) => buf.audio.length));
    const mixed = new Float32Array(maxLength);

    // Mix with gain normalization
    const gain = 1.0 / audioBuffers.length;

    for (const buffer of audioBuffers) {
      for (let i = 0; i < buffer.audio.length; i++) {
        mixed[i] = (mixed[i] ?? 0) + (buffer.audio[i] ?? 0) * gain;
      }
    }

    return mixed;
  }

  /**
   * Get active VFO count
   */
  getActiveVfoCount(): number {
    return this.vfoStates.size;
  }

  /**
   * Clear all VFO states
   */
  clear(): void {
    this.vfoStates.clear();
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();
  }
}
