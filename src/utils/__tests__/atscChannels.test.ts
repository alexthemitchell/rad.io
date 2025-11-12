/**
 * Tests for ATSC channel frequency utilities
 */

import {
  ATSC_CHANNELS,
  ATSC_CONSTANTS,
  getATSCChannel,
  getATSCChannelByFrequency,
  getATSCChannelsByBand,
  getATSCFrequencyRange,
  isFrequencyInATSCChannel,
  formatATSCChannel,
  type ATSCChannel,
} from "../atscChannels";

describe("atscChannels", () => {
  describe("ATSC_CONSTANTS", () => {
    it("should have correct channel bandwidth", () => {
      expect(ATSC_CONSTANTS.CHANNEL_BANDWIDTH).toBe(6e6);
    });

    it("should have correct pilot offset", () => {
      expect(ATSC_CONSTANTS.PILOT_OFFSET).toBe(309440);
    });

    it("should have correct symbol rate", () => {
      expect(ATSC_CONSTANTS.SYMBOL_RATE).toBe(10.76e6);
    });
  });

  describe("ATSC_CHANNELS", () => {
    it("should contain channels 2-36 (post-repack)", () => {
      expect(ATSC_CHANNELS.length).toBe(35); // 5 VHF-Low + 7 VHF-High + 23 UHF
      expect(ATSC_CHANNELS[0]?.channel).toBe(2);
      expect(ATSC_CHANNELS[ATSC_CHANNELS.length - 1]?.channel).toBe(36);
    });

    it("should have correct VHF-Low channels (2-6)", () => {
      const vhfLow = ATSC_CHANNELS.filter((ch) => ch.band === "VHF-Low");
      expect(vhfLow.length).toBe(5);
      expect(vhfLow.map((ch) => ch.channel)).toEqual([2, 3, 4, 5, 6]);
    });

    it("should have correct VHF-High channels (7-13)", () => {
      const vhfHigh = ATSC_CHANNELS.filter((ch) => ch.band === "VHF-High");
      expect(vhfHigh.length).toBe(7);
      expect(vhfHigh.map((ch) => ch.channel)).toEqual([
        7, 8, 9, 10, 11, 12, 13,
      ]);
    });

    it("should have correct UHF channels (14-36)", () => {
      const uhf = ATSC_CHANNELS.filter((ch) => ch.band === "UHF");
      expect(uhf.length).toBe(23);
      expect(uhf[0]?.channel).toBe(14);
      expect(uhf[uhf.length - 1]?.channel).toBe(36);
    });

    it("should have correct channel spacing", () => {
      const channel2 = ATSC_CHANNELS.find((ch) => ch.channel === 2);
      expect(channel2?.frequency).toBe(57e6);
      expect(channel2?.lowerEdge).toBe(54e6);
      expect(channel2?.upperEdge).toBe(60e6);
    });

    it("should have correct pilot frequencies", () => {
      for (const channel of ATSC_CHANNELS) {
        const expectedPilot = channel.lowerEdge + ATSC_CONSTANTS.PILOT_OFFSET;
        expect(channel.pilotFrequency).toBeCloseTo(expectedPilot, 0);
      }
    });

    it("should have 6 MHz bandwidth for all channels", () => {
      for (const channel of ATSC_CHANNELS) {
        const bandwidth = channel.upperEdge - channel.lowerEdge;
        expect(bandwidth).toBe(ATSC_CONSTANTS.CHANNEL_BANDWIDTH);
      }
    });
  });

  describe("getATSCChannel", () => {
    it("should return channel by number", () => {
      const channel7 = getATSCChannel(7);
      expect(channel7).toBeDefined();
      expect(channel7?.channel).toBe(7);
      expect(channel7?.band).toBe("VHF-High");
    });

    it("should return undefined for invalid channel", () => {
      expect(getATSCChannel(1)).toBeUndefined();
      expect(getATSCChannel(37)).toBeUndefined();
      expect(getATSCChannel(100)).toBeUndefined();
    });

    it("should work for all valid channels", () => {
      for (let ch = 2; ch <= 36; ch++) {
        const channel = getATSCChannel(ch);
        expect(channel).toBeDefined();
        expect(channel?.channel).toBe(ch);
      }
    });
  });

  describe("getATSCChannelByFrequency", () => {
    it("should find channel by center frequency", () => {
      const channel = getATSCChannelByFrequency(57e6); // Channel 2
      expect(channel?.channel).toBe(2);
    });

    it("should find channel by frequency within bandwidth", () => {
      const channel = getATSCChannelByFrequency(56e6); // Within channel 2
      expect(channel?.channel).toBe(2);
    });

    it("should return undefined for frequency outside all channels", () => {
      expect(getATSCChannelByFrequency(50e6)).toBeUndefined(); // Below channel 2
      expect(getATSCChannelByFrequency(620e6)).toBeUndefined(); // Above channel 36
    });

    it("should return undefined for frequency in gaps between channels", () => {
      // Gap between channel 6 (85 MHz) and channel 7 (177 MHz)
      expect(getATSCChannelByFrequency(130e6)).toBeUndefined();
    });

    it("should find UHF channels correctly", () => {
      const channel14 = getATSCChannelByFrequency(473e6);
      expect(channel14?.channel).toBe(14);
      expect(channel14?.band).toBe("UHF");
    });
  });

  describe("getATSCChannelsByBand", () => {
    it("should return all VHF-Low channels", () => {
      const channels = getATSCChannelsByBand("VHF-Low");
      expect(channels.length).toBe(5);
      expect(channels.every((ch) => ch.band === "VHF-Low")).toBe(true);
    });

    it("should return all VHF-High channels", () => {
      const channels = getATSCChannelsByBand("VHF-High");
      expect(channels.length).toBe(7);
      expect(channels.every((ch) => ch.band === "VHF-High")).toBe(true);
    });

    it("should return all UHF channels", () => {
      const channels = getATSCChannelsByBand("UHF");
      expect(channels.length).toBe(23);
      expect(channels.every((ch) => ch.band === "UHF")).toBe(true);
    });
  });

  describe("getATSCFrequencyRange", () => {
    it("should return correct min frequency", () => {
      const range = getATSCFrequencyRange();
      expect(range.min).toBe(54e6); // Channel 2 lower edge
    });

    it("should return correct max frequency", () => {
      const range = getATSCFrequencyRange();
      expect(range.max).toBe(608e6); // Channel 36 upper edge (post-repack)
    });
  });

  describe("isFrequencyInATSCChannel", () => {
    it("should return true for frequency within a channel", () => {
      expect(isFrequencyInATSCChannel(57e6)).toBe(true); // Channel 2 center
      expect(isFrequencyInATSCChannel(177e6)).toBe(true); // Channel 7 center
      expect(isFrequencyInATSCChannel(473e6)).toBe(true); // Channel 14 center
    });

    it("should return false for frequency outside all channels", () => {
      expect(isFrequencyInATSCChannel(50e6)).toBe(false);
      expect(isFrequencyInATSCChannel(130e6)).toBe(false);
      expect(isFrequencyInATSCChannel(620e6)).toBe(false);
    });
  });

  describe("formatATSCChannel", () => {
    it("should format VHF-Low channel correctly", () => {
      const channel = getATSCChannel(2);
      expect(channel).toBeDefined();
      const formatted = formatATSCChannel(channel as ATSCChannel);
      expect(formatted).toBe("Ch 2 (57.0 MHz, VHF-Low)");
    });

    it("should format VHF-High channel correctly", () => {
      const channel = getATSCChannel(7);
      expect(channel).toBeDefined();
      const formatted = formatATSCChannel(channel as ATSCChannel);
      expect(formatted).toBe("Ch 7 (177.0 MHz, VHF-High)");
    });

    it("should format UHF channel correctly", () => {
      const channel = getATSCChannel(14);
      expect(channel).toBeDefined();
      const formatted = formatATSCChannel(channel as ATSCChannel);
      expect(formatted).toContain("Ch 14");
      expect(formatted).toContain("UHF");
    });
  });

  describe("Channel continuity", () => {
    it("should not have overlapping channels", () => {
      for (let i = 0; i < ATSC_CHANNELS.length - 1; i++) {
        const current = ATSC_CHANNELS[i];
        const next = ATSC_CHANNELS[i + 1];
        if (current && next && current.band === next.band) {
          expect(current.upperEdge).toBeLessThanOrEqual(next.lowerEdge);
        }
      }
    });

    it("should have channels in ascending frequency order", () => {
      for (let i = 0; i < ATSC_CHANNELS.length - 1; i++) {
        const current = ATSC_CHANNELS[i];
        const next = ATSC_CHANNELS[i + 1];
        if (current && next) {
          expect(current.frequency).toBeLessThan(next.frequency);
        }
      }
    });
  });
});
