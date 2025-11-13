/**
 * Tests for PSIP Text Decoder
 */

import {
  decodeMultipleStringStructure,
  gpsTimeToDate,
  formatDuration,
  getTimeSlot,
  CompressionType,
  TextMode,
} from "../psipTextDecoder";
import type {
  MultipleStringStructure,
  StringSegment,
} from "../../parsers/TransportStreamParser";

describe("psipTextDecoder", () => {
  describe("decodeMultipleStringStructure", () => {
    it("should decode UTF-8 text", () => {
      const textEncoder = new TextEncoder();
      const segment: StringSegment = {
        compressionType: CompressionType.NO_COMPRESSION,
        mode: TextMode.UNICODE_UTF8,
        numberOfBytes: 11,
        compressedString: textEncoder.encode("Hello World"),
      };

      const mss: MultipleStringStructure[] = [
        {
          iso639LanguageCode: "eng",
          segments: [segment],
        },
      ];

      const result = decodeMultipleStringStructure(mss);
      expect(result).toBe("Hello World");
    });

    it("should prefer specified language", () => {
      const textEncoder = new TextEncoder();
      const engSegment: StringSegment = {
        compressionType: CompressionType.NO_COMPRESSION,
        mode: TextMode.UNICODE_UTF8,
        numberOfBytes: 7,
        compressedString: textEncoder.encode("English"),
      };

      const spaSegment: StringSegment = {
        compressionType: CompressionType.NO_COMPRESSION,
        mode: TextMode.UNICODE_UTF8,
        numberOfBytes: 7,
        compressedString: textEncoder.encode("Spanish"),
      };

      const mss: MultipleStringStructure[] = [
        {
          iso639LanguageCode: "eng",
          segments: [engSegment],
        },
        {
          iso639LanguageCode: "spa",
          segments: [spaSegment],
        },
      ];

      const result = decodeMultipleStringStructure(mss, "spa");
      expect(result).toBe("Spanish");
    });

    it("should handle empty input", () => {
      const result = decodeMultipleStringStructure([]);
      expect(result).toBe("");
    });

    it("should concatenate multiple segments", () => {
      const textEncoder = new TextEncoder();
      const segment1: StringSegment = {
        compressionType: CompressionType.NO_COMPRESSION,
        mode: TextMode.UNICODE_UTF8,
        numberOfBytes: 6,
        compressedString: textEncoder.encode("Hello "),
      };

      const segment2: StringSegment = {
        compressionType: CompressionType.NO_COMPRESSION,
        mode: TextMode.UNICODE_UTF8,
        numberOfBytes: 5,
        compressedString: textEncoder.encode("World"),
      };

      const mss: MultipleStringStructure[] = [
        {
          iso639LanguageCode: "eng",
          segments: [segment1, segment2],
        },
      ];

      const result = decodeMultipleStringStructure(mss);
      expect(result).toBe("HelloWorld");
    });
  });

  describe("gpsTimeToDate", () => {
    it("should convert GPS seconds to Date", () => {
      // GPS epoch is January 6, 1980 00:00:00 UTC
      const result = gpsTimeToDate(0);
      expect(result.toISOString()).toBe("1980-01-06T00:00:00.000Z");
    });

    it("should handle positive GPS time", () => {
      // One day after GPS epoch
      const oneDaySeconds = 24 * 60 * 60;
      const result = gpsTimeToDate(oneDaySeconds);
      expect(result.toISOString()).toBe("1980-01-07T00:00:00.000Z");
    });
  });

  describe("formatDuration", () => {
    it("should format hours and minutes", () => {
      const result = formatDuration(5400); // 1.5 hours
      expect(result).toBe("1h 30m");
    });

    it("should format minutes only", () => {
      const result = formatDuration(1800); // 30 minutes
      expect(result).toBe("30m");
    });

    it("should format seconds only", () => {
      const result = formatDuration(45);
      expect(result).toBe("45s");
    });

    it("should handle zero duration", () => {
      const result = formatDuration(0);
      expect(result).toBe("0s");
    });

    it("should handle negative duration", () => {
      const result = formatDuration(-100);
      expect(result).toBe("Unknown");
    });
  });

  describe("getTimeSlot", () => {
    it("should calculate correct time slot index", () => {
      const timestamp = new Date("2025-01-01T14:30:00");
      const { index, timeString } = getTimeSlot(timestamp, 30);

      expect(index).toBe(29); // (14 * 60 + 30) / 30 = 29
      expect(timeString).toMatch(/2:30/);
    });

    it("should handle different slot durations", () => {
      const timestamp = new Date("2025-01-01T15:45:00");
      const { index } = getTimeSlot(timestamp, 15);

      expect(index).toBe(63); // (15 * 60 + 45) / 15 = 63
    });
  });
});
