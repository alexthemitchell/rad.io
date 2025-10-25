/**
 * Signal Quality Metrics
 * Implements SNR, SINAD, THD, and EVM calculations
 */

import type {
  SignalQualityMetrics,
  MeasurementConfig,
} from "./types";

/**
 * Calculates various signal quality metrics
 */
export class SignalQualityAnalyzer {
  private config: Required<MeasurementConfig>;

  constructor(config?: MeasurementConfig) {
    this.config = {
      maxMarkers: config?.maxMarkers ?? 8,
      markerTrackPeak: config?.markerTrackPeak ?? false,
      integrationMethod: config?.integrationMethod ?? "trapezoidal",
      occupiedBandwidthThreshold:
        config?.occupiedBandwidthThreshold ?? 0.99,
      noiseFloorSamples: config?.noiseFloorSamples ?? 1000,
      harmonicCount: config?.harmonicCount ?? 5,
      averagingEnabled: config?.averagingEnabled ?? true,
      averagingCount: config?.averagingCount ?? 10,
      averagingMode: config?.averagingMode ?? "exponential",
      applyFrequencyCalibration:
        config?.applyFrequencyCalibration ?? true,
      applyPowerCalibration: config?.applyPowerCalibration ?? true,
      applyIQCalibration: config?.applyIQCalibration ?? true,
    };
  }

  /**
   * Calculate Signal-to-Noise Ratio (SNR)
   */
  calculateSNR(
    spectrum: Float32Array,
    signalFrequency: number,
    signalBandwidth: number,
    frequencies: Float32Array,
  ): number {
    // Find signal power
    const signalPower = this.measureBandPower(
      spectrum,
      frequencies,
      signalFrequency,
      signalBandwidth,
    );

    // Estimate noise floor from regions outside signal
    const noisePower = this.estimateNoisePower(
      spectrum,
      frequencies,
      signalFrequency,
      signalBandwidth,
    );

    // SNR in dB
    return signalPower - noisePower;
  }

  /**
   * Calculate SINAD (Signal + Noise + Distortion to Noise + Distortion)
   */
  calculateSINAD(
    timeDomainSamples: Float32Array,
    signalFrequency: number,
    sampleRate: number,
  ): number {
    // Perform FFT on time domain samples
    const spectrum = this.performFFT(timeDomainSamples);

    // Find fundamental frequency bin
    const binWidth = sampleRate / spectrum.length;
    const fundamentalBin = Math.round(signalFrequency / binWidth);

    // Total power (signal + noise + distortion)
    let totalPower = 0;
    for (const power of spectrum) {
      totalPower += Math.pow(10, power / 10);
    }

    // Noise + distortion power (everything except fundamental)
    let noiseDistortionPower = 0;
    const fundamentalBandwidth = 3; // bins

    for (let i = 0; i < spectrum.length; i++) {
      if (
        Math.abs(i - fundamentalBin) <= fundamentalBandwidth
      ) {
        continue; // Skip fundamental
      }
      const power = spectrum[i];
      if (power === undefined) {continue;}
      noiseDistortionPower += Math.pow(10, power / 10);
    }

    // SINAD in dB
    const sinad =
      10 *
      Math.log10(totalPower / (noiseDistortionPower + 1e-20));

    return sinad;
  }

  /**
   * Calculate Total Harmonic Distortion (THD)
   */
  calculateTHD(
    spectrum: Float32Array,
    fundamentalFrequency: number,
    frequencies: Float32Array,
  ): number {
    // Find fundamental power
    const fundamentalPower = this.findPowerAtFrequency(
      spectrum,
      frequencies,
      fundamentalFrequency,
    );

    // Find harmonic powers
    let harmonicPowerSum = 0;
    for (let n = 2; n <= this.config.harmonicCount + 1; n++) {
      const harmonicFreq = fundamentalFrequency * n;
      const harmonicPower = this.findPowerAtFrequency(
        spectrum,
        frequencies,
        harmonicFreq,
      );
      harmonicPowerSum += Math.pow(10, harmonicPower / 10);
    }

    // THD in %
    const thdRatio = Math.sqrt(
      harmonicPowerSum / Math.pow(10, fundamentalPower / 10),
    );
    return thdRatio * 100;
  }

  /**
   * Calculate Error Vector Magnitude (EVM) for digital modulation
   */
  calculateEVM(
    receivedIQ: Array<{ I: number; Q: number }>,
    referenceIQ: Array<{ I: number; Q: number }>,
  ): number {
    if (receivedIQ.length !== referenceIQ.length) {
      throw new Error("Sample arrays must have equal length");
    }

    let errorPowerSum = 0;
    let referencePowerSum = 0;

    for (let i = 0; i < receivedIQ.length; i++) {
      const rx = receivedIQ[i];
      const ref = referenceIQ[i];
      if (!rx || !ref) {continue;}

      const errorI = rx.I - ref.I;
      const errorQ = rx.Q - ref.Q;
      const errorPower = errorI * errorI + errorQ * errorQ;

      const refPower = ref.I * ref.I + ref.Q * ref.Q;

      errorPowerSum += errorPower;
      referencePowerSum += refPower;
    }

    // EVM in %
    const evm = Math.sqrt(
      errorPowerSum / (referencePowerSum + 1e-20),
    );
    return evm * 100;
  }

  /**
   * Calculate all quality metrics at once
   */
  calculateAllMetrics(
    spectrum: Float32Array,
    frequencies: Float32Array,
    signalFrequency: number,
    signalBandwidth: number,
    timeDomainSamples?: Float32Array,
    sampleRate?: number,
  ): SignalQualityMetrics {
    const snr = this.calculateSNR(
      spectrum,
      signalFrequency,
      signalBandwidth,
      frequencies,
    );

    let sinad: number | undefined;
    if (timeDomainSamples && sampleRate) {
      try {
        sinad = this.calculateSINAD(
          timeDomainSamples,
          signalFrequency,
          sampleRate,
        );
      } catch {
        sinad = undefined;
      }
    }

    let thd: number | undefined;
    try {
      thd = this.calculateTHD(
        spectrum,
        signalFrequency,
        frequencies,
      );
    } catch {
      thd = undefined;
    }

    return {
      snr,
      sinad,
      thd,
      timestamp: Date.now(),
    };
  }

  /**
   * Measure power in a frequency band
   */
  private measureBandPower(
    spectrum: Float32Array,
    frequencies: Float32Array,
    centerFrequency: number,
    bandwidth: number,
  ): number {
    const startFreq = centerFrequency - bandwidth / 2;
    const endFreq = centerFrequency + bandwidth / 2;

    let totalLinearPower = 0;
    let count = 0;

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq === undefined) {continue;}

      if (freq >= startFreq && freq <= endFreq) {
        const powerDb = spectrum[i];
        if (powerDb === undefined) {continue;}
        totalLinearPower += Math.pow(10, powerDb / 10);
        count++;
      }
    }

    if (count === 0) {
      return -Infinity;
    }

    return 10 * Math.log10(totalLinearPower / count);
  }

  /**
   * Estimate noise power from spectrum regions outside signal
   */
  private estimateNoisePower(
    spectrum: Float32Array,
    frequencies: Float32Array,
    signalFrequency: number,
    signalBandwidth: number,
  ): number {
    const excludeStart = signalFrequency - signalBandwidth;
    const excludeEnd = signalFrequency + signalBandwidth;

    const noiseSamples: number[] = [];

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq === undefined) {continue;}

      if (freq < excludeStart || freq > excludeEnd) {
        const power = spectrum[i];
        if (power !== undefined) {
          noiseSamples.push(Math.pow(10, power / 10));
        }
      }

      if (noiseSamples.length >= this.config.noiseFloorSamples) {
        break;
      }
    }

    if (noiseSamples.length === 0) {
      return -Infinity;
    }

    // Use median for robust noise estimation
    noiseSamples.sort((a, b) => a - b);
    const median =
      noiseSamples[Math.floor(noiseSamples.length / 2)] ?? 0;

    return 10 * Math.log10(median + 1e-20);
  }

  /**
   * Find power at a specific frequency
   */
  private findPowerAtFrequency(
    spectrum: Float32Array,
    frequencies: Float32Array,
    targetFrequency: number,
  ): number {
    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq === undefined) {continue;}

      const diff = Math.abs(freq - targetFrequency);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    return spectrum[closestIdx] ?? -Infinity;
  }

  /**
   * Perform FFT on time domain samples
   * Simple DFT implementation for small sample sets
   */
  private performFFT(samples: Float32Array): Float32Array {
    const N = samples.length;
    const spectrum = new Float32Array(N / 2);

    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        const sample = samples[n] ?? 0;
        real += sample * Math.cos(angle);
        imag += sample * Math.sin(angle);
      }

      const magnitude = Math.sqrt(real * real + imag * imag);
      spectrum[k] = 20 * Math.log10(magnitude + 1e-20);
    }

    return spectrum;
  }
}
