/**
 * ATSC 8-VSB Trellis Viterbi Decoder
 *
 * This module generates the 12-way demux/mux tables (per GNU Radio's atsc_viterbi_gen)
 * and provides a decoder entry point. The actual 4-state single Viterbi is implemented
 * in soft-decision form to compute a dibit output (00..11) per input symbol.
 *
 * Notes:
 * - One data segment contains 832 symbols; first 4 are sync and are not decoded.
 * - There are 12 trellis encoders, interleaved across symbols and bytes in a fixed pattern.
 * - For correctness we process symbols in groups of 12 segments.
 */

// ATSC constants
const ENCODERS = 12;
const SYMBOLS_PER_SEGMENT = 832; // including 4 sync symbols
const DATA_SYMBOLS_PER_SEGMENT = 828;
const RS_BYTES_PER_SEGMENT = 207; // RS(207,187)

// Internal constants mirror GNU Radio generator
// 2 bits per dibit, 8 bits per byte
const ENCODER_SEG_BUMP = 4; // how encoder index advances at segment boundary

/** Encoded location for a dibit within the 12x207 output byte space */
function packDibitPtr(byteIndex: number, shift: number): number {
  // shift is 6,4,2,0; pack as low 3 bits for shift and rest for byte index
  return (byteIndex << 3) | (shift & 0x07);
}

export interface ViterbiMuxTables {
  encoWhichSyms: number[][]; // [12][828]
  encoWhichDibits: number[][]; // [12][828] packed pointers into 12*207 output bytes
  maxPerEncoder: number; // expected 828
}

/**
 * Generate demux/mux tables that map input symbols across 12 segments to
 * 12 single Viterbi decoders, and map the resulting dibits back into
 * the 12x207-byte output buffer.
 *
 * Ported conceptually from GNU Radio's atsc_viterbi_gen.cc
 */
export function generateViterbiMuxTables(): ViterbiMuxTables {
  // We build tables that cover exactly 12 data segments (a group),
  // each with 828 data symbols (after 4 sync). Total usable symbols = 12*828.
  const encoWhichSyms: number[][] = new Array(ENCODERS);
  const encoWhichDibits: number[][] = new Array(ENCODERS);
  for (let e = 0; e < ENCODERS; e++) {
    encoWhichSyms[e] = new Array<number>(DATA_SYMBOLS_PER_SEGMENT);
    encoWhichDibits[e] = new Array<number>(DATA_SYMBOLS_PER_SEGMENT);
  }

  // Pointers that track where each encoder's output dibits should be placed (in bytes)
  // within the 12*207 output space.
  const trellisWhereData: number[] = new Array(ENCODERS);

  // We iterate over input bytes across the 12 segments; every input byte contains 4 dibits.
  // For each dibit shift (6,4,2,0), we assign 1 symbol to each encoder in turn.
  // We also track symbol positions across the 12 segments, skipping the first 4 sync per segment.
  let currentEncoder = 0;
  let symp = 0; // global symbol pointer across 12 segments
  let nextSegBoundary = DATA_SYMBOLS_PER_SEGMENT; // after removing 4 sync, data symbols per segment
  let currentSegment = 0;

  // Initialize byte destinations for each encoder for the first 12*207-byte block
  for (let e = 0; e < ENCODERS; e++) trellisWhereData[e] = e;

  // Total input bytes across 12 segments
  const totalOutputBytes = RS_BYTES_PER_SEGMENT * ENCODERS; // 12*207
  // const totalDibits = totalOutputBytes * DIBITS_PER_BYTE; // 12*207*4

  // We'll fill, for each encoder, exactly 828 entries
  const maxPerEncoder = DATA_SYMBOLS_PER_SEGMENT;
  const filledCount: number[] = new Array(ENCODERS).fill(0);

  for (let byteIndex = 0; byteIndex < totalOutputBytes; byteIndex += ENCODERS) {
    // At each chunk of 12 bytes (one per encoder), assign in round-robin
    // For each encoder, its current data byte destination will be byteIndex + e
    for (let e = 0; e < ENCODERS; e++) trellisWhereData[e] = byteIndex + e;

    // For each dibit position within a byte (MSB to LSB)
    for (let shift = 6; shift >= 0; shift -= 2) {
      // At segment boundaries, skip 4 sync symbols and bump encoder assignment by 4
      while (symp >= nextSegBoundary && currentSegment < ENCODERS - 1) {
        // Advance to next segment (skip its 4 sync symbols)
        currentSegment += 1;
        // position after sync of next segment
        nextSegBoundary += DATA_SYMBOLS_PER_SEGMENT;
        // The encoder index is bumped by 4 positions at each segment boundary
        currentEncoder = (currentEncoder + ENCODER_SEG_BUMP) % ENCODERS;
      }

      // Assign one symbol to each encoder in turn
      for (let k = 0; k < ENCODERS; k++) {
        const e = currentEncoder;
        if ((filledCount[e] ?? 0) < maxPerEncoder) {
          const idx = filledCount[e] ?? 0;
          encoWhichSyms[e]![idx] =
            symp + currentSegment * (SYMBOLS_PER_SEGMENT - 4);
          encoWhichDibits[e]![idx] = packDibitPtr(trellisWhereData[e]!, shift);
          filledCount[e] = idx + 1;
        }
        currentEncoder = (currentEncoder + 1) % ENCODERS;
        symp += 1;
      }
    }
  }

  // Sanity: all encoders should have exactly 828 entries
  for (let e = 0; e < ENCODERS; e++) {
    if ((filledCount[e] ?? 0) !== maxPerEncoder) {
      // Trim or pad with last known values to meet contract (shouldn't happen)
      encoWhichSyms[e] = encoWhichSyms[e]!.slice(0, maxPerEncoder);
      encoWhichDibits[e] = encoWhichDibits[e]!.slice(0, maxPerEncoder);
    }
  }

  return { encoWhichSyms, encoWhichDibits, maxPerEncoder };
}

// 8-VSB nominal levels used as constellation points (for reference)

/** A minimal 4-state soft-decision Viterbi per GNU Radio's atsc_single_viterbi idea */
class SingleViterbi {
  private pathMetrics: Float32Array;
  private nextPathMetrics: Float32Array;
  // Stores the survivor dibit for each state at the current step, used in the Viterbi decoding process.
  private survivorDibit: Uint8Array;

  // Next-state mapping for a simple 2-bit input driving a 2-bit state shift-register
  // ns = ((s << 1) | (dibit & 1)) & 0x3
  private static nextState(s: number, dibit: number): number {
    return ((s << 1) | (dibit & 1)) & 0x3;
  }

  constructor() {
    this.pathMetrics = new Float32Array(4);
    this.pathMetrics.fill(0);
    this.nextPathMetrics = new Float32Array(4);
    this.nextPathMetrics.fill(0);
    this.survivorDibit = new Uint8Array(4);
  }

  /** Compute Euclidean distance metric to 8-VSB nominal levels per dibit candidate */
  private branchMetric(symbol: number, dibit: number): number {
    // Map dibit to a pair of close 8-VSB levels, use nearest as soft metric
    const candidates = this.dibitToLevels(dibit);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
      const d = symbol - (candidates[i] ?? 0);
      const m = d * d;
      if (m < best) best = m;
    }
    return best;
  }

  private dibitToLevels(dibit: number): number[] {
    switch (dibit & 0x3) {
      case 0:
        return [-7, -5];
      case 1:
        return [-3, -1];
      case 2:
        return [1, 3];
      default:
        return [5, 7];
    }
  }

  /** Decode one symbol using true ACS over 4 states; returns survivor dibit */
  decode(symbol: number): number {
    // Initialize next metrics large
    for (let ns = 0; ns < 4; ns++) {
      this.nextPathMetrics[ns] = Number.POSITIVE_INFINITY;
      this.survivorDibit[ns] = 0;
    }

    // Explore all branches from current states and select best survivor for each next-state
    for (let s = 0; s < 4; s++) {
      const pm = this.pathMetrics[s] ?? 0;
      for (let dibit = 0; dibit < 4; dibit++) {
        const ns = SingleViterbi.nextState(s, dibit);
        const metric = pm + this.branchMetric(symbol, dibit);
        if (metric < (this.nextPathMetrics[ns] ?? Number.POSITIVE_INFINITY)) {
          this.nextPathMetrics[ns] = metric;
          this.survivorDibit[ns] = dibit & 0x3;
        }
      }
    }

    // Commit next metrics
    for (let ns = 0; ns < 4; ns++) {
      this.pathMetrics[ns] =
        this.nextPathMetrics[ns] ?? this.pathMetrics[ns] ?? 0;
    }

    // Choose best next-state and return its survivor dibit
    let bestState = 0;
    let bestMetric = this.pathMetrics[0] ?? Number.POSITIVE_INFINITY;
    for (let ns = 1; ns < 4; ns++) {
      const m = this.pathMetrics[ns] ?? Number.POSITIVE_INFINITY;
      if (m < bestMetric) {
        bestMetric = m;
        bestState = ns;
      }
    }
    return (this.survivorDibit[bestState] ?? 0) & 0x3;
  }
}

/**
 * Decode 12 segments (12*832 symbols) and return 12*207 RS-coded bytes
 * The input must be a Float32Array whose length is a multiple of 12*832.
 */
export function trellisViterbiDecode(symbols: Float32Array): Uint8Array {
  const groupSymbols = ENCODERS * SYMBOLS_PER_SEGMENT;
  if (symbols.length < groupSymbols || symbols.length % groupSymbols !== 0) {
    return new Uint8Array(0);
  }

  const tables = generateViterbiMuxTables();
  const outBytes = new Uint8Array(ENCODERS * RS_BYTES_PER_SEGMENT);
  const decoders: SingleViterbi[] = new Array(ENCODERS);
  for (let e = 0; e < ENCODERS; e++) decoders[e] = new SingleViterbi();

  // We'll process just the first 12 segments in the buffer to produce one block
  // The caller may invoke repeatedly as more symbols arrive.
  // For symbol access: index into flattened segments
  function getSymbol(globalIdx: number): number {
    // globalIdx counts data symbols across 12 segments; we need to map to actual symbol index within each segment offset by +4 to skip sync
    const seg = Math.floor(globalIdx / DATA_SYMBOLS_PER_SEGMENT);
    const withinData = globalIdx % DATA_SYMBOLS_PER_SEGMENT;
    const offset = seg * SYMBOLS_PER_SEGMENT + 4 + withinData;
    return symbols[offset] ?? 0;
  }

  for (let e = 0; e < ENCODERS; e++) {
    for (let i = 0; i < tables.maxPerEncoder; i++) {
      const symIndex = (tables.encoWhichSyms[e] ?? [])[i] ?? 0;
      const s = getSymbol(symIndex);
      const dibit = (decoders[e] ?? new SingleViterbi()).decode(s);
      const ptr = (tables.encoWhichDibits[e] ?? [])[i] ?? 0;
      const byteIndex = (ptr >> 3) | 0; // shared 12*207 space
      const shift = ptr & 0x7;
      const prev = outBytes[byteIndex] ?? 0;
      outBytes[byteIndex] = (prev | (((dibit ?? 0) & 0x3) << shift)) & 0xff;
    }
  }

  return outBytes;
}
