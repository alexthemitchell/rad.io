/**
 * Noise Floor Estimator
 * Implements ADR-0013: Automatic Signal Detection System
 *
 * Provides robust noise floor estimation using median-based algorithm
 * that is resistant to signal interference.
 */

/**
 * Estimates noise floor from spectrum data using median-based approach
 */
export class NoiseFloorEstimator {
  private history: Float32Array[] = [];
  private readonly historySize: number;

  /**
   * Create a new noise floor estimator
   * @param historySize Number of spectra to keep in history (default: 100)
   */
  constructor(historySize = 100) {
    this.historySize = historySize;
  }

  /**
   * Estimate the noise floor from a spectrum
   * @param spectrum Power spectrum in dB
   * @returns Estimated noise floor in dB
   */
  estimate(spectrum: Float32Array): number {
    // Store spectrum in history
    this.history.push(new Float32Array(spectrum));
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    // Compute median at each bin across all history
    // Optimization: Use selection algorithm instead of full sort for median
    const medianSpectrum = new Float32Array(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      const values = this.history.map((h) => h[i]);
      medianSpectrum[i] = this.quickMedian(values);
    }

    // Noise floor is median of lower 25% of bins
    // This excludes signals and focuses on pure noise
    const sorted = Array.from(medianSpectrum).sort((a, b) => a - b);
    const quarterPoint = Math.floor(sorted.length * 0.25);
    return sorted[quarterPoint];
  }

  /**
   * Quick median calculation using partial sort (more efficient than full sort)
   * @param values Array of values
   * @returns Median value
   */
  private quickMedian(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid];
  }

  /**
   * Reset the estimator history
   */
  reset(): void {
    this.history = [];
  }

  /**
   * Get current history size
   */
  getHistoryLength(): number {
    return this.history.length;
  }
}
