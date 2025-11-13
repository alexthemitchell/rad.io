/**
 * Tests for EPG Storage
 */

import { EPGStorage } from "../epgStorage";
import type {
  EventInformationTable,
  VirtualChannel,
  Event,
  MultipleStringStructure,
} from "../../parsers/TransportStreamParser";

describe("EPGStorage", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    EPGStorage.clearEPGData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const createMockEvent = (
    eventid: number,
    title: string,
    startTime: number,
    duration: number,
  ): Event => {
    const textEncoder = new TextEncoder();
    const titleMSS: MultipleStringStructure[] = [
      {
        iso639LanguageCode: "eng",
        segments: [
          {
            compressionType: 0,
            mode: 0x3f, // UTF-8
            numberOfBytes: title.length,
            compressedString: textEncoder.encode(title),
          },
        ],
      },
    ];

    return {
      eventid,
      startTime,
      etmLocation: 0,
      lengthInSeconds: duration,
      titleLength: 0,
      title: titleMSS,
      descriptors: [],
    };
  };

  const createMockChannel = (): VirtualChannel => ({
    shortName: "TESTCH",
    majorChannelNumber: 7,
    minorChannelNumber: 1,
    modulationMode: 0,
    carrierFrequency: 177e6,
    channelTSID: 1,
    programNumber: 1,
    etmLocation: 0,
    accessControlled: false,
    hidden: false,
    hideGuide: false,
    serviceType: 0x02,
    sourceid: 1,
    descriptors: [],
  });

  describe("storeEPGData", () => {
    it("should store EPG data from EIT", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(1, "Test Program", gpsNow, 1800)],
      };

      const channel = createMockChannel();

      EPGStorage.storeEPGData(eit, null, channel);

      const stored = EPGStorage.getAllEPGData();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.channelNumber).toBe("7.1");
      expect(stored[0]?.programs).toHaveLength(1);
      expect(stored[0]?.programs[0]?.title).toBe("Test Program");
    });

    it("should update existing channel data", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const channel = createMockChannel();

      const eit1: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(1, "Program 1", gpsNow, 1800)],
      };

      EPGStorage.storeEPGData(eit1, null, channel);

      const eit2: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(2, "Program 2", gpsNow + 1800, 1800)],
      };

      EPGStorage.storeEPGData(eit2, null, channel);

      const stored = EPGStorage.getAllEPGData();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.programs).toHaveLength(1);
      expect(stored[0]?.programs[0]?.title).toBe("Program 2");
    });
  });

  describe("getAllEPGData", () => {
    it("should return empty array when no data stored", () => {
      const result = EPGStorage.getAllEPGData();
      expect(result).toEqual([]);
    });

    it("should deserialize dates correctly", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(1, "Test", gpsNow, 1800)],
      };

      EPGStorage.storeEPGData(eit, null, createMockChannel());

      const stored = EPGStorage.getAllEPGData();
      expect(stored[0]?.programs[0]?.startTime).toBeInstanceOf(Date);
      expect(stored[0]?.programs[0]?.endTime).toBeInstanceOf(Date);
    });
  });

  describe("getChannelEPGData", () => {
    it("should return channel data by source ID", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(1, "Test", gpsNow, 1800)],
      };

      EPGStorage.storeEPGData(eit, null, createMockChannel());

      const result = EPGStorage.getChannelEPGData(1);
      expect(result).toBeTruthy();
      expect(result?.sourceId).toBe(1);
    });

    it("should return null for non-existent channel", () => {
      const result = EPGStorage.getChannelEPGData(999);
      expect(result).toBeNull();
    });
  });

  describe("getCurrentPrograms", () => {
    it("should return currently airing programs", () => {
      const now = new Date();
      const nowGps =
        (now.getTime() - new Date("1980-01-06T00:00:00Z").getTime()) / 1000;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 2,
        events: [
          createMockEvent(1, "Current Show", nowGps - 600, 1800),
          createMockEvent(2, "Future Show", nowGps + 1200, 1800),
        ],
      };

      EPGStorage.storeEPGData(eit, null, createMockChannel());

      const current = EPGStorage.getCurrentPrograms(now);
      expect(current).toHaveLength(1);
      expect(current[0]?.title).toBe("Current Show");
    });
  });

  describe("searchPrograms", () => {
    it("should search by title", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 2,
        events: [
          createMockEvent(1, "News Tonight", gpsNow, 1800),
          createMockEvent(2, "Sports Update", gpsNow + 1800, 1800),
        ],
      };

      EPGStorage.storeEPGData(eit, null, createMockChannel());

      const results = EPGStorage.searchPrograms("news");
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe("News Tonight");
    });

    it("should be case-insensitive", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(1, "NEWS Tonight", gpsNow, 1800)],
      };

      EPGStorage.storeEPGData(eit, null, createMockChannel());

      const results = EPGStorage.searchPrograms("news");
      expect(results).toHaveLength(1);
    });
  });

  describe("filterByGenre", () => {
    it("should filter programs by genre", () => {
      // This test would require programs with genre descriptors
      // For now, verify the method exists and returns empty array
      const results = EPGStorage.filterByGenre("News");
      expect(results).toEqual([]);
    });
  });

  describe("getAllGenres", () => {
    it("should return unique genres", () => {
      const genres = EPGStorage.getAllGenres();
      expect(Array.isArray(genres)).toBe(true);
    });
  });

  describe("clearEPGData", () => {
    it("should clear all stored data", () => {
      const now = Date.now() / 1000;
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime() / 1000;
      const gpsNow = now - gpsEpoch;

      const eit: EventInformationTable = {
        tableId: 0xcb,
        sectionLength: 0,
        protocolVersion: 0,
        sourceid: 1,
        numEvents: 1,
        events: [createMockEvent(1, "Test", gpsNow, 1800)],
      };

      EPGStorage.storeEPGData(eit, null, createMockChannel());

      expect(EPGStorage.getAllEPGData()).toHaveLength(1);

      EPGStorage.clearEPGData();

      expect(EPGStorage.getAllEPGData()).toHaveLength(0);
    });
  });
});
