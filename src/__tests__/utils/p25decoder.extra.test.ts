import * as decoder from "../../utils/p25decoder";

describe("p25decoder extras", () => {
  test("extractTalkgroupInfo parses GVCHU format with talkgroup and source", () => {
    // lcwFormat = 0x00 (Group Voice)
    const lcwFormat = 0x00;
    const talkgroupId = 0x1234; // 16 bits
    const sourceId = 0x00abcd; // 24 bits (example)

    // Build bits: [format(8)] [talkgroup(16)] [source(24)]
    const bits: number[] = [];
    for (let i = 7; i >= 0; i--) bits.push((lcwFormat >> i) & 1);
    for (let i = 15; i >= 0; i--) bits.push((talkgroupId >> i) & 1);
    for (let i = 23; i >= 0; i--) bits.push((sourceId >> i) & 1);

    const info = decoder.extractTalkgroupInfo(bits);
    expect(info.talkgroupId).toBe(talkgroupId);
    expect(info.sourceId).toBe(sourceId);
  });

  test("extractTalkgroupInfo returns empty for non-group voice format", () => {
    // lcwFormat = 0x03 (Unit to Unit), should be ignored
    const lcwFormat = 0x03;
    const bits: number[] = [];
    for (let i = 7; i >= 0; i--) bits.push((lcwFormat >> i) & 1);
    // Fill remaining with zeros to satisfy length
    while (bits.length < 48) bits.push(0);

    const info = decoder.extractTalkgroupInfo(bits);
    expect(info).toEqual({});
  });

  test("decodeP25Phase2WithLogging returns decoded result for empty input", async () => {
    const result = await decoder.decodeP25Phase2WithLogging([], undefined, {});
    expect(result).toEqual(
      expect.objectContaining({ frames: expect.any(Array), isEncrypted: false })
    );
  });

  test("getFrameDescription returns a readable string", () => {
    const frame: decoder.P25Frame = {
      slot: decoder.P25TDMASlot.SLOT_2,
      symbols: [decoder.P25Symbol.SYMBOL_01],
      bits: [0, 1],
      timestamp: Date.now(),
      signalQuality: 70,
      isValid: true,
    };
    const desc = decoder.getFrameDescription(frame);
    expect(desc).toContain("P25 Phase 2");
    expect(desc).toContain("Slot 2");
  });
});
