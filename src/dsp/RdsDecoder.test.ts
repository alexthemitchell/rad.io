import { describe, expect, it } from 'vitest';
import { RdsDecoder } from './RdsDecoder';

const RDS_POLY = 0x5b9;
const OFFSETS = {
  A: 0x034,
  B: 0x0b4,
  C: 0x0d4,
  C_PRIME: 0x154,
  D: 0x1b4
} as const;

type OffsetName = keyof typeof OFFSETS;

type DecoderInternals = {
  pushBit: (bit: number) => void;
  computeSyndrome: (word: number) => number;
  bitCount: number;
  bitShiftRegister: number;
};

function computeSyndrome(word: number): number {
  let reg = word;

  for (let bit = 25; bit >= 10; bit--) {
    if (((reg >> bit) & 1) === 1) {
      reg ^= RDS_POLY << (bit - 10);
    }
  }

  return reg & 0x03ff;
}

function encodeBlockWord(data: number, offset: OffsetName): number {
  const payload = (data & 0xffff) << 10;
  const target = OFFSETS[offset];

  for (let check = 0; check < 1024; check++) {
    const word = payload | check;
    if (computeSyndrome(word) === target) {
      return word;
    }
  }

  throw new Error(`Unable to encode block for offset ${offset}`);
}

function feedWord(decoder: RdsDecoder, word: number): void {
  const internals = decoder as unknown as DecoderInternals;

  // Reset sliding window so each test word is evaluated as one isolated block.
  internals.bitCount = 0;
  internals.bitShiftRegister = 0;

  for (let bit = 25; bit >= 0; bit--) {
    internals.pushBit((word >> bit) & 1);
  }
}

function feedGroup(decoder: RdsDecoder, a: number, b: number, c: number, d: number, cPrime = false): void {
  feedWord(decoder, encodeBlockWord(a, 'A'));
  feedWord(decoder, encodeBlockWord(b, 'B'));
  feedWord(decoder, encodeBlockWord(c, cPrime ? 'C_PRIME' : 'C'));
  feedWord(decoder, encodeBlockWord(d, 'D'));
}

describe('RdsDecoder parser path', () => {
  it('decodes a full 0A group from raw block words', () => {
    const decoder = new RdsDecoder();

    const pi = 0x2a6f;
    const groupType = 0;
    const versionA = 0;
    const tp = 1;
    const pty = 10;
    const ta = 1;
    const ms = 0;
    const segment = 0;

    const blockB = (groupType << 12) | (versionA << 11) | (tp << 10) | (pty << 5) | (ta << 4) | (ms << 3) | segment;
    const blockC = 0;
    const blockD = (0x4b << 8) | 0x51; // KQ

    feedGroup(decoder, pi, blockB, blockC, blockD, false);

    const snapshot = decoder.getSnapshot();

    expect(snapshot.synced).toBe(true);
    expect(snapshot.totalBlocks).toBe(4);
    expect(snapshot.totalGroups).toBe(1);
    expect(snapshot.blockErrorRate).toBe(0);
    expect(snapshot.piCode).toBe(pi);
    expect(snapshot.ptyCode).toBe(pty);
    expect(snapshot.tp).toBe(true);
    expect(snapshot.ta).toBe(true);
    expect(snapshot.ps.startsWith('KQ')).toBe(true);
    expect(snapshot.latestGroup).toBe('0A');
  });

  it('handles 2B groups with C-prime blocks and uses block D text', () => {
    const decoder = new RdsDecoder();

    const pi = 0x2a6f;
    const groupType = 2;
    const versionB = 1;
    const segment = 0;

    const blockB = (groupType << 12) | (versionB << 11) | segment;
    const blockCPrime = 0x9999; // ignored for 2B text extraction
    const blockD = (0x48 << 8) | 0x49; // HI

    feedGroup(decoder, pi, blockB, blockCPrime, blockD, true);

    const snapshot = decoder.getSnapshot();

    expect(snapshot.totalBlocks).toBe(4);
    expect(snapshot.totalGroups).toBe(1);
    expect(snapshot.latestGroup).toBe('2B');
    expect(snapshot.radiotext.startsWith('HI')).toBe(true);
  });

  it('tracks syndrome misses in blockErrorRate denominator', () => {
    const decoder = new RdsDecoder();
    const internals = decoder as unknown as DecoderInternals;

    // 26 ones do not map to any valid RDS block offset.
    for (let i = 0; i < 26; i++) {
      internals.pushBit(1);
    }

    // Feed one valid A block to get one successful block count.
    feedWord(decoder, encodeBlockWord(0x1234, 'A'));

    const snapshot = decoder.getSnapshot();
    const expectedRate = 1 / 2; // one miss, one success

    expect(snapshot.totalBlocks).toBe(1);
    expect(snapshot.totalGroups).toBe(0);
    expect(snapshot.blockErrorRate).toBeCloseTo(expectedRate, 6);
    expect(internals.computeSyndrome((1 << 26) - 1)).not.toBe(OFFSETS.A);
  });
});
