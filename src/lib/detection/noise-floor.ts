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
    const medianSpectrum = new Float32Array(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      const values = this.history.map((h) => h[i]).sort((a, b) => a - b);
      medianSpectrum[i] = values[Math.floor(values.length / 2)];
    }

    // Noise floor is median of lower 25% of bins
    // This excludes signals and focuses on pure noise
    const sorted = Array.from(medianSpectrum).sort((a, b) => a - b);
    const quarterPoint = Math.floor(sorted.length * 0.25);
    return sorted[quarterPoint];
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
