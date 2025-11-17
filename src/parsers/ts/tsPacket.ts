/**
 * Transport Stream Packet Parsing
 *
 * Low-level parsing functions for MPEG-2 Transport Stream packets,
 * including packet headers, adaptation fields, and PCR.
 */

import type { TSPacket, TSPacketHeader, AdaptationField } from "./types";

/** Standard MPEG-2 TS packet size in bytes */
export const PACKET_SIZE = 188;

/** Sync byte that marks the start of each TS packet */
export const SYNC_BYTE = 0x47;

/**
 * Parse packet header (first 4 bytes)
 */
export function parsePacketHeader(data: Uint8Array): TSPacketHeader | null {
  if (data.length < 4) {
    return null;
  }

  const byte0 = data[0] ?? 0;
  const byte1 = data[1] ?? 0;
  const byte2 = data[2] ?? 0;
  const byte3 = data[3] ?? 0;

  return {
    syncByte: byte0,
    transportErrorIndicator: (byte1 & 0x80) !== 0,
    payloadUnitStartIndicator: (byte1 & 0x40) !== 0,
    transportPriority: (byte1 & 0x20) !== 0,
    pid: ((byte1 & 0x1f) << 8) | byte2,
    scramblingControl: (byte3 >> 6) & 0x03,
    adaptationFieldControl: (byte3 >> 4) & 0x03,
    continuityCounter: byte3 & 0x0f,
  };
}

/**
 * Parse Program Clock Reference (42 bits)
 */
export function parsePCR(data: Uint8Array): bigint {
  if (data.length < 6) {
    return BigInt(0);
  }

  const byte0 = BigInt(data[0] ?? 0);
  const byte1 = BigInt(data[1] ?? 0);
  const byte2 = BigInt(data[2] ?? 0);
  const byte3 = BigInt(data[3] ?? 0);
  const byte4 = BigInt(data[4] ?? 0);
  const byte5 = BigInt(data[5] ?? 0);

  // PCR base (33 bits)
  const pcrBase =
    (byte0 << BigInt(25)) |
    (byte1 << BigInt(17)) |
    (byte2 << BigInt(9)) |
    (byte3 << BigInt(1)) |
    (byte4 >> BigInt(7));

  // PCR extension (9 bits)
  const pcrExt = ((byte4 & BigInt(0x01)) << BigInt(8)) | byte5;

  return pcrBase * BigInt(300) + pcrExt;
}

/**
 * Parse adaptation field
 */
export function parseAdaptationField(data: Uint8Array): AdaptationField | null {
  if (data.length === 0) {
    return null;
  }

  const byte0 = data[0] ?? 0;

  const field: AdaptationField = {
    length: data.length,
    discontinuityIndicator: (byte0 & 0x80) !== 0,
    randomAccessIndicator: (byte0 & 0x40) !== 0,
    elementaryStreamPriorityIndicator: (byte0 & 0x20) !== 0,
    pcrFlag: (byte0 & 0x10) !== 0,
    opcrFlag: (byte0 & 0x08) !== 0,
    splicingPointFlag: (byte0 & 0x04) !== 0,
    transportPrivateDataFlag: (byte0 & 0x02) !== 0,
    adaptationFieldExtensionFlag: (byte0 & 0x01) !== 0,
  };

  let offset = 1;

  // Parse PCR if present
  if (field.pcrFlag && offset + 6 <= data.length) {
    field.pcr = parsePCR(data.subarray(offset, offset + 6));
    offset += 6;
  }

  // Parse OPCR if present
  if (field.opcrFlag && offset + 6 <= data.length) {
    field.opcr = parsePCR(data.subarray(offset, offset + 6));
    offset += 6;
  }

  return field;
}

/**
 * Parse a single 188-byte transport packet
 */
export function parsePacket(data: Uint8Array): TSPacket | null {
  if (data.length !== PACKET_SIZE || data[0] !== SYNC_BYTE) {
    return null;
  }

  const header = parsePacketHeader(data);
  if (!header) {
    return null;
  }

  let offset = 4; // Header is 4 bytes
  let adaptationField: AdaptationField | undefined;
  let payload: Uint8Array | undefined;

  // Parse adaptation field if present
  if (
    header.adaptationFieldControl === 0x02 ||
    header.adaptationFieldControl === 0x03
  ) {
    const afLength = data[offset] ?? 0;
    offset++;
    if (afLength > 0 && offset + afLength <= data.length) {
      const af = parseAdaptationField(data.subarray(offset, offset + afLength));
      if (af) {
        adaptationField = af;
      }
      offset += afLength;
    }
  }

  // Extract payload if present
  if (
    header.adaptationFieldControl === 0x01 ||
    header.adaptationFieldControl === 0x03
  ) {
    if (offset < data.length) {
      payload = data.subarray(offset);
    }
  }

  return {
    header,
    adaptationField,
    payload,
  };
}
