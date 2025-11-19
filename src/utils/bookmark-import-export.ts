/**
 * Utilities for importing and exporting bookmarks in CSV format
 */

export interface Bookmark {
  id: string;
  frequency: number; // Hz
  name: string;
  tags: string[];
  notes: string;
  createdAt: number; // timestamp
  lastUsed: number; // timestamp
}

/**
 * Escapes a CSV field value by:
 * - Wrapping in quotes if it contains comma, quote, or newline
 * - Doubling any internal quotes
 */
function escapeCSVField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
