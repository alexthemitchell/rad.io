/**
 * Example: Using TransportStreamParser with ATSC 8-VSB Demodulator
 *
 * This example demonstrates how to integrate the MPEG-2 Transport Stream Parser
 * with the ATSC 8-VSB demodulator to extract program information and elementary streams.
 */

// NOTE: This import is for illustration purposes only. In production or other contexts,
// you may need to adjust or remove this dependency.
import { ATSC8VSBDemodulator } from "../plugins/demodulators/ATSC8VSBDemodulator";
import { TransportStreamParser } from "./TransportStreamParser";
import type { IQSample } from "../models/SDRDevice";

/**
 * GPS epoch offset: seconds between Unix epoch (1970-01-01 00:00:00 UTC)
 * and GPS epoch (1980-01-06 00:00:00 UTC)
 */
const GPS_TO_UNIX_EPOCH_OFFSET = 315964800;

/**
 * Example: Parse ATSC broadcast and extract program information
 */
export async function parseATSCBroadcast(iqSamples: IQSample[]): Promise<void> {
  // Create demodulator
  const demodulator = new ATSC8VSBDemodulator();
  await demodulator.initialize();
  await demodulator.activate();

  // Demodulate IQ samples to symbols
  const symbols = demodulator.demodulate(iqSamples);

  // Convert symbols to transport stream bytes
  // Note: In a real implementation, you would need to:
  // 1. Apply Reed-Solomon FEC decoding
  // 2. Apply trellis decoding
  // 3. Perform derandomization
  // 4. Convert symbols to bytes
  //
  // For this example, we'll simulate transport stream data
  const tsData = convertSymbolsToBytes(symbols);

  // Create parser
  const parser = new TransportStreamParser();

  // Parse transport stream
  const packets = parser.parseStream(tsData);

  console.info(`Parsed ${packets.length} transport packets`);

  // Get Program Association Table
  const pat = parser.getPAT();
  if (pat) {
    console.info("\nProgram Association Table:");
    console.info(`  Transport Stream ID: ${pat.transportStreamId}`);
    console.info(`  Version: ${pat.versionNumber}`);
    console.info(`  Programs: ${pat.programs.size}`);

    // List all programs
    for (const [programNumber, pmtPid] of pat.programs.entries()) {
      console.info(
        `    Program ${programNumber} -> PMT PID: 0x${pmtPid.toString(16)}`,
      );

      // Get Program Map Table for this program
      const pmt = parser.getPMT(programNumber);
      if (pmt) {
        console.info(`      PCR PID: 0x${pmt.pcrPid.toString(16)}`);
        console.info(`      Streams: ${pmt.streams.length}`);

        // List elementary streams
        for (const stream of pmt.streams) {
          const streamTypeName = getStreamTypeName(stream.streamType);
          console.info(
            `        - ${streamTypeName} (type 0x${stream.streamType.toString(16)}) PID: 0x${stream.elementaryPid.toString(16)}`,
          );
        }

        // Get video PIDs
        const videoPIDs = parser.getVideoPIDs(programNumber);
        console.info(
          `      Video PIDs: ${videoPIDs.map((p) => `0x${p.toString(16)}`).join(", ")}`,
        );

        // Get audio PIDs
        const audioPIDs = parser.getAudioPIDs(programNumber);
        console.info(
          `      Audio PIDs: ${audioPIDs.map((p) => `0x${p.toString(16)}`).join(", ")}`,
        );
      }
    }
  }

  // Get Virtual Channel Table (PSIP)
  const vct = parser.getVCT();
  if (vct) {
    console.info("\nVirtual Channel Table:");
    console.info(`  Protocol Version: ${vct.protocolVersion}`);
    console.info(`  Channels: ${vct.numChannels}`);

    for (const channel of vct.channels) {
      console.info(
        `    ${channel.majorChannelNumber}.${channel.minorChannelNumber} "${channel.shortName}"`,
      );
      console.info(`      Program: ${channel.programNumber}`);
      console.info(`      Source ID: ${channel.sourceid}`);
      console.info(`      Service Type: ${channel.serviceType}`);
      console.info(`      Hidden: ${channel.hidden}`);
    }
  }

  // Get Event Information Table (PSIP)
  const eitMap = parser.getAllEITs();
  if (eitMap.size > 0) {
    console.info("\nEvent Information Tables:");
    for (const [sourceid, eit] of eitMap.entries()) {
      console.info(`  Source ID: ${sourceid}`);
      console.info(`  Events: ${eit.numEvents}`);

      for (const event of eit.events) {
        const startTime = new Date(
          (event.startTime + GPS_TO_UNIX_EPOCH_OFFSET) * 1000,
        ).toLocaleString();
        const duration = Math.floor(event.lengthInSeconds / 60);
        const titleText = extractTitle(event.title);

        console.info(`    Event ${event.eventid}:`);
        console.info(`      Title: ${titleText}`);
        console.info(`      Start: ${startTime}`);
        console.info(`      Duration: ${duration} minutes`);
      }
    }
  }
}

/**
 * Example: Demultiplex video stream
 */
export function demultiplexVideoStream(
  tsData: Uint8Array,
  programNumber: number,
): Uint8Array[] {
  const parser = new TransportStreamParser();
  const packets = parser.parseStream(tsData);

  // Get video PIDs for the program
  const videoPIDs = parser.getVideoPIDs(programNumber);

  if (videoPIDs.length === 0) {
    console.info("No video streams found");
    return [];
  }

  // Demultiplex first video stream
  const videoPID = videoPIDs[0];
  if (videoPID === undefined) {
    return [];
  }
  const videoPayloads = parser.demultiplex(packets, videoPID);

  console.info(
    `Extracted ${videoPayloads.length} video packets from PID 0x${videoPID.toString(16)}`,
  );

  return videoPayloads;
}

/**
 * Example: Filter and process specific PIDs
 */
export function filterSpecificPIDs(
  tsData: Uint8Array,
  pidsToFilter: number[],
): void {
  const parser = new TransportStreamParser();

  // Add PID filters
  for (const pid of pidsToFilter) {
    parser.addPIDFilter(pid);
  }

  // Parse stream - only filtered PIDs will be processed
  const packets = parser.parseStream(tsData);

  console.info(`Processed ${packets.length} packets`);
  console.info(
    `Filtered PIDs: ${pidsToFilter.map((p) => `0x${p.toString(16)}`).join(", ")}`,
  );

  // Get PAT (always processed because PAT_PID is allowed through filters)
  const pat = parser.getPAT();
  if (pat) {
    console.info(`Found ${pat.programs.size} programs`);
  }
}

/**
 * Helper: Convert symbols to bytes
 * Note: This is a simplified placeholder. Real implementation needs FEC decoding.
 */
function convertSymbolsToBytes(symbols: Float32Array): Uint8Array {
  // Placeholder implementation
  // In reality, you would:
  // 1. Group symbols into bytes (using appropriate mapping)
  // 2. Apply Reed-Solomon error correction
  // 3. Apply trellis decoding
  // 4. Derandomize the data

  const bytes = new Uint8Array(Math.floor(symbols.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = 0; // Placeholder
  }
  return bytes;
}

/**
 * Helper: Get human-readable stream type name
 */
function getStreamTypeName(streamType: number): string {
  switch (streamType) {
    case 0x01:
      return "MPEG-1 Video";
    case 0x02:
      return "MPEG-2 Video";
    case 0x03:
      return "MPEG-1 Audio";
    case 0x04:
      return "MPEG-2 Audio";
    case 0x0f:
      return "AAC Audio";
    case 0x1b:
      return "H.264 Video";
    case 0x24:
      return "H.265 Video";
    case 0x81:
      return "AC-3 Audio";
    case 0x87:
      return "E-AC-3 Audio";
    default:
      return `Unknown (0x${streamType.toString(16)})`;
  }
}

/**
 * Helper: Extract title from Multiple String Structure
 */
function extractTitle(
  titles: Array<{
    iso639LanguageCode: string;
    segments: Array<{ compressedString: Uint8Array }>;
  }>,
): string {
  if (titles.length === 0) {
    return "";
  }

  const firstTitle = titles[0];
  if (!firstTitle || firstTitle.segments.length === 0) {
    return "";
  }

  const firstSegment = firstTitle.segments[0];
  if (!firstSegment) {
    return "";
  }

  // Simple UTF-8 decode (real implementation should handle compression types)
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(firstSegment.compressedString);
}
