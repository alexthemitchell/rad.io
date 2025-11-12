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
    const rawPeaks: Array<{
      start: number;
      end: number;
      maxBin: number;
      maxPower: number;
    }> = [];

    let inPeak = false;
    let peakStart = 0;
    let peakMax = -Infinity;
    let peakMaxBin = 0;

    // First pass: detect all regions above threshold
    for (let i = 0; i < spectrum.length; i++) {
      const power = spectrum[i];
      if (power === undefined) {
        continue;
      }

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
          // Peak end - store raw peak
          rawPeaks.push({
            start: peakStart,
            end: i - 1,
            maxBin: peakMaxBin,
            maxPower: peakMax,
          });
          inPeak = false;
        }
      }
    }

    // Handle peak at end of spectrum
    if (inPeak) {
      rawPeaks.push({
        start: peakStart,
        end: spectrum.length - 1,
        maxBin: peakMaxBin,
        maxPower: peakMax,
      });
    }

    // Second pass: merge nearby peaks that are likely part of the same wideband signal
    // This handles FM broadcast signals which have a characteristic dip at the carrier
    const mergedPeaks = this.mergeNearbyPeaks(
      rawPeaks,
      spectrum,
      sampleRate,
      noiseFloor,
    );

    // Third pass: convert to Peak objects and validate bandwidth
    const peaks: Peak[] = [];
    for (const merged of mergedPeaks) {
      const bandwidth =
        ((merged.end - merged.start) / spectrum.length) * sampleRate;

      // Validate bandwidth is in acceptable range
      if (bandwidth >= this.minBandwidth && bandwidth <= this.maxBandwidth) {
        const frequency = this.binToFrequency(
          merged.maxBin,
          spectrum.length,
          sampleRate,
          centerFreq,
        );

        peaks.push({
          binIndex: merged.maxBin,
          frequency,
          power: merged.maxPower,
          bandwidth,
          snr: merged.maxPower - noiseFloor,
        });
      }
    }

    return peaks;
  }

  /**
   * Merge nearby peaks that are likely part of the same wideband signal
   * This handles FM broadcast signals which have characteristic dips at the carrier
   * @param rawPeaks Array of raw detected peak regions
   * @param spectrum Full power spectrum
   * @param sampleRate Sample rate in Hz
   * @param noiseFloor Noise floor in dB
   * @returns Merged peaks
   */
  private mergeNearbyPeaks(
    rawPeaks: Array<{
      start: number;
      end: number;
      maxBin: number;
      maxPower: number;
    }>,
    spectrum: Float32Array,
    sampleRate: number,
    _noiseFloor: number,
  ): Array<{ start: number; end: number; maxBin: number; maxPower: number }> {
    if (rawPeaks.length === 0) {
      return [];
    }

    const mergedPeaks: Array<{
      start: number;
      end: number;
      maxBin: number;
      maxPower: number;
    }> = [];

    // Sort peaks by start position and iterate without unsafe indexing
    const sortedPeaks = [...rawPeaks].sort((a, b) => a.start - b.start);
    const [first, ...rest] = sortedPeaks;
    if (!first) {
      return [];
    }
    let currentPeak = first;

    for (const nextPeak of rest) {
      const gapBins = nextPeak.start - currentPeak.end;
      const gapHz = (gapBins / spectrum.length) * sampleRate;

      // Calculate average power in the gap
      let gapPowerSum = 0;
      let gapCount = 0;
      for (
        let j = currentPeak.end + 1;
        j < nextPeak.start && j < spectrum.length;
        j++
      ) {
        const value = spectrum[j];
        if (value === undefined) {
          continue;
        }
        gapPowerSum += value;
        gapCount++;
      }
      const avgGapPower = gapCount > 0 ? gapPowerSum / gapCount : -Infinity;

      // Merge if:
      // 1. Gap is small (< 30 kHz) - likely a narrow dip in a wideband signal
      // 2. OR gap is moderate (< 100 kHz) AND gap power is relatively high
      //    (within 15 dB of weaker peak - indicates FM sidebands)
      const shouldMerge =
        gapHz < 30_000 ||
        (gapHz < 100_000 &&
          avgGapPower > Math.min(currentPeak.maxPower, nextPeak.maxPower) - 15);

      if (shouldMerge) {
        // Merge: extend current peak to include next peak
        currentPeak = {
          start: currentPeak.start,
          end: nextPeak.end,
          maxBin:
            currentPeak.maxPower >= nextPeak.maxPower
              ? currentPeak.maxBin
              : nextPeak.maxBin,
          maxPower: Math.max(currentPeak.maxPower, nextPeak.maxPower),
        };
      } else {
        // Don't merge: save current peak and start new one
        mergedPeaks.push(currentPeak);
        currentPeak = nextPeak;
      }
    }

    // Don't forget the last peak
    mergedPeaks.push(currentPeak);

    return mergedPeaks;
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
