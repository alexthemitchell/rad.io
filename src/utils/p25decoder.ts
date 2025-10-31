/**
 * P25 Phase 2 Decoder
 *
 * Implements P25 Phase 2 TDMA digital radio signal decoding from IQ samples.
 * P25 Phase 2 uses H-DQPSK (Harmonized Differential Quadrature Phase Shift Keying)
 * modulation with TDMA (Time Division Multiple Access) to support two voice channels
 * in a 12.5 kHz bandwidth.
 *
 * Key Features:
 * - H-DQPSK demodulation
 * - TDMA slot extraction (Slot 1 and Slot 2)
 * - Symbol-to-bit decoding
 * - Frame synchronization
 * - Error detection
 *
 * References:
 * - TIA-102 P25 Phase 2 Standard
 * - Signal Identification Wiki: https://www.sigidwiki.com/wiki/Project_25_(P25)
 */

import { type Sample } from "./dsp";

/**
 * P25 Phase 2 symbol mapping
 * H-DQPSK uses 4 phase shifts corresponding to 2 bits per symbol
 */
export enum P25Symbol {
  SYMBOL_00 = 0, // -135 degrees (or -3π/4 radians)
  SYMBOL_01 = 1, // -45 degrees (or -π/4 radians)
  SYMBOL_10 = 2, // +45 degrees (or +π/4 radians)
  SYMBOL_11 = 3, // +135 degrees (or +3π/4 radians)
}

/**
 * P25 Phase 2 TDMA slot (2 slots per frame)
 */
export enum P25TDMASlot {
  SLOT_1 = 1,
  SLOT_2 = 2,
}

/**
 * P25 Phase 2 frame structure
 */
export type P25Frame = {
  slot: P25TDMASlot;
  symbols: number[];
  bits: number[];
  timestamp: number;
  signalQuality: number; // 0-100
  isValid: boolean;
};

/**
 * P25 Phase 2 decoded data
 */
export type P25DecodedData = {
  frames: P25Frame[];
  talkgroupId?: number;
  sourceId?: number;
  isEncrypted: boolean;
  errorRate: number;
};

/**
 * P25 Phase 2 decoder configuration
 */
export type P25DecoderConfig = {
  sampleRate: number;
  symbolRate: number; // 6000 symbols/sec for P25 Phase 2
  carrierFrequency: number;
  syncThreshold: number; // 0-1, frame sync detection threshold
};

/**
 * Default P25 Phase 2 decoder configuration
 */
export const DEFAULT_P25_CONFIG: P25DecoderConfig = {
  sampleRate: 48000,
  symbolRate: 6000, // P25 Phase 2 uses 6000 symbols/second
  carrierFrequency: 0, // DC after downconversion
  syncThreshold: 0.8,
};

/**
 * P25 Phase 2 sync pattern (simplified - in reality this would be the full sync word)
 */
const P25_SYNC_PATTERN = [1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0];

/**
 * Calculate phase from IQ sample
 */
function calculatePhase(sample: Sample): number {
  return Math.atan2(sample.Q, sample.I);
}

/**
 * Normalize phase difference to [-π, π]
 */
function normalizePhase(inputPhase: number): number {
  let phase = inputPhase;
  while (phase > Math.PI) {
    phase -= 2 * Math.PI;
  }
  while (phase < -Math.PI) {
    phase += 2 * Math.PI;
  }
  return phase;
}

/**
 * Map differential phase to P25 symbol
 *
 * P25 Phase 2 uses H-DQPSK with 4 phase shifts:
 * - -135° (-3π/4) → Symbol 00
 * - -45° (-π/4) → Symbol 01
 * - +45° (+π/4) → Symbol 10
 * - +135° (+3π/4) → Symbol 11
 */
export function phaseToSymbol(diffPhase: number): P25Symbol {
  const phase = normalizePhase(diffPhase);

  // Convert phase to degrees for easier comparison
  const degrees = (phase * 180) / Math.PI;

  if (degrees < -90) {
    return P25Symbol.SYMBOL_00; // -135 degrees
  } else if (degrees < 0) {
    return P25Symbol.SYMBOL_01; // -45 degrees
  } else if (degrees < 90) {
    return P25Symbol.SYMBOL_10; // +45 degrees
  } else {
    return P25Symbol.SYMBOL_11; // +135 degrees
  }
}

/**
 * Convert P25 symbol to bit pair
 */
export function symbolToBits(symbol: P25Symbol): [number, number] {
  switch (symbol) {
    case P25Symbol.SYMBOL_00:
      return [0, 0];
    case P25Symbol.SYMBOL_01:
      return [0, 1];
    case P25Symbol.SYMBOL_10:
      return [1, 0];
    case P25Symbol.SYMBOL_11:
      return [1, 1];
    default:
      return [0, 0];
  }
}

/**
 * Demodulate H-DQPSK from IQ samples
 *
 * This function extracts symbols from IQ samples using differential phase detection
 */
export function demodulateHDQPSK(
  samples: Sample[],
  config: P25DecoderConfig = DEFAULT_P25_CONFIG,
): number[] {
  if (samples.length < 2) {
    return [];
  }

  const symbols: number[] = [];
  const samplesPerSymbol = Math.floor(config.sampleRate / config.symbolRate);

  // Process samples in chunks corresponding to symbol period
  for (let i = samplesPerSymbol; i < samples.length; i += samplesPerSymbol) {
    const prevSample = samples[i - samplesPerSymbol];
    const currSample = samples[i];

    if (!prevSample || !currSample) {
      continue;
    }

    // Calculate phases
    const prevPhase = calculatePhase(prevSample);
    const currPhase = calculatePhase(currSample);

    // Calculate differential phase
    const diffPhase = normalizePhase(currPhase - prevPhase);

    // Map to symbol
    const symbol = phaseToSymbol(diffPhase);
    symbols.push(symbol);
  }

  return symbols;
}

/**
 * Extract TDMA slots from symbol stream
 *
 * P25 Phase 2 alternates between two TDMA slots
 * Each slot contains half of the symbols in the stream
 */
export function extractTDMASlots(symbols: number[]): {
  slot1: number[];
  slot2: number[];
} {
  const slot1: number[] = [];
  const slot2: number[] = [];

  // TDMA alternates: even indices = slot 1, odd indices = slot 2
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (symbol !== undefined) {
      if (i % 2 === 0) {
        slot1.push(symbol);
      } else {
        slot2.push(symbol);
      }
    }
  }

  return { slot1, slot2 };
}

/**
 * Convert symbols to bits
 */
export function symbolsToBits(symbols: number[]): number[] {
  const bits: number[] = [];

  for (const symbol of symbols) {
    const [bit1, bit2] = symbolToBits(symbol as P25Symbol);
    bits.push(bit1, bit2);
  }

  return bits;
}

/**
 * Detect P25 frame synchronization pattern
 *
 * Returns the index where sync pattern was found, or -1 if not found
 */
export function detectFrameSync(bits: number[], threshold = 0.8): number {
  const syncLength = P25_SYNC_PATTERN.length;
  const minMatches = Math.floor(syncLength * threshold);

  for (let i = 0; i <= bits.length - syncLength; i++) {
    let matches = 0;

    for (let j = 0; j < syncLength; j++) {
      if (bits[i + j] === P25_SYNC_PATTERN[j]) {
        matches++;
      }
    }

    if (matches >= minMatches) {
      return i;
    }
  }

  return -1;
}

/**
 * Calculate signal quality metric (0-100)
 *
 * Based on phase deviation from ideal constellation points
 */
export function calculateSignalQuality(
  samples: Sample[],
  symbols: number[],
  config: P25DecoderConfig = DEFAULT_P25_CONFIG,
): number {
  if (samples.length < 2 || symbols.length === 0) {
    return 0;
  }

  const samplesPerSymbol = Math.floor(config.sampleRate / config.symbolRate);
  let totalError = 0;
  let count = 0;

  // Ideal phase shifts for each symbol
  const idealPhases = {
    [P25Symbol.SYMBOL_00]: (-135 * Math.PI) / 180,
    [P25Symbol.SYMBOL_01]: (-45 * Math.PI) / 180,
    [P25Symbol.SYMBOL_10]: (45 * Math.PI) / 180,
    [P25Symbol.SYMBOL_11]: (135 * Math.PI) / 180,
  };

  for (
    let i = 0;
    i < Math.min(symbols.length, Math.floor(samples.length / samplesPerSymbol));
    i++
  ) {
    const sampleIdx = (i + 1) * samplesPerSymbol;
    const prevIdx = i * samplesPerSymbol;

    if (sampleIdx >= samples.length || prevIdx >= samples.length) {
      continue;
    }

    const prevSample = samples[prevIdx];
    const currSample = samples[sampleIdx];
    const symbol = symbols[i];

    if (!prevSample || !currSample || symbol === undefined) {
      continue;
    }

    const prevPhase = calculatePhase(prevSample);
    const currPhase = calculatePhase(currSample);
    const actualDiffPhase = normalizePhase(currPhase - prevPhase);
    const idealPhase = idealPhases[symbol as P25Symbol];

    const error = Math.abs(normalizePhase(actualDiffPhase - idealPhase));
    totalError += error;
    count++;
  }

  if (count === 0) {
    return 0;
  }

  // Convert average phase error to quality percentage
  const avgError = totalError / count;
  const maxError = Math.PI; // Maximum possible phase error
  const quality = Math.max(0, Math.min(100, 100 * (1 - avgError / maxError)));

  return Math.round(quality);
}

/**
 * Decode P25 Phase 2 data from IQ samples
 *
 * Main entry point for P25 Phase 2 decoding
 */
export function decodeP25Phase2(
  samples: Sample[],
  config: P25DecoderConfig = DEFAULT_P25_CONFIG,
): P25DecodedData {
  // Step 1: Demodulate H-DQPSK to get symbols
  const symbols = demodulateHDQPSK(samples, config);

  if (symbols.length === 0) {
    return {
      frames: [],
      isEncrypted: false,
      errorRate: 1.0,
    };
  }

  // Step 2: Extract TDMA slots
  const { slot1, slot2 } = extractTDMASlots(symbols);

  // Step 3: Convert symbols to bits for each slot
  const slot1Bits = symbolsToBits(slot1);
  const slot2Bits = symbolsToBits(slot2);

  // Step 4: Detect frame sync
  const slot1SyncIdx = detectFrameSync(slot1Bits, config.syncThreshold);
  const slot2SyncIdx = detectFrameSync(slot2Bits, config.syncThreshold);

  // Step 5: Calculate signal quality
  const quality = calculateSignalQuality(samples, symbols, config);

  // Step 6: Build frames
  const frames: P25Frame[] = [];
  const timestamp = Date.now();

  if (slot1SyncIdx >= 0 && slot1.length > 0) {
    frames.push({
      slot: P25TDMASlot.SLOT_1,
      symbols: slot1,
      bits: slot1Bits,
      timestamp,
      signalQuality: quality,
      isValid: true,
    });
  }

  if (slot2SyncIdx >= 0 && slot2.length > 0) {
    frames.push({
      slot: P25TDMASlot.SLOT_2,
      symbols: slot2,
      bits: slot2Bits,
      timestamp,
      signalQuality: quality,
      isValid: true,
    });
  }

  // Step 7: Calculate error rate (simplified)
  const errorRate =
    frames.length > 0 ? Math.max(0, (100 - quality) / 100) : 1.0;

  return {
    frames,
    isEncrypted: false, // Would need to parse header bits to determine this
    errorRate,
  };
}

/**
 * Get human-readable description of P25 frame
 */
export function getFrameDescription(frame: P25Frame): string {
  return `P25 Phase 2 - Slot ${frame.slot}, ${frame.symbols.length} symbols, Quality: ${frame.signalQuality}%, Valid: ${frame.isValid}`;
}

/**
 * Extract talkgroup information from P25 frame bits
 * (Simplified - real implementation would parse the full frame structure)
 *
 * TODO: Implement full Link Control Word (LCW) parsing to extract:
 * - Talkgroup ID from bits 48-63 of voice header
 * - Source ID from bits 64-87 of voice header
 * - Parse frame header structure per TIA-102 CAAB specification
 * This requires understanding the complete P25 Phase 2 frame structure
 * including sync patterns, network identifiers, and control fields.
 */
export function extractTalkgroupInfo(bits: number[]): {
  talkgroupId?: number;
  sourceId?: number;
} {
  // Placeholder implementation - returns empty object until full
  // P25 frame parsing is implemented. Talkgroup and source IDs should
  // be passed explicitly to decodeP25Phase2WithLogging if available
  // from other sources (e.g., system configuration or network metadata).
  return {};
  // P25 Phase 2 Link Control Word (LCW) parsing
  // This is a simplified implementation focusing on Group Voice Channel User (GVCHU) format
  //
  // Full P25 Phase 2 LCW structure (after frame sync):
  // - LCW Format: 8 bits (identifies the type of link control)
  // - For Group Voice (0x00):
  //   - Talkgroup Address: 16 bits
  //   - Source Address: 24 bits
  //   - Additional fields and CRC
  //
  // Note: This is a basic implementation. Production systems would need:
  // - Full LCW format identification and handling
  // - Reed-Solomon error correction
  // - CRC-16 verification
  // - Support for all LCW format types

  // Need at least 48 bits for a minimal Group Voice LCW (format + talkgroup + partial source)
  if (bits.length < 48) {
    return {};
  }

  // Extract LCW format (first 8 bits after sync)
  // Common formats:
  // 0x00 = Group Voice Channel User (GVCHU)
  // 0x03 = Unit to Unit Voice Channel User
  // 0x40 = Group Voice Channel Update (GVCHU)
  let lcwFormat = 0;
  for (let i = 0; i < 8; i++) {
    lcwFormat = (lcwFormat << 1) | (bits[i] ?? 0);
  }

  // Only process Group Voice formats (0x00 and 0x40 are most common)
  if (lcwFormat !== 0x00 && lcwFormat !== 0x40) {
    return {}; // Not a group voice transmission
  }

  // Extract talkgroup ID (16 bits, following the format byte)
  let talkgroupId = 0;
  for (let i = 8; i < 24; i++) {
    talkgroupId = (talkgroupId << 1) | (bits[i] ?? 0);
  }

  // Extract source ID (24 bits, following the talkgroup ID)
  // Need at least 48 bits total
  let sourceId = 0;
  if (bits.length >= 48) {
    for (let i = 24; i < 48; i++) {
      sourceId = (sourceId << 1) | (bits[i] ?? 0);
    }
  }

  // Validate that we got meaningful values (not all zeros, which often indicates no data)
  if (talkgroupId === 0 && sourceId === 0) {
    return {};
  }

  return {
    talkgroupId: talkgroupId !== 0 ? talkgroupId : undefined,
    sourceId: sourceId !== 0 ? sourceId : undefined,
  };
}

/**
 * Decode P25 Phase 2 with automatic transmission logging
 *
 * This wrapper around decodeP25Phase2 automatically logs completed transmissions
 * to IndexedDB for historical tracking and analysis.
 *
 * @param samples - IQ samples to decode
 * @param config - Decoder configuration
 * @param options - Logging options
 * @returns Decoded P25 data
 */
export async function decodeP25Phase2WithLogging(
  samples: Sample[],
  config: P25DecoderConfig = DEFAULT_P25_CONFIG,
  options: {
    logger?: {
      logTransmission: (record: {
        timestamp: number;
        talkgroupId?: number;
        sourceId?: number;
        duration: number;
        signalQuality: number;
        slot: number;
        isEncrypted: boolean;
        errorRate: number;
      }) => Promise<number>;
    };
    transmissionStartTime?: number;
  } = {},
): Promise<P25DecodedData> {
  const decoded = decodeP25Phase2(samples, config);

  // If we have frames and a logger, log the transmission
  if (
    decoded.frames.length > 0 &&
    options.logger &&
    options.transmissionStartTime
  ) {
    const endTime = Date.now();
    const duration = endTime - options.transmissionStartTime;

    // Log each slot as a separate transmission
    for (const frame of decoded.frames) {
      const talkgroupInfo = extractTalkgroupInfo(frame.bits);

      await options.logger.logTransmission({
        timestamp: frame.timestamp,
        talkgroupId: talkgroupInfo.talkgroupId ?? decoded.talkgroupId,
        sourceId: talkgroupInfo.sourceId ?? decoded.sourceId,
        duration,
        signalQuality: frame.signalQuality,
        slot: frame.slot,
        isEncrypted: decoded.isEncrypted,
        errorRate: decoded.errorRate,
      });
    }
  }

  return decoded;
}
