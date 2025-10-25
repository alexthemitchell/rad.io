/**
 * Measurement Logger Tests
 */

import { MeasurementLogger } from "../measurement-logger";
import type { MeasurementLogEntry } from "../types";

describe("MeasurementLogger", () => {
  let logger: MeasurementLogger;

  beforeEach(() => {
    logger = new MeasurementLogger();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("addEntry", () => {
    it("should add a measurement entry", () => {
      const entry = logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        frequency: 100e6,
        data: { power: -40 },
      });

      expect(entry.id).toBeDefined();
      expect(entry.measurementType).toBe("marker");
      expect(entry.frequency).toBe(100e6);
    });

    it("should auto-generate unique IDs", () => {
      const entry1 = logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      const entry2 = logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      expect(entry1.id).not.toBe(entry2.id);
    });

    it("should enforce max entries limit", () => {
      const smallLogger = new MeasurementLogger(5);

      for (let i = 0; i < 10; i++) {
        smallLogger.addEntry({
          timestamp: Date.now(),
          measurementType: "marker",
          data: { index: i },
        });
      }

      const entries = smallLogger.getAllEntries();
      expect(entries.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getEntry", () => {
    it("should retrieve entry by ID", () => {
      const entry = logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { test: true },
      });

      const retrieved = logger.getEntry(entry.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(entry.id);
    });

    it("should return undefined for non-existent ID", () => {
      const retrieved = logger.getEntry("nonexistent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("getAllEntries", () => {
    it("should return all entries sorted by timestamp", () => {
      const now = Date.now();

      logger.addEntry({
        timestamp: now,
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: now + 1000,
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: now + 2000,
        measurementType: "marker",
        data: {},
      });

      const entries = logger.getAllEntries();
      expect(entries).toHaveLength(3);

      // Should be sorted descending (newest first)
      expect(entries[0]?.timestamp).toBeGreaterThan(
        entries[1]?.timestamp ?? 0,
      );
    });

    it("should return empty array when no entries", () => {
      const entries = logger.getAllEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe("getEntriesByType", () => {
    it("should filter entries by type", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "channel_power",
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      const markerEntries =
        logger.getEntriesByType("marker");
      expect(markerEntries).toHaveLength(2);

      const powerEntries =
        logger.getEntriesByType("channel_power");
      expect(powerEntries).toHaveLength(1);
    });
  });

  describe("getEntriesByTag", () => {
    it("should filter entries by tag", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        tags: ["test", "important"],
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        tags: ["test"],
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        tags: ["other"],
        data: {},
      });

      const testEntries = logger.getEntriesByTag("test");
      expect(testEntries).toHaveLength(2);

      const importantEntries =
        logger.getEntriesByTag("important");
      expect(importantEntries).toHaveLength(1);
    });
  });

  describe("getEntriesInRange", () => {
    it("should filter entries by time range", () => {
      const now = Date.now();

      logger.addEntry({
        timestamp: now - 3000,
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: now - 1000,
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: now,
        measurementType: "marker",
        data: {},
      });

      const entries = logger.getEntriesInRange(
        now - 2000,
        now,
      );
      expect(entries).toHaveLength(2);
    });
  });

  describe("getEntriesByFrequency", () => {
    it("should filter entries by frequency with tolerance", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        frequency: 100e6,
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        frequency: 100.0005e6, // 500 Hz offset
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        frequency: 100.002e6, // 2 kHz offset
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        frequency: 200e6, // Way off
        data: {},
      });

      const entries = logger.getEntriesByFrequency(
        100e6,
        1000,
      ); // 1 kHz tolerance
      expect(entries).toHaveLength(2); // First two entries
    });

    it("should exclude entries without frequency", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      const entries = logger.getEntriesByFrequency(100e6);
      expect(entries).toHaveLength(0);
    });
  });

  describe("deleteEntry", () => {
    it("should delete entry by ID", () => {
      const entry = logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      const deleted = logger.deleteEntry(entry.id);
      expect(deleted).toBe(true);
      expect(logger.getEntry(entry.id)).toBeUndefined();
    });

    it("should return false for non-existent ID", () => {
      const deleted = logger.deleteEntry("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("clearAll", () => {
    it("should remove all entries", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      logger.clearAll();
      expect(logger.getAllEntries()).toHaveLength(0);
    });
  });

  describe("calculateStatistics", () => {
    it("should calculate statistics for numeric field", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { power: -40 },
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { power: -30 },
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { power: -35 },
      });

      const entries = logger.getAllEntries();
      const stats = logger.calculateStatistics(entries, "power");

      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(3);
      expect(stats?.min).toBe(-40);
      expect(stats?.max).toBe(-30);
      expect(stats?.mean).toBeCloseTo(-35, 0);
    });

    it("should handle nested field paths", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { signal: { snr: 20 } },
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { signal: { snr: 25 } },
      });

      const entries = logger.getAllEntries();
      const stats = logger.calculateStatistics(
        entries,
        "signal.snr",
      );

      expect(stats).not.toBeNull();
      expect(stats?.min).toBe(20);
      expect(stats?.max).toBe(25);
    });

    it("should return null for empty entries", () => {
      const stats = logger.calculateStatistics([], "power");
      expect(stats).toBeNull();
    });

    it("should calculate median correctly", () => {
      for (let i = 1; i <= 5; i++) {
        logger.addEntry({
          timestamp: Date.now(),
          measurementType: "marker",
          data: { value: i * 10 },
        });
      }

      const entries = logger.getAllEntries();
      const stats = logger.calculateStatistics(entries, "value");

      expect(stats?.median).toBe(30); // Middle value
    });

    it("should calculate standard deviation", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { value: 10 },
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { value: 20 },
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { value: 30 },
      });

      const entries = logger.getAllEntries();
      const stats = logger.calculateStatistics(entries, "value");

      expect(stats?.stdDev).toBeGreaterThan(0);
      expect(stats?.variance).toBeGreaterThan(0);
    });
  });

  describe("exportToCSV", () => {
    it("should export entries to CSV format", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        frequency: 100e6,
        notes: "Test entry",
        tags: ["test"],
        data: { power: -40 },
      });

      const csv = logger.exportToCSV();
      expect(csv).toContain("ID");
      expect(csv).toContain("Timestamp");
      expect(csv).toContain("marker");
      expect(csv).toContain("100000000");
    });

    it("should handle empty log", () => {
      const csv = logger.exportToCSV();
      expect(csv).toBe("");
    });

    it("should escape CSV special characters", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        notes: 'Test, with "quotes" and comma',
        data: {},
      });

      const csv = logger.exportToCSV();
      expect(csv).toContain('"');
    });
  });

  describe("exportToJSON", () => {
    it("should export entries to JSON format", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { test: true },
      });

      const json = logger.exportToJSON();
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json) as MeasurementLogEntry[];
      expect(parsed).toHaveLength(1);
    });
  });

  describe("importFromJSON", () => {
    it("should import entries from JSON", () => {
      const entry: MeasurementLogEntry = {
        id: "test-1",
        timestamp: Date.now(),
        measurementType: "marker",
        data: { test: true },
      };

      const json = JSON.stringify([entry]);
      const imported = logger.importFromJSON(json);

      expect(imported).toBe(true);
      expect(logger.getEntry("test-1")).toBeDefined();
    });

    it("should handle invalid JSON", () => {
      const imported = logger.importFromJSON("invalid json");
      expect(imported).toBe(false);
    });
  });

  describe("getLogSize", () => {
    it("should return log size in bytes", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      const size = logger.getLogSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("getEntryCount", () => {
    it("should return number of entries", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: {},
      });

      expect(logger.getEntryCount()).toBe(2);
    });
  });

  describe("persistence", () => {
    it("should persist log to localStorage", () => {
      logger.addEntry({
        timestamp: Date.now(),
        measurementType: "marker",
        data: { test: true },
      });

      // Create new logger to test persistence
      const newLogger = new MeasurementLogger();
      const entries = newLogger.getAllEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]?.data).toEqual({ test: true });
    });
  });
});
