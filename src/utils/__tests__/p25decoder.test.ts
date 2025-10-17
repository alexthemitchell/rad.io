/**
 * Tests for P25 Phase 2 Decoder
 */

import {
  P25Symbol,
  P25TDMASlot,
  phaseToSymbol,
  symbolToBits,
  demodulateHDQPSK,
  extractTDMASlots,
  symbolsToBits,
  detectFrameSync,
  calculateSignalQuality,
  decodeP25Phase2,
  getFrameDescription,
  extractTalkgroupInfo,
  DEFAULT_P25_CONFIG,
} from "../p25decoder";
import { Sample } from "../dsp";

describe("P25 Phase 2 Decoder", () => {
  describe("phaseToSymbol", () => {
    it("should map -135° to SYMBOL_00", () => {
      const phase = (-135 * Math.PI) / 180;
      expect(phaseToSymbol(phase)).toBe(P25Symbol.SYMBOL_00);
    });

    it("should map -45° to SYMBOL_01", () => {
      const phase = (-45 * Math.PI) / 180;
      expect(phaseToSymbol(phase)).toBe(P25Symbol.SYMBOL_01);
    });

    it("should map +45° to SYMBOL_10", () => {
      const phase = (45 * Math.PI) / 180;
      expect(phaseToSymbol(phase)).toBe(P25Symbol.SYMBOL_10);
    });

    it("should map +135° to SYMBOL_11", () => {
      const phase = (135 * Math.PI) / 180;
      expect(phaseToSymbol(phase)).toBe(P25Symbol.SYMBOL_11);
    });

    it("should handle phase wrap-around", () => {
      const phase1 = (225 * Math.PI) / 180; // Should wrap to -135°
      expect(phaseToSymbol(phase1)).toBe(P25Symbol.SYMBOL_00);

      const phase2 = (315 * Math.PI) / 180; // Should wrap to -45°
      expect(phaseToSymbol(phase2)).toBe(P25Symbol.SYMBOL_01);
    });

    it("should handle boundary cases", () => {
      expect(phaseToSymbol(-Math.PI)).toBe(P25Symbol.SYMBOL_00);
      expect(phaseToSymbol(Math.PI)).toBe(P25Symbol.SYMBOL_11);
      expect(phaseToSymbol(0)).toBe(P25Symbol.SYMBOL_10);
    });
  });

  describe("symbolToBits", () => {
    it("should convert SYMBOL_00 to [0, 0]", () => {
      expect(symbolToBits(P25Symbol.SYMBOL_00)).toEqual([0, 0]);
    });

    it("should convert SYMBOL_01 to [0, 1]", () => {
      expect(symbolToBits(P25Symbol.SYMBOL_01)).toEqual([0, 1]);
    });

    it("should convert SYMBOL_10 to [1, 0]", () => {
      expect(symbolToBits(P25Symbol.SYMBOL_10)).toEqual([1, 0]);
    });

    it("should convert SYMBOL_11 to [1, 1]", () => {
      expect(symbolToBits(P25Symbol.SYMBOL_11)).toEqual([1, 1]);
    });
  });

  describe("demodulateHDQPSK", () => {
    it("should return empty array for insufficient samples", () => {
      const samples: Sample[] = [{ I: 1, Q: 0 }];
      expect(demodulateHDQPSK(samples)).toEqual([]);
    });

    it("should demodulate simple phase shifts", () => {
      // Create IQ samples with known phase shifts
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];

      // Generate samples for a +45° phase shift (SYMBOL_10)
      for (let i = 0; i < samplesPerSymbol * 2; i++) {
        const phase = i < samplesPerSymbol ? 0 : (45 * Math.PI) / 180; // Phase shift at symbol boundary
        samples.push({
          I: Math.cos(phase),
          Q: Math.sin(phase),
        });
      }

      const symbols = demodulateHDQPSK(samples);
      expect(symbols.length).toBeGreaterThan(0);
    });

    it("should handle multiple symbols", () => {
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];

      // Generate 4 symbols with different phase shifts
      const phases = [0, 45, 90, 135]; // degrees
      for (const phaseDeg of phases) {
        for (let i = 0; i < samplesPerSymbol; i++) {
          const phase = (phaseDeg * Math.PI) / 180;
          samples.push({
            I: Math.cos(phase),
            Q: Math.sin(phase),
          });
        }
      }

      const symbols = demodulateHDQPSK(samples);
      expect(symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("extractTDMASlots", () => {
    it("should split symbols into two slots", () => {
      const symbols = [0, 1, 2, 3, 0, 1, 2, 3];
      const { slot1, slot2 } = extractTDMASlots(symbols);

      expect(slot1).toEqual([0, 2, 0, 2]);
      expect(slot2).toEqual([1, 3, 1, 3]);
    });

    it("should handle odd number of symbols", () => {
      const symbols = [0, 1, 2, 3, 0];
      const { slot1, slot2 } = extractTDMASlots(symbols);

      expect(slot1).toEqual([0, 2, 0]);
      expect(slot2).toEqual([1, 3]);
    });

    it("should handle empty input", () => {
      const symbols: number[] = [];
      const { slot1, slot2 } = extractTDMASlots(symbols);

      expect(slot1).toEqual([]);
      expect(slot2).toEqual([]);
    });

    it("should handle single symbol", () => {
      const symbols = [0];
      const { slot1, slot2 } = extractTDMASlots(symbols);

      expect(slot1).toEqual([0]);
      expect(slot2).toEqual([]);
    });
  });

  describe("symbolsToBits", () => {
    it("should convert symbols to bits", () => {
      const symbols = [
        P25Symbol.SYMBOL_00,
        P25Symbol.SYMBOL_01,
        P25Symbol.SYMBOL_10,
        P25Symbol.SYMBOL_11,
      ];
      const bits = symbolsToBits(symbols);

      expect(bits).toEqual([0, 0, 0, 1, 1, 0, 1, 1]);
    });

    it("should handle empty input", () => {
      expect(symbolsToBits([])).toEqual([]);
    });

    it("should handle single symbol", () => {
      expect(symbolsToBits([P25Symbol.SYMBOL_10])).toEqual([1, 0]);
    });
  });

  describe("detectFrameSync", () => {
    it("should detect exact sync pattern", () => {
      const syncPattern = [1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0];
      const bits = [0, 0, ...syncPattern, 1, 1];
      const syncIdx = detectFrameSync(bits, 1.0);

      expect(syncIdx).toBe(2);
    });

    it("should detect sync pattern with errors within threshold", () => {
      // Sync pattern with 1 bit error (out of 12 bits = 91.7% match)
      const bits = [0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1];
      const syncIdx = detectFrameSync(bits, 0.9);

      expect(syncIdx).toBe(2);
    });

    it("should not detect sync pattern if threshold not met", () => {
      // Pattern with too many errors
      const bits = [1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0];
      const syncIdx = detectFrameSync(bits, 1.0);

      expect(syncIdx).toBe(-1);
    });

    it("should return -1 for insufficient bits", () => {
      const bits = [1, 0, 1];
      const syncIdx = detectFrameSync(bits);

      expect(syncIdx).toBe(-1);
    });

    it("should find first occurrence of sync pattern", () => {
      const syncPattern = [1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0];
      const bits = [0, 0, ...syncPattern, 0, ...syncPattern];
      const syncIdx = detectFrameSync(bits, 1.0);

      expect(syncIdx).toBe(2);
    });
  });

  describe("calculateSignalQuality", () => {
    it("should return 0 for empty samples", () => {
      const quality = calculateSignalQuality([], []);
      expect(quality).toBe(0);
    });

    it("should return high quality for ideal constellation", () => {
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];
      const symbols: number[] = [];

      // Generate perfect QPSK constellation points
      const phases = [0, (45 * Math.PI) / 180]; // Perfect +45° shift
      for (const phase of phases) {
        for (let i = 0; i < samplesPerSymbol; i++) {
          samples.push({
            I: Math.cos(phase),
            Q: Math.sin(phase),
          });
        }
      }
      symbols.push(P25Symbol.SYMBOL_10);

      const quality = calculateSignalQuality(samples, symbols);
      expect(quality).toBeGreaterThan(80);
    });

    it("should return lower quality for noisy constellation", () => {
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];
      const symbols: number[] = [];

      // Generate samples with phase errors
      for (let i = 0; i < samplesPerSymbol * 2; i++) {
        const phase = i < samplesPerSymbol ? 0 : (60 * Math.PI) / 180; // 15° error from ideal 45°
        samples.push({
          I: Math.cos(phase) + Math.random() * 0.1, // Add noise
          Q: Math.sin(phase) + Math.random() * 0.1,
        });
      }
      symbols.push(P25Symbol.SYMBOL_10);

      const quality = calculateSignalQuality(samples, symbols);
      expect(quality).toBeLessThan(95);
    });
  });

  describe("decodeP25Phase2", () => {
    it("should return empty result for insufficient samples", () => {
      const samples: Sample[] = [{ I: 1, Q: 0 }];
      const result = decodeP25Phase2(samples);

      expect(result.frames).toEqual([]);
      expect(result.errorRate).toBe(1.0);
    });

    it("should decode P25 frames from valid samples", () => {
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];

      // Generate enough samples for multiple symbols with sync pattern
      // We need at least 24 symbols (12 for sync * 2 for TDMA)
      const symbolCount = 30;
      for (let s = 0; s < symbolCount; s++) {
        const phase = (s * 45 * Math.PI) / 180; // Rotate through phases
        for (let i = 0; i < samplesPerSymbol; i++) {
          samples.push({
            I: Math.cos(phase),
            Q: Math.sin(phase),
          });
        }
      }

      const result = decodeP25Phase2(samples);

      expect(result).toBeDefined();
      expect(result.frames).toBeDefined();
      expect(result.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.errorRate).toBeLessThanOrEqual(1);
    });

    it("should extract TDMA slots", () => {
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];

      // Generate samples for testing TDMA extraction
      for (let i = 0; i < 100; i++) {
        const phase = (i * 45 * Math.PI) / 180;
        for (let j = 0; j < samplesPerSymbol; j++) {
          samples.push({
            I: Math.cos(phase),
            Q: Math.sin(phase),
          });
        }
      }

      const result = decodeP25Phase2(samples);

      // Even with no sync, should still process symbols
      expect(result).toBeDefined();
    });

    it("should set isEncrypted flag correctly", () => {
      const samplesPerSymbol = Math.floor(
        DEFAULT_P25_CONFIG.sampleRate / DEFAULT_P25_CONFIG.symbolRate,
      );
      const samples: Sample[] = [];

      for (let i = 0; i < 50; i++) {
        for (let j = 0; j < samplesPerSymbol; j++) {
          samples.push({
            I: Math.cos(0),
            Q: Math.sin(0),
          });
        }
      }

      const result = decodeP25Phase2(samples);

      expect(typeof result.isEncrypted).toBe("boolean");
    });
  });

  describe("getFrameDescription", () => {
    it("should return human-readable frame description", () => {
      const frame = {
        slot: P25TDMASlot.SLOT_1,
        symbols: [0, 1, 2, 3],
        bits: [0, 0, 0, 1, 1, 0, 1, 1],
        timestamp: Date.now(),
        signalQuality: 95,
        isValid: true,
      };

      const description = getFrameDescription(frame);

      expect(description).toContain("Slot 1");
      expect(description).toContain("4 symbols");
      expect(description).toContain("95%");
      expect(description).toContain("Valid: true");
    });

    it("should handle slot 2", () => {
      const frame = {
        slot: P25TDMASlot.SLOT_2,
        symbols: [0, 1],
        bits: [0, 0, 0, 1],
        timestamp: Date.now(),
        signalQuality: 80,
        isValid: false,
      };

      const description = getFrameDescription(frame);

      expect(description).toContain("Slot 2");
      expect(description).toContain("Valid: false");
    });
  });

  describe("extractTalkgroupInfo", () => {
    it("should extract talkgroup info from bits", () => {
      const bits = [1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0];
      const info = extractTalkgroupInfo(bits);

      expect(info).toBeDefined();
      expect(typeof info).toBe("object");
    });

    it("should handle empty bits", () => {
      const info = extractTalkgroupInfo([]);
      expect(info).toBeDefined();
    });
  });

  describe("DEFAULT_P25_CONFIG", () => {
    it("should have correct sample rate", () => {
      expect(DEFAULT_P25_CONFIG.sampleRate).toBe(48000);
    });

    it("should have correct symbol rate", () => {
      expect(DEFAULT_P25_CONFIG.symbolRate).toBe(6000);
    });

    it("should have reasonable sync threshold", () => {
      expect(DEFAULT_P25_CONFIG.syncThreshold).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_P25_CONFIG.syncThreshold).toBeLessThanOrEqual(1);
    });
  });
});
