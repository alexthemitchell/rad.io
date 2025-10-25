/**
 * Utility functions for frequency formatting and conversion
 */

/**
 * Format frequency in Hz to human-readable string with appropriate units
 * @param freqHz Frequency in Hz
 * @returns Formatted frequency string (e.g., "100.500 MHz")
 */
export function formatFrequency(freqHz: number): string {
  if (freqHz >= 1e9) {
    return `${(freqHz / 1e9).toFixed(6)} GHz`;
  }
  if (freqHz >= 1e6) {
    return `${(freqHz / 1e6).toFixed(3)} MHz`;
  }
  if (freqHz >= 1e3) {
    return `${(freqHz / 1e3).toFixed(1)} kHz`;
  }
  return `${freqHz.toFixed(0)} Hz`;
}

/**
 * Format sample rate for display
 * @param rate Sample rate in samples per second
 * @returns Formatted sample rate string (e.g., "20.00 MSPS")
 */
export function formatSampleRate(rate: number): string {
  if (rate >= 1e6) {
    return `${(rate / 1e6).toFixed(2)} MSPS`;
  }
  if (rate >= 1e3) {
    return `${(rate / 1e3).toFixed(2)} kSPS`;
  }
  return `${rate.toFixed(0)} SPS`;
}

// Re-export robust ID generator from id.ts to avoid duplication
export { generateBookmarkId } from "./id";
