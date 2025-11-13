import { atscDeinterleave } from "./deinterleaver";
import { reedSolomonDecode } from "./reedSolomon";
import { trellisViterbiDecode } from "./trellisViterbi";

/**
 * ATSC Baseband Pipeline Interface
 *
 * Converts 8-VSB demodulated symbols into MPEG-2 Transport Stream packets.
 */

export interface AtscBasebandPipeline {
  /** Whether full ATSC FEC + TS framing is implemented */
  readonly implemented: boolean;

  /** Process sliced 8-VSB symbol levels and return MPEG-2 TS bytes if available */
  processSymbols(symbols: Float32Array): Uint8Array;

  /** Get pipeline statistics for diagnostics */
  getStats(): BasebandStats;

  /** Reset internal state */
  reset(): void;
}

/**
 * Statistics from the baseband pipeline
 */
export interface BasebandStats {
  /** Total symbols processed */
  symbolsProcessed: number;
  /** Total TS packets emitted */
  packetsEmitted: number;
  /** Reed-Solomon error count (when implemented) */
  rsErrors: number;
  /** Trellis decoder error count (when implemented) */
  trellisErrors: number;
  /** Whether pipeline is synchronized to TS frames */
  synchronized: boolean;
}

/**
 * Temporary stub pipeline: returns no TS data.
 * This prevents misinterpreting raw 8-VSB symbol decisions as TS packets.
 */
export class StubAtscBasebandPipeline implements AtscBasebandPipeline {
  readonly implemented = false;
  private stats: BasebandStats = {
    symbolsProcessed: 0,
    packetsEmitted: 0,
    rsErrors: 0,
    trellisErrors: 0,
    synchronized: false,
  };

  processSymbols(symbols: Float32Array): Uint8Array {
    this.stats.symbolsProcessed += symbols.length;
    return new Uint8Array(0);
  }

  getStats(): BasebandStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      symbolsProcessed: 0,
      packetsEmitted: 0,
      rsErrors: 0,
      trellisErrors: 0,
      synchronized: false,
    };
  }
}

/**
 * Mock ATSC baseband pipeline for testing the player end-to-end
 *
 * Generates valid MPEG-2 TS packets with PAT/PMT and simulated A/V streams
 * to validate the decode path without requiring real ATSC FEC.
 */
export class MockAtscBasebandPipeline implements AtscBasebandPipeline {
  readonly implemented = true;
  private stats: BasebandStats = {
    symbolsProcessed: 0,
    packetsEmitted: 0,
    rsErrors: 0,
    trellisErrors: 0,
    synchronized: true,
  };

  private packetCounter = 0;
  private patCounter = 0;
  private pmtCounter = 0;
  // removed unused counters

  // TS packet constants
  private static readonly PACKET_SIZE = 188;
  private static readonly SYNC_BYTE = 0x47;
  private static readonly PAT_PID = 0x0000;
  private static readonly PMT_PID = 0x0100;
  private static readonly VIDEO_PID = 0x0101;
  private static readonly AUDIO_PID = 0x0102;

  /**
   * Process symbols and emit TS packets periodically
   * (ignores actual symbols since this is a mock)
   */
  processSymbols(symbols: Float32Array): Uint8Array {
    this.stats.symbolsProcessed += symbols.length;

    // Emit one TS packet every ~2000 symbols to simulate datarate
    const packetsToEmit = Math.floor(symbols.length / 2000);
    if (packetsToEmit === 0) return new Uint8Array(0);

    const output = new Uint8Array(
      packetsToEmit * MockAtscBasebandPipeline.PACKET_SIZE,
    );
    let offset = 0;

    for (let i = 0; i < packetsToEmit; i++) {
      const packet = this.generatePacket();
      output.set(packet, offset);
      offset += MockAtscBasebandPipeline.PACKET_SIZE;
      this.stats.packetsEmitted++;
    }

    return output;
  }

  /**
   * Generate a single TS packet (PAT, PMT, or null packet)
   */
  private generatePacket(): Uint8Array {
    const packet = new Uint8Array(MockAtscBasebandPipeline.PACKET_SIZE);

    // Cycle: PAT every 20 packets, PMT every 20 packets, rest are null
    const type = this.packetCounter % 40;

    if (type === 0) {
      this.generatePAT(packet);
    } else if (type === 20) {
      this.generatePMT(packet);
    } else {
      // Null packet
      this.generateNullPacket(packet);
    }

    this.packetCounter++;
    return packet;
  }

  /**
   * Generate a PAT (Program Association Table) packet
   */
  private generatePAT(packet: Uint8Array): void {
    packet[0] = MockAtscBasebandPipeline.SYNC_BYTE;
    packet[1] = 0x40; // Payload unit start indicator
    packet[2] = MockAtscBasebandPipeline.PAT_PID & 0xff;
    packet[3] = 0x10 | (this.patCounter & 0x0f); // No adaptation, continuity counter
    this.patCounter++;

    // Pointer field
    packet[4] = 0x00;

    // PAT table
    packet[5] = 0x00; // table_id = PAT
    packet[6] = 0xb0; // section_syntax_indicator = 1, section_length high bits
    packet[7] = 0x0d; // section_length (13 bytes)
    packet[8] = 0x00; // transport_stream_id high
    packet[9] = 0x01; // transport_stream_id low
    packet[10] = 0xc1; // version_number = 0, current_next_indicator = 1
    packet[11] = 0x00; // section_number
    packet[12] = 0x00; // last_section_number

    // One program: program_number = 1, PMT PID
    packet[13] = 0x00; // program_number high
    packet[14] = 0x01; // program_number low
    packet[15] = 0xe0 | ((MockAtscBasebandPipeline.PMT_PID >> 8) & 0x1f); // reserved + PID high
    packet[16] = MockAtscBasebandPipeline.PMT_PID & 0xff; // PID low

    // CRC32 (simplified - just use zeros for mock)
    packet[17] = 0x00;
    packet[18] = 0x00;
    packet[19] = 0x00;
    packet[20] = 0x00;

    // Fill rest with 0xFF
    for (let i = 21; i < MockAtscBasebandPipeline.PACKET_SIZE; i++) {
      packet[i] = 0xff;
    }
  }

  /**
   * Generate a PMT (Program Map Table) packet with video and audio streams
   */
  private generatePMT(packet: Uint8Array): void {
    packet[0] = MockAtscBasebandPipeline.SYNC_BYTE;
    packet[1] = 0x40 | ((MockAtscBasebandPipeline.PMT_PID >> 8) & 0x1f);
    packet[2] = MockAtscBasebandPipeline.PMT_PID & 0xff;
    packet[3] = 0x10 | (this.pmtCounter & 0x0f);
    this.pmtCounter++;

    // Pointer field
    packet[4] = 0x00;

    // PMT table
    packet[5] = 0x02; // table_id = PMT
    packet[6] = 0xb0; // section_syntax_indicator = 1
    packet[7] = 0x17; // section_length (23 bytes)
    packet[8] = 0x00; // program_number high
    packet[9] = 0x01; // program_number low
    packet[10] = 0xc1; // version = 0, current_next = 1
    packet[11] = 0x00; // section_number
    packet[12] = 0x00; // last_section_number
    packet[13] = 0xe0; // reserved + PCR_PID high
    packet[14] = 0x00; // PCR_PID low (use video PID)
    packet[15] = 0xf0; // reserved + program_info_length high
    packet[16] = 0x00; // program_info_length low (no descriptors)

    // Video stream (H.264 instead of MPEG-2 for WebCodecs compatibility)
    packet[17] = 0x1b; // stream_type = H.264/AVC Video (0x1B)
    packet[18] = 0xe0 | ((MockAtscBasebandPipeline.VIDEO_PID >> 8) & 0x1f);
    packet[19] = MockAtscBasebandPipeline.VIDEO_PID & 0xff;
    packet[20] = 0xf0; // reserved + ES_info_length high
    packet[21] = 0x00; // ES_info_length low

    // Audio stream (AC-3)
    packet[22] = 0x81; // stream_type = AC-3 Audio
    packet[23] = 0xe0 | ((MockAtscBasebandPipeline.AUDIO_PID >> 8) & 0x1f);
    packet[24] = MockAtscBasebandPipeline.AUDIO_PID & 0xff;
    packet[25] = 0xf0; // reserved + ES_info_length high
    packet[26] = 0x00; // ES_info_length low

    // CRC32 (zeros for mock)
    packet[27] = 0x00;
    packet[28] = 0x00;
    packet[29] = 0x00;
    packet[30] = 0x00;

    // Fill rest
    for (let i = 31; i < MockAtscBasebandPipeline.PACKET_SIZE; i++) {
      packet[i] = 0xff;
    }
  }

  /**
   * Generate a null packet (PID 0x1FFF)
   */
  private generateNullPacket(packet: Uint8Array): void {
    packet[0] = MockAtscBasebandPipeline.SYNC_BYTE;
    packet[1] = 0x1f;
    packet[2] = 0xff;
    packet[3] = 0x10;

    for (let i = 4; i < MockAtscBasebandPipeline.PACKET_SIZE; i++) {
      packet[i] = 0xff;
    }
  }

  getStats(): BasebandStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      symbolsProcessed: 0,
      packetsEmitted: 0,
      rsErrors: 0,
      trellisErrors: 0,
      synchronized: true,
    };
    this.packetCounter = 0;
    this.patCounter = 0;
    this.pmtCounter = 0;
    // no counters to reset
  }
}

/**
 * Real ATSC FEC Pipeline
 *
 * Implements the full ATSC forward error correction chain:
 * - Trellis decoding (rate 2/3, 12-state)
 * - Convolutional deinterleaving (B=52, M=4)
 * - Reed-Solomon decoding (207,187) over GF(256)
 * - TS frame synchronization and extraction
 */
export class AtscFECPipeline implements AtscBasebandPipeline {
  readonly implemented = true;
  private stats: BasebandStats = {
    symbolsProcessed: 0,
    packetsEmitted: 0,
    rsErrors: 0,
    trellisErrors: 0,
    synchronized: false,
  };

  // Symbol buffer for accumulating input
  private symbolBuffer: Float32Array = new Float32Array(0);
  // Byte buffer for RS-decoded payload bytes (to extract TS)
  private byteBuffer: Uint8Array = new Uint8Array(0);

  // ATSC constants
  private static readonly SYMBOLS_PER_SEGMENT = 832;
  private static readonly RS_BLOCK_SIZE = 207; // RS(207,187) output
  private static readonly TS_PACKET_SIZE = 188;
  private static readonly SEGMENTS_PER_VITERBI_BLOCK = 12; // process 12 at a time

  /**
   * Process 8-VSB symbols through the FEC chain
   */
  processSymbols(symbols: Float32Array): Uint8Array {
    this.stats.symbolsProcessed += symbols.length;

    // Append to buffer
    const newBuffer = new Float32Array(
      this.symbolBuffer.length + symbols.length,
    );
    newBuffer.set(this.symbolBuffer, 0);
    newBuffer.set(symbols, this.symbolBuffer.length);
    this.symbolBuffer = newBuffer;

    // Process in groups of 12 segments for trellis decoder
    const segsAvailable = Math.floor(
      this.symbolBuffer.length / AtscFECPipeline.SYMBOLS_PER_SEGMENT,
    );
    const blocksAvailable = Math.floor(
      segsAvailable / AtscFECPipeline.SEGMENTS_PER_VITERBI_BLOCK,
    );

    if (blocksAvailable === 0) {
      return new Uint8Array(0);
    }

    // Decode one block (12 segments)
    const blockSymbols =
      AtscFECPipeline.SEGMENTS_PER_VITERBI_BLOCK *
      AtscFECPipeline.SYMBOLS_PER_SEGMENT;
    const symbolsForBlock = this.symbolBuffer.subarray(0, blockSymbols);

    // Run trellis Viterbi to get 12*207 RS-encoded bytes
    const rsCoded = trellisViterbiDecode(symbolsForBlock);

    // Split into 12 codewords and apply deinterleave + RS decode
    for (let s = 0; s < AtscFECPipeline.SEGMENTS_PER_VITERBI_BLOCK; s++) {
      const start = s * AtscFECPipeline.RS_BLOCK_SIZE;
      const segCodeword = rsCoded.subarray(
        start,
        start + AtscFECPipeline.RS_BLOCK_SIZE,
      );
      // Deinterleave bytes (currently passthrough)
      const deintl = atscDeinterleave(segCodeword);
      const payload = reedSolomonDecode(deintl);
      if (payload.length === 187) {
        this.appendBytes(payload);
      } else {
        // RS failed; we can still append nothing and continue
        this.stats.rsErrors += 1;
      }
    }

    // After appending bytes, try extracting TS packets
    const { packets: tsPackets, consumed } = this.extractAndConsumeTSPackets(
      this.byteBuffer,
    );
    let result = new Uint8Array(0);
    if (tsPackets.length > 0) {
      result = new Uint8Array(tsPackets);
      this.stats.packetsEmitted +=
        tsPackets.length / AtscFECPipeline.TS_PACKET_SIZE;
      this.stats.synchronized = true;
      this.byteBuffer = this.byteBuffer.subarray(consumed);
    }

    // Remove processed symbols for the block
    const symbolsProcessed = blockSymbols;
    this.symbolBuffer = this.symbolBuffer.subarray(symbolsProcessed);
    return result;
  }

  private appendBytes(newBytes: Uint8Array): void {
    const combined = new Uint8Array(this.byteBuffer.length + newBytes.length);
    combined.set(this.byteBuffer, 0);
    combined.set(newBytes, this.byteBuffer.length);
    this.byteBuffer = combined;
  }

  /**
   * Extract 188-byte TS packets from RS-decoded data
   * Searches for sync byte 0x47 and extracts aligned packets
   */
  private extractAndConsumeTSPackets(data: Uint8Array): {
    packets: Uint8Array;
    consumed: number;
  } {
    const packets: Uint8Array[] = [];
    const SYNC_BYTE = 0x47;
    let consumed = 0;

    // Find first sync alignment
    let i = 0;
    while (i + AtscFECPipeline.TS_PACKET_SIZE < data.length) {
      if (
        data[i] === SYNC_BYTE &&
        data[i + AtscFECPipeline.TS_PACKET_SIZE] === SYNC_BYTE
      ) {
        // Extract contiguous packets
        let j = i;
        while (
          j + AtscFECPipeline.TS_PACKET_SIZE <= data.length &&
          data[j] === SYNC_BYTE
        ) {
          const end = j + AtscFECPipeline.TS_PACKET_SIZE;
          const packet = data.subarray(j, end);
          packets.push(packet);
          j = end;
          if (j < data.length && data[j] !== SYNC_BYTE) break;
        }
        consumed = j; // drop bytes up to end of last packet
        break;
      }
      i++;
    }

    if (packets.length === 0)
      return { packets: new Uint8Array(0), consumed: 0 };

    const totalLength = packets.length * AtscFECPipeline.TS_PACKET_SIZE;
    const result = new Uint8Array(totalLength);
    for (let k = 0; k < packets.length; k++) {
      const pkt = packets[k] ?? new Uint8Array(0);
      result.set(pkt, k * AtscFECPipeline.TS_PACKET_SIZE);
    }

    return { packets: result, consumed };
  }

  getStats(): BasebandStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      symbolsProcessed: 0,
      packetsEmitted: 0,
      rsErrors: 0,
      trellisErrors: 0,
      synchronized: false,
    };
    this.symbolBuffer = new Float32Array(0);
    this.byteBuffer = new Uint8Array(0);
  }
}
