/**
 * Signal Measurement Conversion Utilities
 * Phase 2 - Measurement Service & Conversion Utilities
 *
 * Provides conversion functions for signal strength measurements:
 * - dBFS to dBm (using calibration constant)
 * - dBm to S-units (HF and VHF/UHF bands)
 *
 * Based on S-Meter specification: docs/reference/s-meter-spec.md
 */

import type { SMeterBand } from "./types";

/**
 * Convert dBFS (decibels relative to full scale) to dBm (absolute power)
 *
 * Formula: dBm = dBFS + K_cal + calibrationOffset
 *
 * @param dbfs - Power level relative to ADC full scale (typically ≤ 0)
 * @param kCal - Calibration constant (device-specific, typically -80 to -40)
 *               This accounts for ADC reference voltage, RF gain, mixer losses, etc.
 * @param calibrationOffset - User-adjustable offset in dB (default: 0)
 *                            Allows fine-tuning calibration without changing kCal
 * @returns Absolute power level in dBm at antenna input
 *
 * @example
 * ```typescript
 * // HackRF One on VHF with typical gain settings and +2dB user adjustment
 * const dBm = convertDbfsToDbm(-30, -70, 2);
 * // Result: -98 dBm
 * ```
 */
export function convertDbfsToDbm(
  dbfs: number,
  kCal: number,
  calibrationOffset = 0,
): number {
  return dbfs + kCal + calibrationOffset;
}

/**
 * Convert dBm to S-unit representation
 *
 * S-units are a standardized signal strength scale from S0 to S9,
 * with extensions above S9 reported as "S9 + X dB".
 *
 * @param dbm - Absolute power level in dBm
 * @param band - Frequency band ('HF' for <30 MHz, 'VHF' for ≥30 MHz)
 * @returns Object containing S-unit (0-9) and overS9 (dB above S9)
 *
 * @example
 * ```typescript
 * // Strong VHF signal
 * const result = dbmToSUnit(-70, 'VHF');
 * // Result: { sUnit: 9, overS9: 23 } => "S9+23"
 *
 * // Weak HF signal
 * const result = dbmToSUnit(-103, 'HF');
 * // Result: { sUnit: 4, overS9: 0 } => "S4"
 * ```
 */
export function dbmToSUnit(
  dbm: number,
  band: SMeterBand,
): { sUnit: number; overS9: number } {
  // S9 reference levels per IARU standard
  const S9_LEVEL_HF = -73; // dBm for HF bands (< 30 MHz)
  const S9_LEVEL_VHF = -93; // dBm for VHF/UHF bands (≥ 30 MHz)
  const S_UNIT_WIDTH = 6; // dB per S-unit step

  const s9Level = band === "HF" ? S9_LEVEL_HF : S9_LEVEL_VHF;

  if (dbm >= s9Level) {
    // Above S9: report as "S9 + X dB"
    return {
      sUnit: 9,
      overS9: dbm - s9Level,
    };
  } else {
    // Below S9: calculate S-unit on 0-9 scale
    // Each S-unit is 6 dB, so S8 is 6 dB below S9, S7 is 12 dB below, etc.
    const dbBelowS9 = s9Level - dbm;
    const sUnit = Math.max(0, 9 - Math.round(dbBelowS9 / S_UNIT_WIDTH));

    return {
      sUnit,
      overS9: 0,
    };
  }
}
