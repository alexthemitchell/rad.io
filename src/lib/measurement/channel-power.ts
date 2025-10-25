/**
 * Channel Power Measurement
 * Implements power integration and occupied bandwidth calculation
 */

import type {
  ChannelPowerResult,
  MeasurementConfig,
} from "./types";

/**
 * Measures channel power and occupied bandwidth
 */
export class ChannelPowerMeasurement {
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
   * Measure total power in a frequency band
   */
  measureChannelPower(
    spectrum: Float32Array,
    frequencies: Float32Array,
    centerFrequency: number,
    bandwidth: number,
  ): ChannelPowerResult {
    const startFreq = centerFrequency - bandwidth / 2;
    const endFreq = centerFrequency + bandwidth / 2;

    // Find indices for the band
    const { startIdx, endIdx } = this.findBandIndices(
      frequencies,
      startFreq,
      endFreq,
    );

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      throw new Error("Invalid frequency range");
    }

    // Convert dB to linear power for integration
    const linearPower: number[] = [];
    let peakPower = -Infinity;
    for (let i = startIdx; i <= endIdx; i++) {
      const powerDb = spectrum[i];
      if (powerDb === undefined) {continue;}

      const linear = Math.pow(10, powerDb / 10);
      linearPower.push(linear);

      if (powerDb > peakPower) {
        peakPower = powerDb;
      }
    }

    // Integrate power
    const totalLinearPower = this.integratePower(
      linearPower,
      frequencies,
      startIdx,
      endIdx,
    );

    // Convert back to dB
    const totalPower = 10 * Math.log10(totalLinearPower + 1e-20);

    // Calculate average power
    const avgLinearPower =
      totalLinearPower / (endIdx - startIdx + 1);
    const averagePower = 10 * Math.log10(avgLinearPower + 1e-20);

    // Calculate occupied bandwidth
    const occupiedBandwidth = this.calculateOccupiedBandwidth(
      linearPower,
      frequencies,
      startIdx,
      endIdx,
      totalLinearPower,
    );

    return {
      centerFrequency,
      bandwidth,
      totalPower,
      peakPower,
      averagePower,
      occupiedBandwidth,
    };
  }

  /**
   * Measure Adjacent Channel Power Ratio (ACPR)
   */
  measureACPR(
    spectrum: Float32Array,
    frequencies: Float32Array,
    centerFrequency: number,
    channelBandwidth: number,
    adjacentOffset: number,
  ): {
    mainChannelPower: number;
    lowerAdjacentPower: number;
    upperAdjacentPower: number;
    lowerACPR: number;
    upperACPR: number;
  } {
    // Main channel
    const mainChannel = this.measureChannelPower(
      spectrum,
      frequencies,
      centerFrequency,
      channelBandwidth,
    );

    // Lower adjacent channel
    const lowerChannel = this.measureChannelPower(
      spectrum,
      frequencies,
      centerFrequency - adjacentOffset,
      channelBandwidth,
    );

    // Upper adjacent channel
    const upperChannel = this.measureChannelPower(
      spectrum,
      frequencies,
      centerFrequency + adjacentOffset,
      channelBandwidth,
    );

    return {
      mainChannelPower: mainChannel.totalPower,
      lowerAdjacentPower: lowerChannel.totalPower,
      upperAdjacentPower: upperChannel.totalPower,
      lowerACPR: mainChannel.totalPower - lowerChannel.totalPower,
      upperACPR: mainChannel.totalPower - upperChannel.totalPower,
    };
  }

  /**
   * Find band indices in frequency array
   */
  private findBandIndices(
    frequencies: Float32Array,
    startFreq: number,
    endFreq: number,
  ): { startIdx: number; endIdx: number } {
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq === undefined) {continue;}

      if (startIdx === -1 && freq >= startFreq) {
        startIdx = i;
      }
      if (freq <= endFreq) {
        endIdx = i;
      }
    }

    return { startIdx, endIdx };
  }

  /**
   * Integrate power using configured method
   */
  private integratePower(
    linearPower: number[],
    frequencies: Float32Array,
    startIdx: number,
    endIdx: number,
  ): number {
    if (linearPower.length === 0) {
      return 0;
    }

    if (this.config.integrationMethod === "rectangular") {
      return this.rectangularIntegration(linearPower);
    } else {
      return this.trapezoidalIntegration(
        linearPower,
        frequencies,
        startIdx,
        endIdx,
      );
    }
  }

  /**
   * Rectangular integration
   */
  private rectangularIntegration(linearPower: number[]): number {
    return linearPower.reduce((sum, p) => sum + p, 0);
  }

  /**
   * Trapezoidal integration
   */
  private trapezoidalIntegration(
    linearPower: number[],
    frequencies: Float32Array,
    startIdx: number,
    _endIdx: number,
  ): number {
    if (linearPower.length < 2) {
      return linearPower[0] ?? 0;
    }

    let sum = 0;
    for (let i = 0; i < linearPower.length - 1; i++) {
      const freq1 = frequencies[startIdx + i];
      const freq2 = frequencies[startIdx + i + 1];
      if (freq1 === undefined || freq2 === undefined) {continue;}

      const power1 = linearPower[i];
      const power2 = linearPower[i + 1];
      if (power1 === undefined || power2 === undefined) {continue;}

      const width = freq2 - freq1;
      sum += ((power1 + power2) / 2) * width;
    }

    return sum;
  }

  /**
   * Calculate occupied bandwidth (99% power containment by default)
   */
  private calculateOccupiedBandwidth(
    linearPower: number[],
    frequencies: Float32Array,
    startIdx: number,
    _endIdx: number,
    totalPower: number,
  ): number {
    // Find cumulative power distribution
    let cumulativePower = 0;
    let obwStartIdx = startIdx;
    let obwEndIdx = startIdx;

    // Find start of occupied bandwidth (0.5% threshold)
    const lowerThreshold = totalPower * (1 - this.config.occupiedBandwidthThreshold) / 2;
    for (let i = 0; i < linearPower.length; i++) {
      const power = linearPower[i];
      if (power === undefined) {continue;}
      cumulativePower += power;
      if (cumulativePower >= lowerThreshold) {
        obwStartIdx = startIdx + i;
        break;
      }
    }

    // Find end of occupied bandwidth (99.5% threshold)
    cumulativePower = 0;
    const upperThreshold = totalPower * (1 - (1 - this.config.occupiedBandwidthThreshold) / 2);
    for (let i = 0; i < linearPower.length; i++) {
      const power = linearPower[i];
      if (power === undefined) {continue;}
      cumulativePower += power;
      if (cumulativePower >= upperThreshold) {
        obwEndIdx = startIdx + i;
        break;
      }
    }

    const startFreq = frequencies[obwStartIdx];
    const endFreq = frequencies[obwEndIdx];

    if (startFreq === undefined || endFreq === undefined) {
      return 0;
    }

    return Math.abs(endFreq - startFreq);
  }

  /**
   * Calculate Complementary Cumulative Distribution Function (CCDF)
   */
  calculateCCDF(
    spectrum: Float32Array,
    numBins = 100,
  ): { threshold: number[]; probability: number[] } {
    const sortedPowers = Array.from(spectrum).sort((a, b) => b - a);

    const threshold: number[] = [];
    const probability: number[] = [];

    for (let i = 0; i < numBins; i++) {
      const idx = Math.floor(
        (i / numBins) * sortedPowers.length,
      );
      const power = sortedPowers[idx];
      if (power === undefined) {continue;}

      threshold.push(power);
      probability.push(i / numBins);
    }

    return { threshold, probability };
  }
}
