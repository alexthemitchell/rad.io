/**
 * PSIP (Program and System Information Protocol) Parsing
 *
 * Handles parsing of ATSC PSIP tables including MGT (Master Guide Table),
 * VCT (Virtual Channel Table), EIT (Event Information Table), and
 * ETT (Extended Text Table).
 */

import { parseDescriptors } from "./descriptors";
import type {
  MasterGuideTable,
  TableDefinition,
  VirtualChannelTable,
  VirtualChannel,
  EventInformationTable,
  Event,
  ExtendedTextTable,
  MultipleStringStructure,
  StringSegment,
} from "./types";

/**
 * Parse Master Guide Table (MGT)
 */
export function parseMGT(data: Uint8Array): MasterGuideTable | null {
  if (data.length < 17) {
    return null;
  }

  const tableId = data[0] ?? 0;
  const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
  const protocolVersion = data[8] ?? 0;
  const tablesDefinedCount = ((data[9] ?? 0) << 8) | (data[10] ?? 0);

  const tables: TableDefinition[] = [];
  let offset = 11;

  for (let i = 0; i < tablesDefinedCount && offset + 11 <= data.length; i++) {
    const tableType = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
    const tablePid =
      (((data[offset + 2] ?? 0) & 0x1f) << 8) | (data[offset + 3] ?? 0);
    const versionNumber = (data[offset + 4] ?? 0) & 0x1f;
    const numberOfBytes =
      (((data[offset + 5] ?? 0) << 24) |
        ((data[offset + 6] ?? 0) << 16) |
        ((data[offset + 7] ?? 0) << 8) |
        (data[offset + 8] ?? 0)) >>>
      0;
    const tableDescriptorsLength =
      (((data[offset + 9] ?? 0) & 0x0f) << 8) | (data[offset + 10] ?? 0);

    offset += 11;

    // Bounds check: ensure we have enough data for tableDescriptorsLength
    if (offset + tableDescriptorsLength > data.length) {
      break;
    }

    const descriptors = parseDescriptors(
      data.subarray(offset, offset + tableDescriptorsLength),
    );
    offset += tableDescriptorsLength;

    tables.push({
      tableType,
      tablePid,
      versionNumber,
      numberOfBytes,
      descriptors,
    });
  }

  // Bounds check: ensure we have at least two bytes to read descriptorsLength
  if (offset + 2 > data.length) {
    return null;
  }

  const descriptorsLength =
    (((data[offset] ?? 0) & 0x0f) << 8) | (data[offset + 1] ?? 0);
  offset += 2;

  // Bounds check: ensure we have enough data for descriptors
  if (offset + descriptorsLength > data.length) {
    return null;
  }

  const descriptors = parseDescriptors(
    data.subarray(offset, offset + descriptorsLength),
  );

  return {
    tableId,
    sectionLength,
    protocolVersion,
    tablesDefinedCount,
    tables,
    descriptors,
  };
}

/**
 * Parse Virtual Channel Table (VCT)
 */
export function parseVCT(data: Uint8Array): VirtualChannelTable | null {
  if (data.length < 14) {
    return null;
  }

  const tableId = data[0] ?? 0;
  const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
  const protocolVersion = data[8] ?? 0;
  const numChannels = data[9] ?? 0;

  const channels: VirtualChannel[] = [];
  let offset = 10;

  for (let i = 0; i < numChannels && offset + 32 <= data.length; i++) {
    // Parse short name (14 bytes, 7 UTF-16 characters)
    let shortName = "";
    for (let j = 0; j < 7; j++) {
      const charCode =
        ((data[offset + j * 2] ?? 0) << 8) | (data[offset + j * 2 + 1] ?? 0);
      if (charCode !== 0) {
        shortName += String.fromCharCode(charCode);
      }
    }
    offset += 14;

    const majorChannelNumber =
      (((data[offset] ?? 0) & 0x0f) << 6) |
      (((data[offset + 1] ?? 0) >> 2) & 0x3f);
    const minorChannelNumber =
      (((data[offset + 1] ?? 0) & 0x03) << 8) | (data[offset + 2] ?? 0);
    const modulationMode = data[offset + 3] ?? 0;
    const carrierFrequency =
      (((data[offset + 4] ?? 0) << 24) |
        ((data[offset + 5] ?? 0) << 16) |
        ((data[offset + 6] ?? 0) << 8) |
        (data[offset + 7] ?? 0)) >>>
      0;
    const channelTSID =
      ((data[offset + 8] ?? 0) << 8) | (data[offset + 9] ?? 0);
    const programNumber =
      ((data[offset + 10] ?? 0) << 8) | (data[offset + 11] ?? 0);
    const etmLocation = ((data[offset + 12] ?? 0) >> 6) & 0x03;
    const accessControlled = ((data[offset + 12] ?? 0) & 0x20) !== 0;
    const hidden = ((data[offset + 12] ?? 0) & 0x10) !== 0;
    const hideGuide = ((data[offset + 12] ?? 0) & 0x02) !== 0;
    const serviceType = (data[offset + 13] ?? 0) & 0x3f;
    const sourceid = ((data[offset + 14] ?? 0) << 8) | (data[offset + 15] ?? 0);
    const descriptorsLength =
      (((data[offset + 16] ?? 0) & 0x03) << 8) | (data[offset + 17] ?? 0);

    offset += 18;

    // Bounds check before parsing descriptors
    if (offset + descriptorsLength > data.length) break;

    const descriptors = parseDescriptors(
      data.subarray(offset, offset + descriptorsLength),
    );
    offset += descriptorsLength;

    channels.push({
      shortName: shortName.trim(),
      majorChannelNumber,
      minorChannelNumber,
      modulationMode,
      carrierFrequency,
      channelTSID,
      programNumber,
      etmLocation,
      accessControlled,
      hidden,
      hideGuide,
      serviceType,
      sourceid,
      descriptors,
    });
  }

  // Bounds check: ensure we have at least two bytes to read descriptorsLength
  if (offset + 2 > data.length) {
    return null;
  }

  const descriptorsLength =
    (((data[offset] ?? 0) & 0x03) << 8) | (data[offset + 1] ?? 0);
  offset += 2;

  // Bounds check: ensure we do not read past the end of data
  if (offset + descriptorsLength > data.length) {
    return null;
  }

  const descriptors = parseDescriptors(
    data.subarray(offset, offset + descriptorsLength),
  );

  return {
    tableId,
    sectionLength,
    protocolVersion,
    numChannels,
    channels,
    descriptors,
  };
}

/**
 * Parse Multiple String Structure (used in EIT and ETT)
 */
export function parseMultipleStringStructure(
  data: Uint8Array,
): MultipleStringStructure[] {
  const structures: MultipleStringStructure[] = [];
  let offset = 0;

  if (offset >= data.length) {
    return structures;
  }

  const numberOfStrings = data[offset] ?? 0;
  offset++;

  for (let i = 0; i < numberOfStrings && offset + 4 <= data.length; i++) {
    const iso639LanguageCode = String.fromCharCode(
      data[offset] ?? 0,
      data[offset + 1] ?? 0,
      data[offset + 2] ?? 0,
    );
    const numberOfSegments = data[offset + 3] ?? 0;
    offset += 4;

    const segments: StringSegment[] = [];

    for (let j = 0; j < numberOfSegments && offset + 3 <= data.length; j++) {
      const compressionType = data[offset] ?? 0;
      const mode = data[offset + 1] ?? 0;
      const numberOfBytes = data[offset + 2] ?? 0;
      offset += 3;

      if (offset + numberOfBytes > data.length) {
        break;
      }

      const compressedString = data.subarray(offset, offset + numberOfBytes);
      offset += numberOfBytes;

      segments.push({
        compressionType,
        mode,
        numberOfBytes,
        compressedString,
      });
    }

    structures.push({
      iso639LanguageCode,
      segments,
    });
  }

  return structures;
}

/**
 * Parse Event Information Table (EIT)
 */
export function parseEIT(data: Uint8Array): EventInformationTable | null {
  if (data.length < 14) {
    return null;
  }

  const tableId = data[0] ?? 0;
  const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
  const protocolVersion = data[8] ?? 0;
  const sourceid = ((data[9] ?? 0) << 8) | (data[10] ?? 0);
  const numEvents = data[11] ?? 0;

  const events: Event[] = [];
  let offset = 12;

  for (let i = 0; i < numEvents && offset + 12 <= data.length; i++) {
    const eventid = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
    const startTime =
      (((data[offset + 2] ?? 0) << 24) |
        ((data[offset + 3] ?? 0) << 16) |
        ((data[offset + 4] ?? 0) << 8) |
        (data[offset + 5] ?? 0)) >>>
      0;
    const etmLocation = ((data[offset + 6] ?? 0) >> 6) & 0x03;
    const lengthInSeconds =
      (((data[offset + 6] ?? 0) & 0x0f) << 16) |
      ((data[offset + 7] ?? 0) << 8) |
      (data[offset + 8] ?? 0);
    const titleLength = data[offset + 9] ?? 0;

    offset += 10;

    // Parse multiple string structure for title
    const title = parseMultipleStringStructure(
      data.subarray(offset, offset + titleLength),
    );
    offset += titleLength;

    const descriptorsLength =
      (((data[offset] ?? 0) & 0x0f) << 8) | (data[offset + 1] ?? 0);
    offset += 2;

    // Bounds check before parsing descriptors
    if (offset + descriptorsLength > data.length) break;

    const descriptors = parseDescriptors(
      data.subarray(offset, offset + descriptorsLength),
    );
    offset += descriptorsLength;

    events.push({
      eventid,
      startTime,
      etmLocation,
      lengthInSeconds,
      titleLength,
      title,
      descriptors,
    });
  }

  return {
    tableId,
    sectionLength,
    protocolVersion,
    sourceid,
    numEvents,
    events,
  };
}

/**
 * Parse Extended Text Table (ETT)
 */
export function parseETT(data: Uint8Array): ExtendedTextTable | null {
  if (data.length < 13) {
    return null;
  }

  const tableId = data[0] ?? 0;
  const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
  const protocolVersion = data[8] ?? 0;
  const ettTableIdExtension = ((data[3] ?? 0) << 8) | (data[4] ?? 0);

  const messageLength = sectionLength - 10; // Subtract header and CRC
  if (9 + messageLength > data.length) {
    return null;
  }
  const extendedTextMessage = parseMultipleStringStructure(
    data.subarray(9, 9 + messageLength),
  );

  return {
    tableId,
    sectionLength,
    protocolVersion,
    ettTableIdExtension,
    extendedTextMessage,
  };
}
