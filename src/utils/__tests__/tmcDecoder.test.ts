/**
 * Tests for TMC (Traffic Message Channel) Decoder
 */

import { createRDSDecoder } from "../rdsDecoder";
import {
  TMCEventCategory,
  TMCEventSeverity,
  TMCDirection,
  TMCDuration,
  TMCExtent,
  getEventInfo,
  formatDuration,
  formatExtent,
  formatDirection,
  getSeverityColor,
} from "../../models/TMCData";

describe("TMC Data Model", () => {
  describe("Event Info", () => {
    it("should return traffic congestion info for event code 1", () => {
      const info = getEventInfo(1);
      expect(info.text).toBe("Traffic congestion");
      expect(info.category).toBe(TMCEventCategory.TRAFFIC_JAM);
      expect(info.severity).toBe(TMCEventSeverity.MODERATE);
    });

    it("should return accident info for event code 101", () => {
      const info = getEventInfo(101);
      expect(info.text).toBe("Accident");
      expect(info.category).toBe(TMCEventCategory.ACCIDENT);
      expect(info.severity).toBe(TMCEventSeverity.SEVERE);
    });

    it("should return unknown for invalid event code", () => {
      const info = getEventInfo(9999);
      expect(info.text).toContain("Unknown");
      expect(info.category).toBe(TMCEventCategory.OTHER);
      expect(info.severity).toBe(TMCEventSeverity.NONE);
    });
  });

  describe("Duration Formatting", () => {
    it("should format duration codes correctly", () => {
      expect(formatDuration(TMCDuration.NO_DURATION)).toBe("Duration unknown");
      expect(formatDuration(TMCDuration.MINUTES_15)).toBe("~15 minutes");
      expect(formatDuration(TMCDuration.HOUR_1)).toBe("~1 hour");
      expect(formatDuration(TMCDuration.LONGER_THAN_8_HOURS)).toBe(">8 hours");
    });
  });

  describe("Extent Formatting", () => {
    it("should format extent codes correctly", () => {
      expect(formatExtent(TMCExtent.LOCATION_ONLY)).toBe("At location");
      expect(formatExtent(TMCExtent.PLUS_1_LOCATION)).toBe("+1 location");
      expect(formatExtent(TMCExtent.PLUS_7_OR_MORE)).toBe(
        "+7 or more locations",
      );
    });
  });

  describe("Direction Formatting", () => {
    it("should format direction codes correctly", () => {
      expect(formatDirection(TMCDirection.POSITIVE)).toBe("Positive direction");
      expect(formatDirection(TMCDirection.NEGATIVE)).toBe("Negative direction");
      expect(formatDirection(TMCDirection.BOTH)).toBe("Both directions");
    });
  });

  describe("Severity Colors", () => {
    it("should return correct colors for severity levels", () => {
      expect(getSeverityColor(TMCEventSeverity.NONE)).toBe("#888");
      expect(getSeverityColor(TMCEventSeverity.MINOR)).toBe("#3498db");
      expect(getSeverityColor(TMCEventSeverity.MODERATE)).toBe("#f39c12");
      expect(getSeverityColor(TMCEventSeverity.SEVERE)).toBe("#e74c3c");
      expect(getSeverityColor(TMCEventSeverity.CRITICAL)).toBe("#c0392b");
    });
  });
});

describe("TMC Decoder Integration", () => {
  describe("Initialization", () => {
    it("should initialize with empty TMC stats", () => {
      const decoder = createRDSDecoder(228000);
      const stats = decoder.getTMCStats();

      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesActive).toBe(0);
      expect(stats.group8ACount).toBe(0);
      expect(stats.parseErrors).toBe(0);
    });

    it("should initialize with no TMC messages", () => {
      const decoder = createRDSDecoder(228000);
      const messages = decoder.getTMCMessages();

      expect(messages).toHaveLength(0);
    });
  });

  describe("Reset", () => {
    it("should clear TMC messages on reset", () => {
      const decoder = createRDSDecoder(228000);
      
      // Reset should clear all state
      decoder.reset();
      
      const messages = decoder.getTMCMessages();
      const stats = decoder.getTMCStats();

      expect(messages).toHaveLength(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesActive).toBe(0);
    });
  });

  describe("Message Retrieval", () => {
    it("should return sorted messages by severity", () => {
      const decoder = createRDSDecoder(228000);
      const messages = decoder.getTMCMessages();

      // Messages should be sorted (most severe first)
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i - 1]!.severity).toBeGreaterThanOrEqual(
          messages[i]!.severity,
        );
      }
    });

    it("should clean up expired messages", () => {
      const decoder = createRDSDecoder(228000);
      
      // Get messages (should trigger cleanup)
      const messages = decoder.getTMCMessages();
      
      // Should only return non-expired messages
      const now = Date.now();
      for (const message of messages) {
        if (message.expiresAt !== null) {
          expect(message.expiresAt).toBeGreaterThanOrEqual(now);
        }
      }
    });
  });

  describe("Statistics", () => {
    it("should track TMC statistics correctly", () => {
      const decoder = createRDSDecoder(228000);
      const stats = decoder.getTMCStats();

      // Initial stats should be zero
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesActive).toBe(0);
      expect(stats.group8ACount).toBe(0);
      expect(stats.parseErrors).toBe(0);
      expect(stats.lastMessageAt).toBe(0);
    });
  });
});

describe("TMC Event Categories", () => {
  it("should have traffic jam events", () => {
    const info = getEventInfo(1);
    expect(info.category).toBe(TMCEventCategory.TRAFFIC_JAM);
  });

  it("should have accident events", () => {
    const info = getEventInfo(101);
    expect(info.category).toBe(TMCEventCategory.ACCIDENT);
  });

  it("should have roadworks events", () => {
    const info = getEventInfo(201);
    expect(info.category).toBe(TMCEventCategory.ROADWORKS);
  });

  it("should have weather events", () => {
    const info = getEventInfo(301);
    expect(info.category).toBe(TMCEventCategory.WEATHER);
  });

  it("should have road closure events", () => {
    const info = getEventInfo(401);
    expect(info.category).toBe(TMCEventCategory.ROAD_CLOSURE);
  });
});

describe("TMC Severity Levels", () => {
  it("should classify critical events correctly", () => {
    const info = getEventInfo(102); // Serious accident
    expect(info.severity).toBe(TMCEventSeverity.CRITICAL);
  });

  it("should classify severe events correctly", () => {
    const info = getEventInfo(101); // Accident
    expect(info.severity).toBe(TMCEventSeverity.SEVERE);
  });

  it("should classify moderate events correctly", () => {
    const info = getEventInfo(1); // Traffic congestion
    expect(info.severity).toBe(TMCEventSeverity.MODERATE);
  });

  it("should classify minor events correctly", () => {
    const info = getEventInfo(2); // Queue forming
    expect(info.severity).toBe(TMCEventSeverity.MINOR);
  });
});
