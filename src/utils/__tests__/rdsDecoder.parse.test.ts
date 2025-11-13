import { createRDSDecoder } from "../rdsDecoder";
import type { RDSBlock, RDSGroup } from "../../models/RDSData";

describe("rdsDecoder parseGroup0 / parseGroup2", () => {
  it("parses Program Service (PS) across segments", () => {
    const dec = createRDSDecoder(228000) as any;

    // Helper to create block-like object
    const makeBlock = (data: number): RDSBlock => ({
      data,
      checkword: 0,
      offsetWord: "",
      valid: true,
      corrected: false,
    });

    const makeGroup = (
      groupType: number,
      version: "A" | "B",
      seg: number,
      dataForBlock3: number,
    ): RDSGroup => {
      const blocks: [RDSBlock, RDSBlock, RDSBlock, RDSBlock] = [
        makeBlock(0x1234),
        makeBlock((groupType << 12) | (version === "B" ? 0x800 : 0) | seg),
        makeBlock(0),
        makeBlock(dataForBlock3),
      ];
      return {
        blocks,
        groupType: (groupType === 0
          ? version === "A"
            ? "0A"
            : "0B"
          : "UNKNOWN") as any,
        version,
        pi: 0x1234,
        pty: 0,
        tp: false,
        ta: false,
        timestamp: Date.now(),
      } as RDSGroup;
    };

    // PS "RADIOFM " (8 chars) split across 4 segments:
    // seg0: 'RA', seg1: 'DI', seg2: 'OF', seg3: 'M '
    dec.parseGroup0(
      makeGroup(0, "A", 0, ("R".charCodeAt(0) << 8) | "A".charCodeAt(0)),
    );
    dec.parseGroup0(
      makeGroup(0, "A", 1, ("D".charCodeAt(0) << 8) | "I".charCodeAt(0)),
    );
    dec.parseGroup0(
      makeGroup(0, "A", 2, ("O".charCodeAt(0) << 8) | "F".charCodeAt(0)),
    );
    dec.parseGroup0(
      makeGroup(0, "A", 3, ("M".charCodeAt(0) << 8) | " ".charCodeAt(0)),
    );

    const stationData = dec.getStationData();
    expect(stationData.ps).toBe("RADIOFM");
  });

  it("parses Radio Text (RT) across segments and handles \r correctly", () => {
    const dec = createRDSDecoder(228000) as any;

    const makeBlock = (data: number): RDSBlock => ({
      data,
      checkword: 0,
      offsetWord: "",
      valid: true,
      corrected: false,
    });

    const makeGroup = (
      groupType: number,
      version: "A" | "B",
      seg: number,
      block2: number,
      block3: number,
    ) => {
      const blocks: [RDSBlock, RDSBlock, RDSBlock, RDSBlock] = [
        makeBlock(0x1234),
        makeBlock((groupType << 12) | (version === "B" ? 0x800 : 0) | seg),
        makeBlock(block2),
        makeBlock(block3),
      ];
      return {
        blocks,
        groupType: (groupType === 2
          ? version === "A"
            ? "2A"
            : "2B"
          : "UNKNOWN") as any,
        version,
        pi: 0x1234,
        pty: 0,
        tp: false,
        ta: false,
        timestamp: Date.now(),
      } as RDSGroup;
    };

    // RT "HELLO" -> segment 0: 'HELL', segment 1: 'O' + '\r' to end
    dec.parseGroup2(
      makeGroup(
        2,
        "A",
        0,
        ("H".charCodeAt(0) << 8) | "E".charCodeAt(0),
        ("L".charCodeAt(0) << 8) | "L".charCodeAt(0),
      ),
    );
    dec.parseGroup2(
      makeGroup(2, "A", 1, ("O".charCodeAt(0) << 8) | "\r".charCodeAt(0), 0),
    );

    const stationData = dec.getStationData();
    expect(stationData.rt).toBe("HELLO");
  });
});
