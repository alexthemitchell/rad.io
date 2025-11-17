/**
 * Descriptor Parsing
 *
 * Generic descriptor parsing used by both PSI and PSIP tables.
 */

import type { Descriptor } from "./types";

/**
 * Parse descriptors from a data buffer
 *
 * Descriptors are used throughout PSI and PSIP tables to provide additional
 * metadata. Each descriptor has a tag, length, and data payload.
 */
export function parseDescriptors(data: Uint8Array): Descriptor[] {
  const descriptors: Descriptor[] = [];
  let offset = 0;

  while (offset + 2 <= data.length) {
    const tag = data[offset] ?? 0;
    const length = data[offset + 1] ?? 0;

    if (offset + 2 + length > data.length) {
      break;
    }

    descriptors.push({
      tag,
      length,
      data: data.subarray(offset + 2, offset + 2 + length),
    });

    offset += 2 + length;
  }

  return descriptors;
}
