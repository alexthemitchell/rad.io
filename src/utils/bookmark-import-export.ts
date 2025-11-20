/**
 * Utilities for importing and exporting bookmarks in CSV format
 */

import Papa from "papaparse";
import { generateBookmarkId } from "./id";
import type { Bookmark } from "../types/bookmark";

/**
 * Escapes a CSV field value by:
 * - Prepending a single quote if field starts with =, +, -, or @ (formula injection protection)
 * - Wrapping in quotes if it contains comma, quote, newline, or carriage return
 * - Doubling any internal quotes
 */
function escapeCSVField(value: string | number): string {
  const str = String(value);
  // Prevent formula injection
  let escapedStr = str;
  if (/^[=+\-@]/.test(str)) {
    escapedStr = `'${str}`;
  }
  // Escape special characters per RFC 4180
  if (/[,"\r\n]/.test(escapedStr)) {
    return `"${escapedStr.replace(/"/g, '""')}"`;
  }
  return escapedStr;
}

/**
 * Converts a bookmark to a CSV row
 */
function bookmarkToCSVRow(bookmark: Bookmark): string {
  const fields = [
    bookmark.frequency,
    escapeCSVField(bookmark.name),
    escapeCSVField(bookmark.tags.join(",")),
    escapeCSVField(bookmark.notes),
    bookmark.createdAt,
    bookmark.lastUsed,
  ];
  return fields.join(",");
}

/**
 * Converts an array of bookmarks to a CSV string
 */
export function bookmarksToCSV(bookmarks: Bookmark[]): string {
  const headers = [
    "Frequency (Hz)",
    "Name",
    "Tags",
    "Notes",
    "Created At",
    "Last Used",
  ];
  const headerRow = headers.join(",");
  const dataRows = bookmarks.map(bookmarkToCSVRow);
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Downloads bookmarks as a CSV file
 */
export function downloadBookmarksCSV(bookmarks: Bookmark[]): void {
  const csvContent = bookmarksToCSV(bookmarks);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // Generate filename with timestamp
  const date = new Date();
  const timestamp = date.toISOString().split("T")[0]; // YYYY-MM-DD format
  const filename = `bookmarks-${timestamp}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import preview result with validation and duplicate detection
 */
export interface ImportPreview {
  valid: Bookmark[];
  duplicates: Array<{
    imported: Bookmark;
    existing: Bookmark;
  }>;
  errors: Array<{
    row: number;
    message: string;
    data?: Record<string, unknown>;
  }>;
}

/**
 * Validation result for a single bookmark row
 */
interface ValidationResult {
  valid: boolean;
  bookmark?: Bookmark;
  error?: string;
}

/**
 * Device frequency ranges (Hz)
 * RTL-SDR: 24 MHz - 1.7 GHz (extendable down to ~500 kHz with direct sampling)
 * HackRF: 1 MHz - 6 GHz
 * Using RTL-SDR range as baseline for validation
 */
const MIN_FREQUENCY = 24_000_000; // 24 MHz
const MAX_FREQUENCY = 1_700_000_000; // 1.7 GHz

/**
 * Duplicate detection tolerance (Hz)
 */
const DUPLICATE_TOLERANCE = 1000; // 1 kHz

/**
 * Validates a single bookmark row from CSV
 */
function validateBookmarkRow(
  data: Record<string, unknown>,
  rowIndex: number,
): ValidationResult {
  // Helper to safely convert unknown to string
  const toSafeString = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    // For objects/arrays, treat as empty
    return "";
  };

  // Check for required fields
  const freqStr = toSafeString(data["Frequency (Hz)"]);
  const nameStr = toSafeString(data["Name"]);

  if (freqStr.trim() === "") {
    return {
      valid: false,
      error: `Row ${rowIndex}: Missing frequency`,
    };
  }

  if (nameStr.trim() === "") {
    return {
      valid: false,
      error: `Row ${rowIndex}: Missing name`,
    };
  }

  // Parse and validate frequency
  const frequency = Number(freqStr);
  if (isNaN(frequency)) {
    return {
      valid: false,
      error: `Row ${rowIndex}: Invalid frequency "${freqStr}"`,
    };
  }

  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
    return {
      valid: false,
      error: `Row ${rowIndex}: Frequency ${frequency} Hz out of range (${MIN_FREQUENCY}-${MAX_FREQUENCY} Hz)`,
    };
  }

  // Parse tags (optional, comma-separated)
  const tagsStr = toSafeString(data["Tags"]);
  let tags: string[] = [];
  if (tagsStr.trim() !== "") {
    tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Parse notes (optional)
  const notes = toSafeString(data["Notes"]).trim();

  // Parse timestamps (use current time if not provided or invalid)
  const now = Date.now();
  let createdAt = now;
  let lastUsed = now;

  const createdAtValue = data["Created At"];
  if (createdAtValue) {
    const parsed = Number(createdAtValue);
    if (!isNaN(parsed) && parsed > 0) {
      createdAt = parsed;
    }
  }

  const lastUsedValue = data["Last Used"];
  if (lastUsedValue) {
    const parsed = Number(lastUsedValue);
    if (!isNaN(parsed) && parsed > 0) {
      lastUsed = parsed;
    }
  }

  const bookmark: Bookmark = {
    id: generateBookmarkId(),
    frequency: Math.round(frequency),
    name: nameStr.trim(),
    tags,
    notes,
    createdAt,
    lastUsed,
  };

  return { valid: true, bookmark };
}

/**
 * Checks if two frequencies are duplicates within tolerance
 */
function isDuplicate(freq1: number, freq2: number): boolean {
  return Math.abs(freq1 - freq2) <= DUPLICATE_TOLERANCE;
}

/**
 * Parses CSV content and returns import preview with validation
 */
export function parseBookmarksCSV(
  csvContent: string,
  existingBookmarks: Bookmark[],
): ImportPreview {
  const preview: ImportPreview = {
    valid: [],
    duplicates: [],
    errors: [],
  };

  // Parse CSV using papaparse
  const parseResult = Papa.parse<Record<string, unknown>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep as strings for custom validation
  });

  // Check for parsing errors
  if (parseResult.errors.length > 0) {
    parseResult.errors.forEach((error) => {
      preview.errors.push({
        row: error.row ?? -1,
        message: error.message,
      });
    });
  }

  // Create frequency map for efficient duplicate lookup (O(n) instead of O(n*m))
  const existingFrequencyMap = new Map<number, Bookmark>();
  for (const bookmark of existingBookmarks) {
    existingFrequencyMap.set(bookmark.frequency, bookmark);
  }

  // Validate each row
  parseResult.data.forEach((row, index) => {
    const validation = validateBookmarkRow(row, index + 2); // +2 for 1-based + header

    if (validation.valid && validation.bookmark) {
      const bookmark = validation.bookmark;

      // Check for duplicates within already-validated bookmarks from CSV
      const internalDuplicate = preview.valid.find((valid) =>
        isDuplicate(valid.frequency, bookmark.frequency),
      );

      // Check for duplicates in existing bookmarks using frequency map
      let existingDuplicate: Bookmark | undefined;
      for (const [freq, bm] of existingFrequencyMap.entries()) {
        if (isDuplicate(freq, bookmark.frequency)) {
          existingDuplicate = bm;
          break;
        }
      }

      if (internalDuplicate) {
        // Internal duplicate - add as error
        preview.errors.push({
          row: index + 2,
          message: `Duplicate frequency within CSV (matches row with ${internalDuplicate.name})`,
          data: row,
        });
      } else if (existingDuplicate) {
        preview.duplicates.push({
          imported: bookmark,
          existing: existingDuplicate,
        });
      } else {
        preview.valid.push(bookmark);
      }
    } else if (validation.error) {
      preview.errors.push({
        row: index + 2,
        message: validation.error,
        data: row,
      });
    }
  });

  return preview;
}

/**
 * Duplicate handling strategy
 */
export type DuplicateStrategy = "skip" | "overwrite" | "import_as_new";

/**
 * Merges imported bookmarks with existing ones based on duplicate strategy
 */
export function mergeBookmarks(
  existingBookmarks: Bookmark[],
  preview: ImportPreview,
  duplicateStrategy: DuplicateStrategy,
): Bookmark[] {
  let result = [...existingBookmarks];

  // Handle duplicates based on strategy
  if (duplicateStrategy === "skip") {
    // Just add valid bookmarks (duplicates already excluded in preview.valid)
    result = [...result, ...preview.valid];
  } else if (duplicateStrategy === "overwrite") {
    // Remove existing duplicates and add all imported bookmarks
    const duplicateIds = new Set(preview.duplicates.map((d) => d.existing.id));
    result = result.filter((b) => !duplicateIds.has(b.id));
    result = [
      ...result,
      ...preview.valid,
      ...preview.duplicates.map((d) => d.imported),
    ];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (duplicateStrategy === "import_as_new") {
    // Import everything including duplicates with new IDs
    result = [
      ...result,
      ...preview.valid,
      ...preview.duplicates.map((d) => ({
        ...d.imported,
        id: generateBookmarkId(), // Generate new ID
      })),
    ];
  }

  return result;
}
