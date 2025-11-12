import { createRDSDecoder } from "../rdsDecoder";

describe("rdsDecoder effect mask mapping for single-bit correction", () => {
  it("precomputes effect mask and uses it to correct a single-bit error", () => {
    const dec = createRDSDecoder(228000) as any;
    // Create a data block with PI as known data and checkword computed for OFFSET_WORDS.A
    // Create a checkword by computing syndrome for A and then checkword as per existing table
    // For the test, we directly extract effect mask for a bit and verify mapping exists
    const effectMap = dec.effectMaskToBit as Map<number, number>;
    expect(effectMap.size).toBeGreaterThan(0);

    // Choose a random entry from map to test
    const firstResult = effectMap.entries().next();
    expect(firstResult.done).toBe(false);
    const firstEntry = firstResult.value as [number, number];
    const [mask, pos] = firstEntry;
    expect(typeof mask).toBe("number");
    expect(typeof pos).toBe("number");

    // Construct block bits with base syndrome and expectedVal such that delta = mask
    // We can simulate this by setting expectedVal = baseSyndrome ^ mask
    const baseBits: number[] = new Array(26).fill(0);
    // Use dec.decodeBlock to generate base data/checkword for a simple block
    const block = dec.decodeBlock(baseBits);
    const baseS = dec.calculateSyndrome(block.data, block.checkword);
    const expected = baseS ^ mask;

    // Now use trySingleBitCorrection to find corrected bits
    const corrected = dec.trySingleBitCorrection(baseBits, expected);
    expect(corrected).toBeDefined();
    // Ensure corrected bit is toggled at pos
    expect(corrected[pos]).toBe(1);
  });
});
