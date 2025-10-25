/**
 * Spectrum Mask Testing
 * Implements regulatory compliance mask testing
 */

import type { SpectrumMask, MaskTestResult, MaskPoint } from "./types";

/**
 * Tests spectrum against regulatory masks
 */
export class SpectrumMaskTester {
  private masks = new Map<string, SpectrumMask>();

  constructor() {
    this.initializeDefaultMasks();
  }

  /**
   * Define a new spectrum mask
   */
  defineMask(mask: SpectrumMask): void {
    // Ensure points are sorted by frequency offset
    mask.points.sort((a, b) => a.frequencyOffset - b.frequencyOffset);
    this.masks.set(mask.id, mask);
  }

  /**
   * Get mask by ID
   */
  getMask(maskId: string): SpectrumMask | undefined {
    return this.masks.get(maskId);
  }

  /**
   * Get all masks
   */
  getAllMasks(): SpectrumMask[] {
    return Array.from(this.masks.values());
  }

  /**
   * Test spectrum against a mask
   */
  testMask(
    maskId: string,
    spectrum: Float32Array,
    frequencies: Float32Array,
    carrierFrequency: number,
    carrierPower: number,
  ): MaskTestResult {
    const mask = this.masks.get(maskId);
    if (!mask) {
      throw new Error(`Mask not found: ${maskId}`);
    }

    const violations: MaskTestResult["violations"] = [];
    let worstMargin = Infinity;

    // Test each frequency bin against the mask
    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      const power = spectrum[i];
      if (freq === undefined || power === undefined) {
        continue;
      }

      const offset = freq - carrierFrequency;
      const limit = this.interpolateMaskLimit(mask.points, offset);

      // Power relative to carrier
      const relativePower = power - carrierPower;

      // Margin is how much headroom we have (positive = pass, negative = fail)
      const margin = limit - relativePower;

      if (margin < 0) {
        violations.push({
          frequency: freq,
          measuredPower: relativePower,
          limitPower: limit,
          margin,
        });
      }

      worstMargin = Math.min(worstMargin, margin);
    }

    return {
      maskId,
      passed: violations.length === 0,
      violations,
      worstMargin: worstMargin === Infinity ? 0 : worstMargin,
      timestamp: Date.now(),
    };
  }

  /**
   * Interpolate mask limit at a given frequency offset
   */
  private interpolateMaskLimit(
    points: MaskPoint[],
    frequencyOffset: number,
  ): number {
    if (points.length === 0) {
      return Infinity;
    }

    // If offset is before first point, use first point's limit
    if (frequencyOffset <= (points[0]?.frequencyOffset ?? 0)) {
      return points[0]?.powerLimit ?? Infinity;
    }

    // If offset is after last point, use last point's limit
    if (frequencyOffset >= (points[points.length - 1]?.frequencyOffset ?? 0)) {
      return points[points.length - 1]?.powerLimit ?? Infinity;
    }

    // Find surrounding points and interpolate
    for (let i = 0; i < points.length - 1; i++) {
      const point1 = points[i];
      const point2 = points[i + 1];
      if (!point1 || !point2) {
        continue;
      }

      if (
        frequencyOffset >= point1.frequencyOffset &&
        frequencyOffset <= point2.frequencyOffset
      ) {
        // Linear interpolation
        const ratio =
          (frequencyOffset - point1.frequencyOffset) /
          (point2.frequencyOffset - point1.frequencyOffset);
        return (
          point1.powerLimit + ratio * (point2.powerLimit - point1.powerLimit)
        );
      }
    }

    return Infinity;
  }

  /**
   * Delete a mask
   */
  deleteMask(maskId: string): boolean {
    return this.masks.delete(maskId);
  }

  /**
   * Initialize default regulatory masks
   */
  private initializeDefaultMasks(): void {
    // FCC Part 15 Class B (Unintentional Radiators)
    this.defineMask({
      id: "fcc-part15-classb",
      name: "FCC Part 15 Class B",
      description: "Unintentional radiators, residential use",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -10_000, powerLimit: -40 }, // -10 kHz
        { frequencyOffset: -1_000, powerLimit: -20 }, // -1 kHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 1_000, powerLimit: -20 }, // +1 kHz
        { frequencyOffset: 10_000, powerLimit: -40 }, // +10 kHz
      ],
    });

    // FM Broadcast (FCC Part 73)
    this.defineMask({
      id: "fcc-fm-broadcast",
      name: "FCC FM Broadcast",
      description: "FM broadcast station emissions mask",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -240_000, powerLimit: -80 }, // -240 kHz
        { frequencyOffset: -200_000, powerLimit: -70 }, // -200 kHz
        { frequencyOffset: -120_000, powerLimit: -30 }, // -120 kHz
        { frequencyOffset: -100_000, powerLimit: -25 }, // -100 kHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 100_000, powerLimit: -25 }, // +100 kHz
        { frequencyOffset: 120_000, powerLimit: -30 }, // +120 kHz
        { frequencyOffset: 200_000, powerLimit: -70 }, // +200 kHz
        { frequencyOffset: 240_000, powerLimit: -80 }, // +240 kHz
      ],
    });

    // P25 Digital Voice (TIA-102)
    this.defineMask({
      id: "tia102-p25",
      name: "P25 Digital (12.5 kHz)",
      description: "APCO P25 Phase 1 emissions mask",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -20_000, powerLimit: -70 }, // -20 kHz
        { frequencyOffset: -15_000, powerLimit: -60 }, // -15 kHz
        { frequencyOffset: -12_500, powerLimit: -45 }, // -12.5 kHz
        { frequencyOffset: -9_000, powerLimit: -28 }, // -9 kHz
        { frequencyOffset: -6_250, powerLimit: -16 }, // -6.25 kHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 6_250, powerLimit: -16 }, // +6.25 kHz
        { frequencyOffset: 9_000, powerLimit: -28 }, // +9 kHz
        { frequencyOffset: 12_500, powerLimit: -45 }, // +12.5 kHz
        { frequencyOffset: 15_000, powerLimit: -60 }, // +15 kHz
        { frequencyOffset: 20_000, powerLimit: -70 }, // +20 kHz
      ],
    });

    // LTE (3GPP)
    this.defineMask({
      id: "3gpp-lte-5mhz",
      name: "LTE 5 MHz Channel",
      description: "3GPP LTE spectrum mask for 5 MHz channel",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -5_000_000, powerLimit: -43 }, // -5 MHz
        { frequencyOffset: -3_000_000, powerLimit: -28 }, // -3 MHz
        { frequencyOffset: -2_500_000, powerLimit: -15 }, // -2.5 MHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 2_500_000, powerLimit: -15 }, // +2.5 MHz
        { frequencyOffset: 3_000_000, powerLimit: -28 }, // +3 MHz
        { frequencyOffset: 5_000_000, powerLimit: -43 }, // +5 MHz
      ],
    });

    // WiFi 802.11g (2.4 GHz)
    this.defineMask({
      id: "wifi-80211g",
      name: "WiFi 802.11g",
      description: "IEEE 802.11g spectral mask",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -22_000_000, powerLimit: -40 }, // -22 MHz
        { frequencyOffset: -20_000_000, powerLimit: -35 }, // -20 MHz
        { frequencyOffset: -11_000_000, powerLimit: -20 }, // -11 MHz
        { frequencyOffset: -9_000_000, powerLimit: -10 }, // -9 MHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 9_000_000, powerLimit: -10 }, // +9 MHz
        { frequencyOffset: 11_000_000, powerLimit: -20 }, // +11 MHz
        { frequencyOffset: 20_000_000, powerLimit: -35 }, // +20 MHz
        { frequencyOffset: 22_000_000, powerLimit: -40 }, // +22 MHz
      ],
    });

    // Generic narrowband FM (land mobile)
    this.defineMask({
      id: "generic-nfm-12.5khz",
      name: "Narrowband FM (12.5 kHz)",
      description: "Generic land mobile narrowband FM",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -25_000, powerLimit: -70 }, // -25 kHz
        { frequencyOffset: -20_000, powerLimit: -60 }, // -20 kHz
        { frequencyOffset: -12_500, powerLimit: -40 }, // -12.5 kHz
        { frequencyOffset: -6_250, powerLimit: -10 }, // -6.25 kHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 6_250, powerLimit: -10 }, // +6.25 kHz
        { frequencyOffset: 12_500, powerLimit: -40 }, // +12.5 kHz
        { frequencyOffset: 20_000, powerLimit: -60 }, // +20 kHz
        { frequencyOffset: 25_000, powerLimit: -70 }, // +25 kHz
      ],
    });

    // Generic wideband FM (land mobile)
    this.defineMask({
      id: "generic-wfm-25khz",
      name: "Wideband FM (25 kHz)",
      description: "Generic land mobile wideband FM",
      centerFrequency: 0,
      points: [
        { frequencyOffset: -50_000, powerLimit: -70 }, // -50 kHz
        { frequencyOffset: -40_000, powerLimit: -60 }, // -40 kHz
        { frequencyOffset: -25_000, powerLimit: -40 }, // -25 kHz
        { frequencyOffset: -12_500, powerLimit: -10 }, // -12.5 kHz
        { frequencyOffset: 0, powerLimit: 0 }, // Carrier
        { frequencyOffset: 12_500, powerLimit: -10 }, // +12.5 kHz
        { frequencyOffset: 25_000, powerLimit: -40 }, // +25 kHz
        { frequencyOffset: 40_000, powerLimit: -60 }, // +40 kHz
        { frequencyOffset: 50_000, powerLimit: -70 }, // +50 kHz
      ],
    });
  }

  /**
   * Export masks to JSON
   */
  exportMasks(): string {
    return JSON.stringify(Array.from(this.masks.values()), null, 2);
  }

  /**
   * Import masks from JSON
   */
  importMasks(json: string): boolean {
    try {
      const masks = JSON.parse(json) as SpectrumMask[];
      for (const mask of masks) {
        this.defineMask(mask);
      }
      return true;
    } catch {
      return false;
    }
  }
}
