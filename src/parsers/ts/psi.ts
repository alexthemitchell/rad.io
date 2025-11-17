/**
 * PSI (Program Specific Information) Parsing
 *
 * Handles parsing of MPEG-2 PSI tables including PAT (Program Association Table)
 * and PMT (Program Map Table).
 */

import { parseDescriptors } from "./descriptors";
import type {
  ProgramAssociationTable,
  ProgramMapTable,
  StreamInfo,
} from "./types";

/**
 * Parse Program Association Table (PAT)
 */
export function parsePAT(data: Uint8Array): ProgramAssociationTable | null {
  if (data.length < 12) {
    return null;
  }

  const tableId = data[0] ?? 0;
  const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
  const transportStreamId = ((data[3] ?? 0) << 8) | (data[4] ?? 0);
  const versionNumber = ((data[5] ?? 0) >> 1) & 0x1f;
  const currentNextIndicator = ((data[5] ?? 0) & 0x01) !== 0;
  const sectionNumber = data[6] ?? 0;
  const lastSectionNumber = data[7] ?? 0;

  const programs = new Map<number, number>();
  let offset = 8;
  const endOffset = 3 + sectionLength - 4; // Exclude CRC

  while (offset + 4 <= endOffset && offset < data.length) {
    const programNumber = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
    const pid =
      (((data[offset + 2] ?? 0) & 0x1f) << 8) | (data[offset + 3] ?? 0);

    if (programNumber !== 0) {
      // Program number 0 is Network PID
      programs.set(programNumber, pid);
    }

    offset += 4;
  }

  // Parse CRC
  let crcOffset = 3 + sectionLength - 4;
  if (data.length < 4) {
    return null;
  }
  if (crcOffset + 4 > data.length) {
    crcOffset = data.length - 4;
  }
  const crc32 =
    (((data[crcOffset] ?? 0) << 24) |
      ((data[crcOffset + 1] ?? 0) << 16) |
      ((data[crcOffset + 2] ?? 0) << 8) |
      (data[crcOffset + 3] ?? 0)) >>>
    0;

  return {
    tableId,
    sectionLength,
    transportStreamId,
    versionNumber,
    currentNextIndicator,
    sectionNumber,
    lastSectionNumber,
    programs,
    crc32,
  };
}

/**
 * Parse Program Map Table (PMT)
 */
export function parsePMT(
  data: Uint8Array,
  programNumber: number,
): ProgramMapTable | null {
  if (data.length < 16) {
    return null;
  }

  const tableId = data[0] ?? 0;
  const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
  const versionNumber = ((data[5] ?? 0) >> 1) & 0x1f;
  const currentNextIndicator = ((data[5] ?? 0) & 0x01) !== 0;
  const sectionNumber = data[6] ?? 0;
  const lastSectionNumber = data[7] ?? 0;
  const pcrPid = (((data[8] ?? 0) & 0x1f) << 8) | (data[9] ?? 0);
  const programInfoLength = (((data[10] ?? 0) & 0x0f) << 8) | (data[11] ?? 0);

  let offset = 12;

  // Parse program descriptors
  if (offset + programInfoLength > data.length) {
    return null;
  }
  const programDescriptors = parseDescriptors(
    data.subarray(offset, offset + programInfoLength),
  );
  offset += programInfoLength;

  // Parse streams
  const streams: StreamInfo[] = [];
  const endOffset = 3 + sectionLength - 4; // Exclude CRC

  while (offset + 5 <= endOffset && offset < data.length) {
    const streamType = data[offset] ?? 0;
    const elementaryPid =
      (((data[offset + 1] ?? 0) & 0x1f) << 8) | (data[offset + 2] ?? 0);
    const esInfoLength =
      (((data[offset + 3] ?? 0) & 0x0f) << 8) | (data[offset + 4] ?? 0);

    offset += 5;

    // Bounds check before parsing descriptors
    if (offset + esInfoLength > data.length) {
      break;
    }

    const descriptors = parseDescriptors(
      data.subarray(offset, offset + esInfoLength),
    );
    offset += esInfoLength;

    streams.push({
      streamType,
      elementaryPid,
      esInfoLength,
      descriptors,
    });
  }

  // Parse CRC
  let crcOffset = 3 + sectionLength - 4;
  if (crcOffset + 4 > data.length) {
    crcOffset = data.length - 4;
  }
  const crc32 =
    (((data[crcOffset] ?? 0) << 24) |
      ((data[crcOffset + 1] ?? 0) << 16) |
      ((data[crcOffset + 2] ?? 0) << 8) |
      (data[crcOffset + 3] ?? 0)) >>>
    0;

  return {
    tableId,
    sectionLength,
    programNumber,
    versionNumber,
    currentNextIndicator,
    sectionNumber,
    lastSectionNumber,
    pcrPid,
    programInfoLength,
    programDescriptors,
    streams,
    crc32,
  };
}
