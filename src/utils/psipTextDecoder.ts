/**
 * PSIP Text Decoder
 *
 * Utilities for decoding ATSC PSIP MultipleStringStructure text data
 * into readable strings according to ATSC A/65 specification.
 *
 * Reference: ATSC A/65 Section 6.10 - Multiple String Structure
 */

import type {
  MultipleStringStructure,
  StringSegment,
} from "../parsers/TransportStreamParser";

/**
 * Compression types defined in ATSC A/65
 */
export enum CompressionType {
  NO_COMPRESSION = 0x00,
  HUFFMAN_C4_C8 = 0x01,
  HUFFMAN_C5_C9 = 0x02,
}

/**
 * Text modes defined in ATSC A/65
 */
export enum TextMode {
  UNICODE_UTF16 = 0x00,
  SCSU = 0x3e, // Standard Compression Scheme for Unicode
  UNICODE_UTF8 = 0x3f,
}

/**
 * Decode a MultipleStringStructure into readable text
 *
 * @param mss - Multiple String Structure from PSIP table
 * @param preferredLanguage - Preferred ISO 639 language code (e.g., "eng", "spa")
 * @returns Decoded text string
 */
export function decodeMultipleStringStructure(
  mss: MultipleStringStructure[],
  preferredLanguage = "eng",
): string {
  if (mss.length === 0) {
    return "";
  }

  // Try to find preferred language
  let selectedString = mss.find(
    (s) => s.iso639LanguageCode === preferredLanguage,
  );

  // Fall back to first available language
  if (!selectedString && mss.length > 0) {
    selectedString = mss[0];
  }

  if (!selectedString) {
    return "";
  }

  // Decode all segments and concatenate
  return selectedString.segments
    .map((segment) => decodeStringSegment(segment))
    .join("");
}

/**
 * Decode a single string segment
 *
 * @param segment - String segment to decode
 * @returns Decoded text
 */
export function decodeStringSegment(segment: StringSegment): string {
  const { compressedString, compressionType, mode } = segment;

  // Handle compression
  const decompressed = compressedString;
  switch (compressionType) {
    case 0x00: // NO_COMPRESSION
      // No decompression needed
      break;
    case 0x01: // HUFFMAN_C4_C8
    case 0x02: // HUFFMAN_C5_C9
      // Huffman decompression not yet implemented
      // This is rarely used in practice; most broadcasts use uncompressed text
      console.warn("Huffman compression not yet supported");
      return "";
    default:
      console.warn(`Unknown compression type: ${compressionType}`);
      return "";
  }

  // Decode based on mode
  switch (mode) {
    case 0x00: // UNICODE_UTF16
      return decodeUTF16(decompressed);
    case 0x3f: // UNICODE_UTF8
      return decodeUTF8(decompressed);
    case 0x3e: // SCSU
      // SCSU is complex and not yet supported
      console.warn("SCSU mode (0x3e) not supported; returning empty string");
      return "";
    default:
      // ISO 8859 variants (modes 0x01-0x3d) are not yet supported
      console.warn(`Text mode ${mode} not supported; returning empty string`);
      return "";
  }
}

/**
 * Decode UTF-16 byte array to string
 *
 * @param data - UTF-16 encoded bytes (big-endian)
 * @returns Decoded string
 */
function decodeUTF16(data: Uint8Array): string {
  try {
    // ATSC uses big-endian UTF-16
    const decoder = new TextDecoder("utf-16be");
    return decoder.decode(data).replace(/\0/g, "").trim();
  } catch (error) {
    console.error("UTF-16 decode error:", error);
    return "";
  }
}

/**
 * Decode UTF-8 byte array to string
 *
 * @param data - UTF-8 encoded bytes
 * @returns Decoded string
 */
function decodeUTF8(data: Uint8Array): string {
  try {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(data).replace(/\0/g, "").trim();
  } catch (error) {
    console.error("UTF-8 decode error:", error);
    return "";
  }
}

const GPS_EPOCH_MS = new Date("1980-01-06T00:00:00Z").getTime();

/**
 * Convert GPS seconds (since 1980-01-06 00:00:00 UTC) to JavaScript Date
 *
 * @param gpsSeconds - GPS time in seconds
 * @returns JavaScript Date object
 */
export function gpsTimeToDate(gpsSeconds: number): Date {
  const milliseconds = GPS_EPOCH_MS + gpsSeconds * 1000;
  return new Date(milliseconds);
}

/**
 * Format duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1h 30m", "45m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) {
    return "Unknown";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get time slot for a given timestamp in the EPG grid
 *
 * @param timestamp - Date to get time slot for
 * @param slotDuration - Duration of each time slot in minutes
 * @returns Time slot index and formatted time string
 */
export function getTimeSlot(
  timestamp: Date,
  slotDuration = 30,
): { index: number; timeString: string } {
  const hours = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const index = Math.floor(totalMinutes / slotDuration);

  const timeString = timestamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { index, timeString };
}
