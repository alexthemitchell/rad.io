/**
 * Format frequency in Hz to a human-readable string (kHz, MHz, GHz)
 * @param hz - Frequency in Hz
 * @returns Formatted string
 */
export function formatFrequency(hz: number): string {
  if (hz < 1e3) {
    return `${hz} Hz`;
  }
  if (hz < 1e6) {
    return `${(hz / 1e3).toFixed(3)} kHz`;
  }
  if (hz < 1e9) {
    return `${(hz / 1e6).toFixed(3)} MHz`;
  }
  return `${(hz / 1e9).toFixed(3)} GHz`;
}
