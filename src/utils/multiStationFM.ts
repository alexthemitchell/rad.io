/**
 * Multi-Station FM Processing
 *
 * Extract and process FM baseband signals from multiple stations simultaneously
 * within a wideband capture. This enables parallel RDS decoding across the entire
 * FM broadcast band (88-108 MHz).
 *
 * Architecture:
 * 1. Wideband IQ capture (e.g., 20 MHz bandwidth from HackRF One)
 * 2. Channelizer: Split wideband signal into individual FM channels
 * 3. FM demodulation per channel to extract baseband
 * 4. RDS decoding on each channel's baseband
 * 5. Aggregate and cache all RDS data
 *
 * @module multiStationFM
 */

import { fftWorkerPool } from "../lib/dsp/fft-worker-pool";
import pfbChannelize from "../lib/dsp/pfbChannelizer";
import { windowedDFTChannelize } from "../lib/dsp/wdfdftChannelizer";
import { calculateFFTSync, type Sample } from "./dsp";
import { RDSDecoder } from "./rdsDecoder";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
import type { IQSample } from "../models/SDRDevice";

/**
 * FM channel information
 */
export interface FMChannel {
  /** Center frequency in Hz */
  frequency: number;
  /** Signal strength (0-1 scale) */
  strength: number;
  /** RDS decoder for this channel */
  rdsDecoder?: RDSDecoder;
  /** Latest RDS data */
  rdsData?: RDSStationData;
  /** RDS decoder statistics */
  rdsStats?: RDSDecoderStats;
  /** Last time station was seen by the scanner (ms since epoch) */
  lastSeen?: number;
}

/**
 * Multi-station FM processor configuration
 */
export interface MultiStationFMConfig {
  /** Sample rate of wideband IQ data in Hz */
  sampleRate: number;
  /** Center frequency of wideband capture in Hz */
  centerFrequency: number;
  /** Bandwidth of wideband capture in Hz */
  bandwidth: number;
  /** Enable RDS decoding (default: true) */
  enableRDS?: boolean;
  /** FM channel bandwidth in Hz (default: 200 kHz) */
  channelBandwidth?: number;
  /** FFT size used for station scanning */
  scanFFTSize?: number;
  /** If true, offload FFT computation to worker pool when available */
  useWorkerFFT?: boolean;
  /** If true, adapt scan threshold relative to noise floor dynamically */
  scanAutoThreshold?: boolean;
  /** When scanAutoThreshold is enabled, threshold = noiseFloor + offset (dB) */
  scanThresholdDbOffset?: number;
  /** Minimum separation between detected stations in Hz. If two peaks are closer than this, consider merging unless a strong valley is present */
  minSeparationHz?: number;
  /** Minimum valley depth in dB between two peaks required to keep them separate */
  minValleyDepthDb?: number;
  /** dB threshold for peak detection during scanning */
  scanThresholdDb?: number;
  /** Maximum number of stations to keep simultaneously */
  scanMaxStations?: number;
  /** Minimum time between scans in ms */
  scanIntervalMs?: number;
  /** Remove channels not seen for this long (ms) */
  staleChannelTimeoutMs?: number;
  /** If true, use polyphase filter bank channelizer by default */
  usePFBChannelizer?: boolean;
}

/**
 * Multi-Station FM Processor
 *
 * Processes multiple FM stations from a single wideband IQ capture
 */
export class MultiStationFMProcessor {
  private channels = new Map<number, FMChannel>();
  private config: Required<MultiStationFMConfig>;
  private lastScanAt = 0;

  constructor(config: MultiStationFMConfig) {
    this.config = {
      enableRDS: true,
      channelBandwidth: 200e3, // 200 kHz standard FM channel spacing
      scanFFTSize: 8192,
      scanThresholdDb: -70,
      scanMaxStations: 60,
      scanIntervalMs: 1000,
      staleChannelTimeoutMs: 5000,
      minSeparationHz: 100e3, // 100 kHz minimum separation between distinct stations
      minValleyDepthDb: 6, // require at least 6 dB valley dip to consider two close peaks separate
      useWorkerFFT: true,
      scanAutoThreshold: true,
      scanThresholdDbOffset: 18,
      usePFBChannelizer: true,
      ...config,
    };
  }

  /**
   * Estimate noise floor (in dB) for a spectrum using a low percentile
   */
  private estimateNoiseFloor(spectrum: Float32Array | number[]): number {
    const arr = Array.from(spectrum as number[]);
    arr.sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor(arr.length * 0.1)); // 10th percentile
    return typeof arr[idx] === "number" ? arr[idx] : (arr[0] ?? -200);
  }

  /**
   * Return maximum dB of spectrum
   */
  private getMaxDb(spectrum: Float32Array | number[]): number {
    let max = -Infinity;
    for (const v of spectrum as number[]) {
      if (typeof v === "number" && v > max) max = v;
    }
    return isFinite(max) ? max : -200;
  }

  /**
   * Add a channel to process
   * @param frequency - Channel center frequency in Hz
   * @param strength - Signal strength (0-1 scale)
   */
  addChannel(frequency: number, strength: number): void {
    if (!this.channels.has(frequency)) {
      const channel: FMChannel = {
        frequency,
        strength,
      };

      if (this.config.enableRDS) {
        // Create RDS decoder for this channel
        // RDS decoder needs the baseband sample rate, not the wideband rate
        // After channelization the decimated sample rate is sampleRate / M where
        // M = round(sampleRate / channelBandwidth)
        const M = Math.max(
          1,
          Math.round(this.config.sampleRate / this.config.channelBandwidth),
        );
        const basebandSampleRate = this.config.sampleRate / M;
        channel.rdsDecoder = new RDSDecoder(basebandSampleRate);
      }

      this.channels.set(frequency, channel);
    }
  }

  /**
   * Remove a channel
   */
  removeChannel(frequency: number): void {
    this.channels.delete(frequency);
  }

  /**
   * Clear all channels
   */
  clearChannels(): void {
    this.channels.clear();
  }

  /**
   * Process wideband IQ samples and extract RDS from all channels
   *
   * @param samples - Wideband IQ samples
   * @returns Map of frequency to updated channel data
   */
  async processWidebandSamples(
    samples: IQSample[],
  ): Promise<
    Map<number, { rdsData?: RDSStationData; rdsStats?: RDSDecoderStats }>
  > {
    const results = new Map<
      number,
      { rdsData?: RDSStationData; rdsStats?: RDSDecoderStats }
    >();

    if (samples.length === 0) {
      return results;
    }

    // Possibly re-scan for stations if required
    await this.autoDetectAndUpdateChannels(samples);

    // Remove stale channels
    const now = Date.now();
    for (const [freq, ch] of this.channels) {
      if (
        ch.lastSeen &&
        now - ch.lastSeen > this.config.staleChannelTimeoutMs
      ) {
        this.channels.delete(freq);
      }
    }

    // Gather channel frequencies to perform a single channelize pass
    const channelFreqs = Array.from(this.channels.keys());

    // Channelize all channels in one pass where possible
    let channelOutputs = new Map<number, IQSample[]>();
    if (channelFreqs.length > 0) {
      if (this.config.usePFBChannelizer) {
        try {
          channelOutputs = await pfbChannelize(
            samples,
            this.config.sampleRate,
            this.config.centerFrequency,
            this.config.channelBandwidth,
            channelFreqs,
            { tapsPerPhase: 8 },
          );
        } catch (err) {
          console.warn(
            "PFB channelizer failed, falling back to windowed DFT: ",
            err,
          );
          channelOutputs = windowedDFTChannelize(
            samples,
            this.config.sampleRate,
            this.config.centerFrequency,
            this.config.channelBandwidth,
            channelFreqs,
          );
        }
      } else {
        channelOutputs = windowedDFTChannelize(
          samples,
          this.config.sampleRate,
          this.config.centerFrequency,
          this.config.channelBandwidth,
          channelFreqs,
        );
      }
    }

    // Process each channel
    for (const [frequency, channel] of this.channels) {
      try {
        // If we have a decimated subband for this channel, use it; otherwise
        // fallback to the previous single-channel extraction pipeline.
        let baseband: IQSample[] = channelOutputs.get(frequency) ?? [];
        if (baseband.length === 0) {
          baseband = this.extractChannelBaseband(samples, frequency);
        }

        if (baseband.length === 0) {
          continue;
        }

        // Demodulate FM to get audio/baseband
        const demodulated = this.demodulateFM(baseband);

        // Process RDS if enabled
        if (channel.rdsDecoder && demodulated.length > 0) {
          channel.rdsDecoder.processBaseband(demodulated);
          channel.rdsData = channel.rdsDecoder.getStationData();
          channel.rdsStats = channel.rdsDecoder.getStats();

          results.set(frequency, {
            rdsData: channel.rdsData,
            rdsStats: channel.rdsStats,
          });
        }
      } catch (error) {
        console.warn(`Error processing channel at ${frequency} Hz:`, error);
      }
    }

    return results;
  }

  /**
   * Extract baseband for a specific channel from wideband samples
   *
   * Steps:
   * 1. Frequency shift to move channel to baseband (0 Hz)
   * 2. Low-pass filter to isolate channel bandwidth
   * 3. Decimate to reduce sample rate
   *
   * @param samples - Wideband IQ samples
   * @param channelFrequency - Target channel frequency in Hz
   * @returns Channel baseband samples
   */
  private extractChannelBaseband(
    samples: IQSample[],
    channelFrequency: number,
  ): IQSample[] {
    const { sampleRate, centerFrequency, channelBandwidth } = this.config;

    // Calculate frequency offset from wideband center
    const frequencyOffset = channelFrequency - centerFrequency;

    // Frequency shift to move channel to baseband
    const shiftedSamples = this.frequencyShift(
      samples,
      frequencyOffset,
      sampleRate,
    );

    // Low-pass filter to isolate channel
    const filtered = this.lowPassFilter(
      shiftedSamples,
      channelBandwidth / 2,
      sampleRate,
    );

    // Decimate to channel sample rate
    const basebandSampleRate = channelBandwidth * 1.5;
    const decimationFactor = Math.max(
      1,
      Math.floor(sampleRate / basebandSampleRate),
    );
    const decimated = this.decimate(filtered, decimationFactor);

    return decimated;
  }

  /**
   * Scan wideband samples for FM carrier peaks and update channels map.
   * Uses FFT-based spectral peak detection and simple local maxima filtering.
   */
  /**
   * Public scan API: analyze the wideband samples and return a list of
   * candidate FM station frequencies and dB values. Does not modify the
   * internal channels state.
   */
  public async scanForStations(
    samples: IQSample[],
  ): Promise<Array<{ frequency: number; db: number }>> {
    if (samples.length === 0) return [];
    const fftSize = this.config.scanFFTSize;
    const windowSamples = samples.slice(0, Math.min(samples.length, fftSize));
    const fs = this.config.sampleRate;

    let spectrum: Float32Array | number[] = [];
    const useWorker =
      this.config.useWorkerFFT &&
      typeof fftWorkerPool !== "undefined" &&
      fftWorkerPool.getWorkerLoads().length > 0;
    if (useWorker) {
      try {
        const floatSamples = new Float32Array(windowSamples.length * 2);
        for (const [i, ws] of windowSamples.entries()) {
          floatSamples[i * 2] = ws.I;
          floatSamples[i * 2 + 1] = ws.Q;
        }
        const fftRes = await fftWorkerPool.computeFFT(
          floatSamples,
          fs,
          0,
          fftSize,
        );
        spectrum = fftRes.magnitude;
      } catch (_err) {
        // Fallback to synchronous FFT if worker fails
        const dspSamples: Sample[] = windowSamples.map((s) => ({
          I: s.I,
          Q: s.Q,
        }));
        spectrum = calculateFFTSync(dspSamples, fftSize);
      }
    } else {
      const dspSamples: Sample[] = windowSamples.map((s) => ({
        I: s.I,
        Q: s.Q,
      }));
      spectrum = calculateFFTSync(dspSamples, fftSize);
    }
    const binWidth = fs / fftSize;
    const half = Math.floor(fftSize / 2);

    const peaks: Array<{ bin: number; db: number }> = [];
    for (let k = 1; k < spectrum.length - 1; k++) {
      const val = spectrum[k];
      if (typeof val !== "number") continue;
      const left = spectrum[k - 1];
      const right = spectrum[k + 1];
      // Local maxima only; will filter by adaptive threshold later
      if (
        typeof left === "number" &&
        typeof right === "number" &&
        val > left &&
        val > right
      ) {
        peaks.push({ bin: k, db: val });
      }
    }

    // Estimate noise floor and compute adaptive threshold/valley
    const noiseFloorDb = this.estimateNoiseFloor(spectrum);
    const maxDb = this.getMaxDb(spectrum);
    const snr = Math.max(0, maxDb - noiseFloorDb);
    const threshold = this.config.scanAutoThreshold
      ? noiseFloorDb + this.config.scanThresholdDbOffset
      : this.config.scanThresholdDb;
    const adaptiveMinValley = Math.max(
      this.config.minValleyDepthDb,
      Math.min(24, this.config.minValleyDepthDb + Math.floor(snr / 6)),
    );

    // Filter peaks by threshold
    const filteredPeaks = peaks.filter((p) => p.db > threshold);

    // Convert peaks to frequency form and sort by frequency
    const asFreqPeaks = filteredPeaks
      .map((p) => {
        const offsetBins = p.bin - half;
        const freqOffset = offsetBins * binWidth;
        const freqHz = this.config.centerFrequency + freqOffset;
        return { bin: p.bin, freq: freqHz, db: p.db };
      })
      .sort((a, b) => a.freq - b.freq);

    const detected: Array<{ frequency: number; db: number }> = [];
    const minSep = this.config.minSeparationHz;
    const minValley = adaptiveMinValley;
    for (const p of asFreqPeaks) {
      if (detected.length === 0) {
        detected.push({ frequency: p.freq, db: p.db });
        continue;
      }
      const prev = detected[detected.length - 1];
      if (!prev) continue;
      const sep = Math.abs(prev.frequency - p.freq);
      if (sep >= minSep) {
        // Check valley depth between bins
        // Convert back to bin indices
        const prevBin =
          Math.round(
            (prev.frequency - this.config.centerFrequency) / binWidth,
          ) + half;
        const currBin =
          Math.round((p.freq - this.config.centerFrequency) / binWidth) + half;
        const low = Math.min(prevBin, currBin);
        const high = Math.max(prevBin, currBin);
        let minDb = Infinity;
        for (let b = low; b <= high; b++) {
          const v = spectrum[b];
          if (typeof v === "number") {
            if (v < minDb) minDb = v;
          }
        }
        if (!isFinite(minDb)) minDb = Math.min(prev.db, p.db);
        const valleyDepth = Math.min(prev.db, p.db) - minDb;
        if (valleyDepth >= minValley) {
          // Keep both
          detected.push({ frequency: p.freq, db: p.db });
        } else {
          // Merge to the stronger peak
          if (p.db > prev.db) {
            prev.frequency = p.freq;
            prev.db = p.db;
          }
        }
      } else {
        // Too close: merge to the stronger peak
        if (p.db > prev.db) {
          prev.frequency = p.freq;
          prev.db = p.db;
        }
      }
    }

    detected.sort((a, b) => b.db - a.db);
    return detected.slice(0, this.config.scanMaxStations);
  }

  private async autoDetectAndUpdateChannels(
    samples: IQSample[],
  ): Promise<void> {
    const now = Date.now();
    if (samples.length === 0) {
      return;
    }

    // Throttle scanning to scanIntervalMs
    if (now - this.lastScanAt < this.config.scanIntervalMs) {
      return;
    }
    this.lastScanAt = now;

    const top: Array<{ frequency: number; db: number }> =
      await this.scanForStations(samples);

    // Update channels map: add or update existing channels
    for (const d of top) {
      // Find existing channel within tolerance
      let existing: FMChannel | undefined = undefined;
      for (const c of Array.from(this.channels.values())) {
        if (
          Math.abs(c.frequency - d.frequency) <
          Math.min(
            this.config.channelBandwidth / 2,
            this.config.minSeparationHz,
          )
        ) {
          existing = c;
          break;
        }
      }
      const strength = Math.min(
        1,
        Math.max(0, (d.db - this.config.scanThresholdDb) / 40),
      ); // normalize roughly
      if (existing) {
        existing.strength = strength;
        existing.lastSeen = now;
      } else {
        this.addChannel(d.frequency, strength);
        const ch = this.channels.get(d.frequency);
        if (ch) {
          ch.lastSeen = now;
        }
      }
    }
  }

  /**
   * Frequency shift IQ samples
   *
   * Multiply by complex exponential: e^(-j*2π*f*t)
   * This shifts the frequency spectrum by -f Hz
   *
   * @param samples - Input IQ samples
   * @param frequencyHz - Frequency shift in Hz
   * @param sampleRate - Sample rate in Hz
   * @returns Frequency-shifted samples
   */
  private frequencyShift(
    samples: IQSample[],
    frequencyHz: number,
    sampleRate: number,
  ): IQSample[] {
    const shifted = new Array<IQSample>(samples.length);
    const phaseIncrement = (-2 * Math.PI * frequencyHz) / sampleRate;

    let phase = 0;
    for (const [i, sample] of samples.entries()) {
      // Complex multiplication: (I + jQ) * (cos(phase) + j*sin(phase))
      const cosPhase = Math.cos(phase);
      const sinPhase = Math.sin(phase);

      shifted[i] = {
        I: sample.I * cosPhase - sample.Q * sinPhase,
        Q: sample.I * sinPhase + sample.Q * cosPhase,
      };

      phase += phaseIncrement;
      // Keep phase bounded
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      } else if (phase < -2 * Math.PI) {
        phase += 2 * Math.PI;
      }
    }

    return shifted;
  }

  /**
   * Low-pass filter IQ samples
   *
   * Simple moving average filter for anti-aliasing
   * For better quality, could implement FIR filter with windowing
   *
   * @param samples - Input IQ samples
   * @param cutoffHz - Filter cutoff frequency in Hz
   * @param sampleRate - Sample rate in Hz
   * @returns Filtered samples
   */
  private lowPassFilter(
    samples: IQSample[],
    cutoffHz: number,
    sampleRate: number,
  ): IQSample[] {
    // Design a simple FIR low-pass filter using windowed sinc with Hamming window.
    // This implementation keeps turnaround and complexity reasonable for the
    // browser; it's not highly optimized but provides much better anti-aliasing
    // than a simple moving average.
    // Fractional cutoff will be handled in createLowpassCoefficients

    // Number of taps: choose proportional to the transition width target.
    // Keep odd for symmetric linear-phase FIR.
    let numTaps = Math.max(21, Math.floor((sampleRate / cutoffHz) * 5));
    if (numTaps % 2 === 0) numTaps += 1;
    numTaps = Math.min(numTaps, 511); // limit worst-case cost

    const coeffs = this.createLowpassCoefficients(
      numTaps,
      cutoffHz,
      sampleRate,
    );
    return this.applyFIR(samples, coeffs);
  }

  /**
   * Create low-pass FIR coefficients (Hamming-windowed sinc)
   */
  private createLowpassCoefficients(
    n: number,
    cutoffHz: number,
    sampleRate: number,
  ): Float32Array {
    const fc = cutoffHz / sampleRate; // normalized cutoff (0..0.5)
    const M = n - 1;
    const coeffs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const m = i - M / 2;
      let sinc = 0;
      if (m === 0) {
        sinc = 2 * fc;
      } else {
        sinc = Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
      }
      // Hamming window
      const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / M);
      coeffs[i] = sinc * w;
    }
    // Normalize taps to unity gain at DC
    let sum = 0;
    for (let i = 0; i < n; i++) sum += coeffs[i] ?? 0;
    // Guard against divide-by-zero
    if (sum === 0) sum = 1;
    for (let i = 0; i < n; i++) coeffs[i] = (coeffs[i] ?? 0) / sum;
    return coeffs;
  }

  /**
   * Apply FIR filter to IQ samples (real coefficients) and return filtered samples
   */
  private applyFIR(samples: IQSample[], coeffs: Float32Array): IQSample[] {
    const n = coeffs.length;
    const half = Math.floor(n / 2);
    const out = new Array<IQSample>(samples.length);
    for (let i = 0; i < samples.length; i++) {
      let accI = 0;
      let accQ = 0;
      for (let k = 0; k < n; k++) {
        const idx = i + k - half;
        let s: IQSample;
        if (idx >= 0 && idx < samples.length) {
          const candidate = samples[idx];
          if (candidate !== undefined) {
            s = candidate;
          } else {
            s = { I: 0, Q: 0 };
          }
        } else {
          s = { I: 0, Q: 0 };
        }
        const c = coeffs[k] ?? 0;
        accI += s.I * c;
        accQ += s.Q * c;
      }
      out[i] = { I: accI, Q: accQ };
    }
    return out;
  }

  /**
   * Decimate IQ samples by integer factor
   *
   * @param samples - Input IQ samples
   * @param factor - Decimation factor (keep every Nth sample)
   * @returns Decimated samples
   */
  private decimate(samples: IQSample[], factor: number): IQSample[] {
    if (factor <= 1) {
      return samples;
    }

    const decimated = new Array<IQSample>(Math.ceil(samples.length / factor));
    let writeIdx = 0;

    for (let i = 0; i < samples.length; i += factor) {
      decimated[writeIdx++] = samples[i] ?? { I: 0, Q: 0 };
    }

    return decimated.slice(0, writeIdx);
  }

  /**
   * FM demodulation using phase discrimination
   *
   * @param samples - IQ samples (baseband)
   * @returns Demodulated audio/baseband signal
   */
  private demodulateFM(samples: IQSample[]): Float32Array {
    const output = new Float32Array(samples.length);
    let previousPhase = 0;

    for (const [i, sample] of samples.entries()) {
      // Input entries are always defined; guard removed for cleanliness

      // Calculate instantaneous phase
      const phase = Math.atan2(sample.Q, sample.I);

      // Calculate phase difference (frequency deviation)
      let phaseDiff = phase - previousPhase;

      // Unwrap phase
      if (phaseDiff > Math.PI) {
        phaseDiff -= 2 * Math.PI;
      } else if (phaseDiff < -Math.PI) {
        phaseDiff += 2 * Math.PI;
      }

      // Normalize to audio range
      output[i] = phaseDiff / Math.PI;
      previousPhase = phase;
    }

    return output;
  }

  /**
   * Get all channels with RDS data
   */
  getChannels(): FMChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channel by frequency
   */
  getChannel(frequency: number): FMChannel | undefined {
    return this.channels.get(frequency);
  }

  /**
   * Update processor configuration
   */
  updateConfig(config: Partial<MultiStationFMConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Reset all RDS decoders
   */
  resetAllDecoders(): void {
    for (const channel of this.channels.values()) {
      channel.rdsDecoder?.reset();
    }
  }
}

/**
 * Create a multi-station FM processor
 */
export function createMultiStationFMProcessor(
  config: MultiStationFMConfig,
): MultiStationFMProcessor {
  return new MultiStationFMProcessor(config);
}
