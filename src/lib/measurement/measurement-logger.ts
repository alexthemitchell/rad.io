/**
 * Measurement Logger
 * Logs and manages measurement history
 */

import type {
  MeasurementLogEntry,
  MeasurementStatistics,
} from "./types";

/**
 * Logs and manages measurement history
 */
export class MeasurementLogger {
  private entries = new Map<string, MeasurementLogEntry>();
  private maxEntries = 10000;
  private storageKey = "rad.io:measurement-log";

  constructor(maxEntries?: number) {
    if (maxEntries) {
      this.maxEntries = maxEntries;
    }
    this.loadFromStorage();
  }

  /**
   * Add a measurement log entry
   */
  addEntry(
    entry: Omit<MeasurementLogEntry, "id">,
  ): MeasurementLogEntry {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const fullEntry: MeasurementLogEntry = {
      id,
      ...entry,
    };

    this.entries.set(id, fullEntry);

    // Enforce max entries limit
    if (this.entries.size > this.maxEntries) {
      this.pruneOldEntries();
    }

    this.saveToStorage();
    return fullEntry;
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): MeasurementLogEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all entries
   */
  getAllEntries(): MeasurementLogEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }

  /**
   * Get entries filtered by type
   */
  getEntriesByType(
    type: MeasurementLogEntry["measurementType"],
  ): MeasurementLogEntry[] {
    return this.getAllEntries().filter(
      (e) => e.measurementType === type,
    );
  }

  /**
   * Get entries filtered by tag
   */
  getEntriesByTag(tag: string): MeasurementLogEntry[] {
    return this.getAllEntries().filter((e) =>
      e.tags?.includes(tag),
    );
  }

  /**
   * Get entries within a time range
   */
  getEntriesInRange(
    startTime: number,
    endTime: number,
  ): MeasurementLogEntry[] {
    return this.getAllEntries().filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );
  }

  /**
   * Get entries for a specific frequency (with tolerance)
   */
  getEntriesByFrequency(
    frequency: number,
    tolerance = 1000,
  ): MeasurementLogEntry[] {
    return this.getAllEntries().filter((e) => {
      if (!e.frequency) {return false;}
      return (
        Math.abs(e.frequency - frequency) <= tolerance
      );
    });
  }

  /**
   * Delete entry by ID
   */
  deleteEntry(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Clear all entries
   */
  clearAll(): void {
    this.entries.clear();
    this.saveToStorage();
  }

  /**
   * Calculate statistics for a numeric field across entries
   */
  calculateStatistics(
    entries: MeasurementLogEntry[],
    fieldPath: string,
  ): MeasurementStatistics | null {
    const values = entries
      .map((e) => this.getFieldValue(e.data, fieldPath))
      .filter(
        (v): v is number => typeof v === "number" && !isNaN(v),
      );

    if (values.length === 0) {
      return null;
    }

    values.sort((a, b) => a - b);

    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;

    const median = values[Math.floor(values.length / 2)] ?? mean;

    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: values.length,
      min: values[0] ?? 0,
      max: values[values.length - 1] ?? 0,
      mean,
      median,
      stdDev,
      variance,
    };
  }

  /**
   * Get nested field value from object
   */
  private getFieldValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        part in current
      ) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Export log to CSV
   */
  exportToCSV(): string {
    const entries = this.getAllEntries();
    if (entries.length === 0) {
      return "";
    }

    // Generate CSV header
    const headers = [
      "ID",
      "Timestamp",
      "ISO DateTime",
      "Type",
      "Frequency (Hz)",
      "Notes",
      "Tags",
      "Data (JSON)",
    ];

    // Generate CSV rows
    const rows = entries.map((entry) => {
      const date = new Date(entry.timestamp).toISOString();
      const tags = entry.tags?.join(";") ?? "";
      const data = JSON.stringify(entry.data);

      return [
        entry.id,
        entry.timestamp.toString(),
        date,
        entry.measurementType,
        entry.frequency?.toString() ?? "",
        entry.notes ?? "",
        tags,
        data,
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV
    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    return csv;
  }

  /**
   * Export log to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.getAllEntries(), null, 2);
  }

  /**
   * Import log from JSON
   */
  importFromJSON(json: string): boolean {
    try {
      const entries = JSON.parse(json) as MeasurementLogEntry[];
      for (const entry of entries) {
        this.entries.set(entry.id, entry);
      }
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Prune old entries to maintain max entries limit
   */
  private pruneOldEntries(): void {
    const entries = this.getAllEntries();
    const toRemove = entries.length - this.maxEntries;

    if (toRemove > 0) {
      // Remove oldest entries
      for (let i = 0; i < toRemove; i++) {
        const entry = entries[entries.length - 1 - i];
        if (entry) {
          this.entries.delete(entry.id);
        }
      }
    }
  }

  /**
   * Save log to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(this.getAllEntries());
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.error("Failed to save measurement log:", error);
    }
  }

  /**
   * Load log from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const entries = JSON.parse(data) as MeasurementLogEntry[];
        for (const entry of entries) {
          this.entries.set(entry.id, entry);
        }
      }
    } catch (error) {
      console.error("Failed to load measurement log:", error);
    }
  }

  /**
   * Get log size in bytes
   */
  getLogSize(): number {
    return JSON.stringify(this.getAllEntries()).length;
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.size;
  }
}
