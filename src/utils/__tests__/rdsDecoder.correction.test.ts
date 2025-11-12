import { createRDSDecoder } from "../rdsDecoder";
// COPY of offset words used by decoder for syndrome matching in tests
const TEST_OFFSET_WORD_A = 0x0fc;
// RDSBlock type was not needed here; tests construct minimal group objects instead

// Local helper: compute checkword for a data word and desired syndrome by
// mirroring calculateSyndrome logic in the decoder. This duplicates logic
// for tests to construct valid blocks.
function computeCheckwordForSyndrome(
  data: number,
  desiredSyndrome: number,
): number {
  const GENERATOR_POLY = 0x1b9;
  let dataWord = data & 0xffff;
  for (let i = 0; i < 16; i++) {
    if (dataWord & 0x8000) {
      dataWord ^= GENERATOR_POLY << 6;
    }
    dataWord <<= 1;
  }
  const remainder = (dataWord >> 6) & 0x3ff;
  const checkword = desiredSyndrome ^ remainder;
  return checkword & 0x3ff;
}

// Convert data + checkword to bit array (26 bits MSB first)
function toBits(data: number, checkword: number): number[] {
  const bits: number[] = [];
  for (let i = 15; i >= 0; i--) {
    bits.push((data >> i) & 0x1);
  }
  for (let i = 9; i >= 0; i--) {
    bits.push((checkword >> i) & 0x1);
  }
  return bits;
}

describe("RDS decoder single-bit correction & logging", () => {
  it("attemptBlockSync corrects a single-bit error and updates stats", () => {
    const dec = createRDSDecoder(228000) as any;
    // Construct data and checkword so that syndrome matches OFFSET_WORDS.A
    const data = 0x1234; // arbitrary 16-bit data
    const checkword = computeCheckwordForSyndrome(data, TEST_OFFSET_WORD_A);
    const blockBits = toBits(data, checkword);

    // Introduce single-bit error by flipping one bit near the middle
    const badBits = blockBits.slice();
    badBits[5] = badBits[5] ? 0 : 1;

    // Place into internal buffer and attempt sync
    dec.blockBuffer = badBits.slice();
    // Spy on console.warn
    const spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Force attemptBlockSync
    dec.attemptBlockSync();
    expect(dec.stats.validGroups).toBeGreaterThanOrEqual(0); // no groups yet but we processed block A
    // correctedBlocks should have incremented for a successful correction
    expect(dec.stats.correctedBlocks).toBeGreaterThan(0);
    expect(spyWarn).toHaveBeenCalled();
    spyWarn.mockRestore();
  });

  it("parseGroup2 logs on non-ASCII radio text", () => {
    const dec = createRDSDecoder(228000) as any;
    const spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

    // don't need block variable; construct group directly below
    // Build RH group with one block with non-ascii chars in D
    const group: any = {
      blocks: [
        { data: 0x1234 },
        { data: 0x2000 },
        { data: 0x4141 },
        { data: (0x00c3 << 8) | 0x20 },
      ],
      groupType: "2A",
      version: "A",
      pi: 0x1234,
      pty: 0,
      tp: false,
      ta: false,
      timestamp: Date.now(),
    };

    dec.parseGroup2(group as any);
    expect(spyWarn).toHaveBeenCalled();
    spyWarn.mockRestore();
  });

  it("parseGroup0 logs on non-ASCII program service text", () => {
    const dec = createRDSDecoder(228000) as any;
    const spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Construct four PS segments (0..3) with a non-ASCII char at seg 3
    const baseGroup = {
      groupType: "0A",
      version: "A",
      pi: 0x5678,
      pty: 0,
      tp: false,
      ta: false,
      timestamp: Date.now(),
    } as any;

    const seg0 = {
      ...baseGroup,
      blocks: [
        { data: 0x1234 },
        { data: 0x0000 | 0x0 },
        { data: 0x0000 },
        { data: ("A".charCodeAt(0) << 8) | "B".charCodeAt(0) },
      ],
    };
    const seg1 = {
      ...baseGroup,
      blocks: [
        { data: 0x1234 },
        { data: 0x0000 | 0x1 },
        { data: 0x0000 },
        { data: ("C".charCodeAt(0) << 8) | "D".charCodeAt(0) },
      ],
    };
    const seg2 = {
      ...baseGroup,
      blocks: [
        { data: 0x1234 },
        { data: 0x0000 | 0x2 },
        { data: 0x0000 },
        { data: ("E".charCodeAt(0) << 8) | "F".charCodeAt(0) },
      ],
    };
    const seg3 = {
      ...baseGroup,
      blocks: [
        { data: 0x1234 },
        { data: 0x0000 | 0x3 },
        { data: 0x0000 },
        { data: ("\u00C3".charCodeAt(0) << 8) | "G".charCodeAt(0) },
      ],
    };

    dec.parseGroup0(seg0 as any);
    dec.parseGroup0(seg1 as any);
    dec.parseGroup0(seg2 as any);
    dec.parseGroup0(seg3 as any);
    expect(spyWarn).toHaveBeenCalled();
    spyWarn.mockRestore();
  });
});
