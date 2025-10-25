/**
 * Peak Detector
 * Implements ADR-0013: Automatic Signal Detection System
 *
 * Detects peaks in spectrum data representing potential signals
 */

/**
 * Represents a detected peak/signal in the spectrum
 */
export interface Peak {
  /** FFT bin index of peak maximum */
  binIndex: number;
  /** Center frequency in Hz */
  frequency: number;
  /** Peak power in dB */
  power: number;
  /** Estimated bandwidth in Hz */
  bandwidth: number;
  /** Signal-to-noise ratio in dB */
  snr: number;
}

/**
 * Detects peaks in power spectrum data
 */
export class PeakDetector {
  private readonly thresholdDB: number;
  private readonly minBandwidth: number;
  private readonly maxBandwidth: number;

  /**
   * Create a new peak detector
   * @param thresholdDB Threshold above noise floor in dB (default: 10)
   * @param minBandwidth Minimum signal bandwidth in Hz (default: 1000)
   * @param maxBandwidth Maximum signal bandwidth in Hz (default: 1000000)
   */
  constructor(thresholdDB = 10, minBandwidth = 1000, maxBandwidth = 1_000_000) {
    this.thresholdDB = thresholdDB;
    this.minBandwidth = minBandwidth;
    this.maxBandwidth = maxBandwidth;
  }

  /**
   * Detect peaks in a power spectrum
   * @param spectrum Power spectrum in dB
   * @param noiseFloor Estimated noise floor in dB
   * @param sampleRate Sample rate in Hz
   * @param centerFreq Center frequency in Hz
   * @returns Array of detected peaks
   */
  detect(
    spectrum: Float32Array,
    noiseFloor: number,
    sampleRate: number,
    centerFreq: number,
  ): Peak[] {
    const threshold = noiseFloor + this.thresholdDB;
    const peaks: Peak[] = [];

    let inPeak = false;
    let peakStart = 0;
    let peakMax = -Infinity;
    let peakMaxBin = 0;

    for (let i = 0; i < spectrum.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const power = spectrum[i]!;

      if (power > threshold) {
        if (!inPeak) {
          // Peak start
          inPeak = true;
          peakStart = i;
          peakMax = power;
          peakMaxBin = i;
        } else {
          // Continue peak - track maximum
          if (power > peakMax) {
            peakMax = power;
            peakMaxBin = i;
          }
        }
      } else {
        if (inPeak) {
          // Peak end - validate and store
          const peakEnd = i - 1;
          const bandwidth =
            ((peakEnd - peakStart) / spectrum.length) * sampleRate;

          // Validate bandwidth is in acceptable range
          if (
            bandwidth >= this.minBandwidth &&
            bandwidth <= this.maxBandwidth
          ) {
            const frequency = this.binToFrequency(
              peakMaxBin,
              spectrum.length,
              sampleRate,
              centerFreq,
            );

            peaks.push({
              binIndex: peakMaxBin,
              frequency,
              power: peakMax,
              bandwidth,
              snr: peakMax - noiseFloor,
            });
          }

          inPeak = false;
        }
      }
    }

    // Handle peak at end of spectrum
    if (inPeak) {
      const peakEnd = spectrum.length - 1;
      const bandwidth = ((peakEnd - peakStart) / spectrum.length) * sampleRate;

      if (bandwidth >= this.minBandwidth && bandwidth <= this.maxBandwidth) {
        const frequency = this.binToFrequency(
          peakMaxBin,
          spectrum.length,
          sampleRate,
          centerFreq,
        );

        peaks.push({
          binIndex: peakMaxBin,
          frequency,
          power: peakMax,
          bandwidth,
          snr: peakMax - noiseFloor,
        });
      }
    }

    return peaks;
  }

  /**
   * Convert FFT bin index to frequency
   * @param bin FFT bin index
   * @param fftSize FFT size
   * @param sampleRate Sample rate in Hz
   * @param centerFreq Center frequency in Hz
   * @returns Frequency in Hz
   */
  private binToFrequency(
    bin: number,
    fftSize: number,
    sampleRate: number,
    centerFreq: number,
  ): number {
    // Calculate frequency offset from center
    const offset = ((bin - fftSize / 2) / fftSize) * sampleRate;
    return centerFreq + offset;
  }
}
