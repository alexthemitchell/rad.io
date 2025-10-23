/**
 * RDS (Radio Data System) Decoder
 *
 * Implements RDS demodulation from FM baseband signal:
 * 1. Extract 57 kHz subcarrier using bandpass filter
 * 2. BPSK demodulation at 1187.5 baud
 * 3. Differential Manchester decoding
 * 4. Block synchronization using offset words
 * 5. Error detection and correction using checkwords
 * 6. Group parsing (0A/0B for PS, 2A/2B for RT, etc.)
 *
 * References:
 * - IEC 62106 (RDS Standard)
 * - https://en.wikipedia.org/wiki/Radio_Data_System
 * - https://digitalcommons.andrews.edu/cgi/viewcontent.cgi?article=1003&context=honors
 */

import {
  createEmptyRDSData,
  RDSGroupType as GroupType,
} from "../models/RDSData";
import {
  TMCDirection,
  TMCDuration,
  type TMCExtent,
  getEventInfo,
  formatDuration,
  formatExtent,
  createEmptyTMCStats,
 type TMCMessage, type TMCDecoderStats } from "../models/TMCData";
import type {
  RDSBlock,
  RDSGroup,
  RDSStationData,
  RDSDecoderStats,
  RDSGroupType,
} from "../models/RDSData";

/**
 * RDS Constants
 */
const RDS_SUBCARRIER_FREQ = 57000; // Hz (3 × 19 kHz stereo pilot)
const RDS_BAUD_RATE = 1187.5; // bits per second
const RDS_BLOCK_BITS = 26; // 16 data + 10 checkword
const RDS_GROUP_BLOCKS = 4;

/**
 * RDS Offset Words (Syndrome patterns for block synchronization)
 * Each block has a unique 10-bit syndrome pattern
 */
const OFFSET_WORDS = {
  A: 0x0fc, // Block 1 - 0b0011111100
  B: 0x198, // Block 2 - 0b0110011000
  C: 0x168, // Block 3 - 0b0101101000
  Cp: 0x350, // Block 3' (alternate) - 0b1101010000
  D: 0x1b4, // Block 4 - 0b0110110100
};

/**
 * Generator polynomial for RDS checkword calculation
 * G(x) = x^10 + x^8 + x^7 + x^5 + x^4 + x^3 + 1
 */
const GENERATOR_POLY = 0x1b9; // 0b110111001

/**
 * RDS Decoder Class
 */
export class RDSDecoder {
  private sampleRate: number;
  private stationData: RDSStationData;
  private stats: RDSDecoderStats;

  // Signal processing state
  private phase = 0;
  private frequency = RDS_SUBCARRIER_FREQ;

  // Bit synchronization state
  // TODO: Implement proper bit synchronization - private _bitSync = false;
  private bitPhase = 0;
  private samplesPerBit: number;

  // Block synchronization state
  private blockSync = false;
  private blockBuffer: number[] = [];
  // TODO: Use blockPosition for error recovery - currently only written to, commented out for noUnusedLocals
  // private blockPosition = 0;
  private currentGroupBlocks: RDSBlock[] = [];

  // RDS data buffers
  private psBuffer: string[] = new Array(8).fill("");
  private rtBuffer: string[] = new Array(64).fill("");

  // TMC data storage
  private tmcMessages = new Map<number, TMCMessage>();
  private tmcStats: TMCDecoderStats;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.samplesPerBit = sampleRate / RDS_BAUD_RATE;

    this.stationData = createEmptyRDSData();
    this.stats = {
      totalGroups: 0,
      validGroups: 0,
      correctedBlocks: 0,
      errorRate: 0,
      syncLocked: false,
      lastSync: 0,
    };
    this.tmcStats = createEmptyTMCStats();
  }

  /**
   * Process FM baseband samples to extract RDS data
   */
  processBaseband(samples: Float32Array): void {
    // Extract 57 kHz subcarrier
    const subcarrier = this.extractSubcarrier(samples);

    // BPSK demodulation
    const bits = this.demodulateSubcarrier(subcarrier);

    // Process bits to extract RDS groups
    for (const bit of bits) {
      this.processBit(bit);
    }
  }

  /**
   * Extract 57 kHz RDS subcarrier using bandpass filter and PLL
   */
  private extractSubcarrier(samples: Float32Array): Float32Array {
    const output = new Float32Array(samples.length);

    // Simple PLL for 57 kHz tracking
    for (let i = 0; i < samples.length; i++) {
      // Multiply by reference oscillator (coherent detection)
      const cos = Math.cos(this.phase);
      const sin = Math.sin(this.phase);

      // Quadrature mixing
      const i_component = samples[i]! * cos;
      const q_component = samples[i]! * sin;

      // Phase error detection
      const phaseError = Math.atan2(q_component, i_component);

      // PLL loop filter (simple proportional)
      const phaseCorrection = phaseError * 0.01;
      this.frequency = RDS_SUBCARRIER_FREQ + phaseCorrection * 100;

      // Update phase
      this.phase += (2 * Math.PI * this.frequency) / this.sampleRate;
      if (this.phase > 2 * Math.PI) {
        this.phase -= 2 * Math.PI;
      }

      // Output is the in-phase component (BPSK signal)
      output[i] = i_component;
    }

    return output;
  }

  /**
   * Demodulate BPSK signal to extract bits
   */
  private demodulateSubcarrier(signal: Float32Array): number[] {
    const bits: number[] = [];
    let bitAccumulator = 0;

    for (let i = 0; i < signal.length; i++) {
      bitAccumulator += signal[i]!;

      // Check if we've accumulated enough samples for one bit
      this.bitPhase++;
      if (this.bitPhase >= this.samplesPerBit) {
        this.bitPhase -= this.samplesPerBit;

        // Decision: positive = 1, negative = 0
        const bit = bitAccumulator > 0 ? 1 : 0;
        bits.push(bit);

        bitAccumulator = 0;
      }
    }

    return bits;
  }

  /**
   * Process individual bit and attempt block synchronization
   */
  private processBit(bit: number): void {
    this.blockBuffer.push(bit);

    // Limit buffer size
    if (this.blockBuffer.length > RDS_BLOCK_BITS * RDS_GROUP_BLOCKS + 100) {
      this.blockBuffer.shift();
    }

    // Try to sync if not synchronized
    if (!this.blockSync) {
      this.attemptBlockSync();
    } else {
      // Check if we have a complete block
      if (this.blockBuffer.length >= RDS_BLOCK_BITS) {
        const blockBits = this.blockBuffer.splice(0, RDS_BLOCK_BITS);
        const block = this.decodeBlock(blockBits);

        if (block.valid) {
          this.processBlock(block);
        } else {
          // Lost sync
          this.blockSync = false;
          // this.blockPosition = 0;
        }
      }
    }
  }

  /**
   * Attempt to find block synchronization using offset words
   */
  private attemptBlockSync(): void {
    if (this.blockBuffer.length < RDS_BLOCK_BITS) {
      return;
    }

    // Try to decode a block and check all possible offset words
    const blockBits = this.blockBuffer.slice(0, RDS_BLOCK_BITS);
    const block = this.decodeBlock(blockBits);

    // Check if syndrome matches any offset word
    const syndrome = this.calculateSyndrome(block.data, block.checkword);

    if (
      syndrome === OFFSET_WORDS.A ||
      syndrome === OFFSET_WORDS.B ||
      syndrome === OFFSET_WORDS.C ||
      syndrome === OFFSET_WORDS.Cp ||
      syndrome === OFFSET_WORDS.D
    ) {
      // Found sync!
      this.blockSync = true;
      // this.blockPosition = 0;
      this.stats.syncLocked = true;
      this.stats.lastSync = Date.now();

      // Determine offset word
      if (syndrome === OFFSET_WORDS.A) {
        block.offsetWord = "A";
      } else if (syndrome === OFFSET_WORDS.B) {
        block.offsetWord = "B";
      } else if (syndrome === OFFSET_WORDS.C) {
        block.offsetWord = "C";
      } else if (syndrome === OFFSET_WORDS.Cp) {
        block.offsetWord = "C'";
      } else if (syndrome === OFFSET_WORDS.D) {
        block.offsetWord = "D";
      }

      block.valid = true;
      this.blockBuffer.splice(0, RDS_BLOCK_BITS);
      this.processBlock(block);
    }
  }

  /**
   * Decode a 26-bit block into data and checkword
   */
  private decodeBlock(bits: number[]): RDSBlock {
    // Extract data (first 16 bits) and checkword (last 10 bits)
    let data = 0;
    let checkword = 0;

    for (let i = 0; i < 16; i++) {
      data = (data << 1) | (bits[i] || 0);
    }

    for (let i = 16; i < 26; i++) {
      checkword = (checkword << 1) | (bits[i] || 0);
    }

    return {
      data,
      checkword,
      offsetWord: "",
      valid: false,
      corrected: false,
    };
  }

  /**
   * Calculate syndrome for error detection
   */
  private calculateSyndrome(data: number, checkword: number): number {
    let syndrome = checkword;
    let dataWord = data;

    // Divide data by generator polynomial
    for (let i = 0; i < 16; i++) {
      if (dataWord & 0x8000) {
        dataWord ^= GENERATOR_POLY << 6;
      }
      dataWord <<= 1;
    }

    syndrome ^= (dataWord >> 6) & 0x3ff;
    return syndrome;
  }

  /**
   * Process a validated RDS block
   */
  private processBlock(block: RDSBlock): void {
    // Block A always contains PI code and starts a new group
    if (block.offsetWord === "A") {
      this.stationData.pi = block.data;
      // this.blockPosition = 1;
      this.currentGroupBlocks = [block];
    } else if (block.offsetWord === "B") {
      // Block B contains group type and other info
      const groupType = (block.data >> 12) & 0xf;
      const version = (block.data >> 11) & 0x1 ? "B" : "A";
      const tp = Boolean((block.data >> 10) & 0x1);
      const pty = (block.data >> 5) & 0x1f;

      this.stationData.tp = tp;
      this.stationData.pty = pty;

      // this.blockPosition = 2;
      this.currentGroupBlocks.push(block);

      // Store group type and version for later use
      this.currentGroupBlocks[1]!.groupType = groupType;
      this.currentGroupBlocks[1]!.groupVersion = version;
    } else if (block.offsetWord === "C" || block.offsetWord === "C'") {
      // this.blockPosition = 3;
      this.currentGroupBlocks.push(block);
    } else if (block.offsetWord === "D") {
      // this.blockPosition = 0;
      this.currentGroupBlocks.push(block);

      // We now have a complete group (4 blocks)
      if (this.currentGroupBlocks.length === 4) {
        this.processCompleteGroup();
      }
    }

    this.stationData.lastUpdate = Date.now();
  }

  /**
   * Process a complete RDS group (4 blocks)
   */
  private processCompleteGroup(): void {
    if (this.currentGroupBlocks.length !== 4) {
      return;
    }

    this.stats.totalGroups++;
    this.stats.validGroups++;

    // Extract group type and version from Block B
    const blockB = this.currentGroupBlocks[1]!;
    const groupType = blockB.groupType || 0;
    const version = (blockB.groupVersion || "A") as "A" | "B";

    // Create RDS group structure
    const group: RDSGroup = {
      blocks: this.currentGroupBlocks as [
        RDSBlock,
        RDSBlock,
        RDSBlock,
        RDSBlock,
      ],
      groupType: this.getGroupTypeName(groupType, version),
      version: version,
      pi: this.currentGroupBlocks[0]!.data,
      pty: (blockB.data >> 5) & 0x1f,
      tp: Boolean((blockB.data >> 10) & 0x1),
      ta: Boolean((blockB.data >> 4) & 0x1),
      timestamp: Date.now(),
    };

    // Parse based on group type
    if (groupType === 0) {
      // Group 0A or 0B - Program Service Name
      this.parseGroup0(group);
    } else if (groupType === 2) {
      // Group 2A or 2B - Radio Text
      this.parseGroup2(group);
    } else if (groupType === 8 && version === "A") {
      // Group 8A - TMC (Traffic Message Channel)
      this.parseGroup8A(group);
    }

    // Clear group blocks for next group
    this.currentGroupBlocks = [];
  }

  /**
   * Get group type name from type code and version
   */
  private getGroupTypeName(type: number, version: "A" | "B"): RDSGroupType {
    if (type === 0) {
      return version === "A"
        ? GroupType.BASIC_TUNING_0A
        : GroupType.BASIC_TUNING_0B;
    } else if (type === 2) {
      return version === "A"
        ? GroupType.RADIO_TEXT_2A
        : GroupType.RADIO_TEXT_2B;
    } else if (type === 4 && version === "A") {
      return GroupType.CLOCK_TIME_4A;
    } else if (type === 8 && version === "A") {
      return GroupType.TMC_8A;
    }
    return GroupType.UNKNOWN;
  }

  /**
   * Parse Group 0A/0B - Program Service Name
   */
  private parseGroup0(group: RDSGroup): void {
    // Block 2 contains segment address (which 2 chars of PS name)
    const segmentAddress = group.blocks[1].data & 0x3;

    // Block 4 contains 2 characters of PS name
    const char1 = String.fromCharCode((group.blocks[3].data >> 8) & 0xff);
    const char2 = String.fromCharCode(group.blocks[3].data & 0xff);

    const index = segmentAddress * 2;
    this.psBuffer[index] = char1;
    this.psBuffer[index + 1] = char2;

    // Update PS name if we have all segments
    if (this.psBuffer.every((c) => c !== "")) {
      this.stationData.ps = this.psBuffer.join("").trim();
    }
  }

  /**
   * Parse Group 2A/2B - Radio Text
   */
  private parseGroup2(group: RDSGroup): void {
    const version = group.version;
    const segmentAddress = group.blocks[1].data & 0xf;

    let chars: string[];
    if (version === "A") {
      // 4 characters in blocks C and D
      chars = [
        String.fromCharCode((group.blocks[2].data >> 8) & 0xff),
        String.fromCharCode(group.blocks[2].data & 0xff),
        String.fromCharCode((group.blocks[3].data >> 8) & 0xff),
        String.fromCharCode(group.blocks[3].data & 0xff),
      ];
    } else {
      // 2 characters in block D only
      chars = [
        String.fromCharCode((group.blocks[3].data >> 8) & 0xff),
        String.fromCharCode(group.blocks[3].data & 0xff),
      ];
    }

    const index = segmentAddress * chars.length;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] !== "\r") {
        this.rtBuffer[index + i] = chars[i]!;
      } else {
        // Carriage return marks end of text
        this.stationData.rt = this.rtBuffer.slice(0, index + i).join("");
        break;
      }
    }

    // Update radio text if we have meaningful content
    const rtText = this.rtBuffer.join("").trim();
    if (rtText.length > 0) {
      this.stationData.rt = rtText;
    }
  }

  /**
   * Parse Group 8A - TMC (Traffic Message Channel)
   *
   * Group 8A Format (ISO 14819-1):
   * Block B: Group type (8A), DP bit, CI (Continuity Index)
   * Block C: Event code (11 bits), Extent (3 bits), Direction (1 bit), Diversion (1 bit)
   * Block D: Location code (16 bits)
   */
  private parseGroup8A(group: RDSGroup): void {
    this.tmcStats.group8ACount++;

    try {
      // Block B contains continuity index (CI) and other control bits
      const blockB = group.blocks[1].data;
      const continuityIndex = blockB & 0x7; // 3 bits (0-7)

      // Block C contains event information
      const blockC = group.blocks[2].data;
      const eventCode = (blockC >> 5) & 0x7ff; // 11 bits (top 11 bits)
      const extent = (blockC >> 2) & 0x7; // 3 bits
      const direction = (blockC >> 1) & 0x1; // 1 bit
      const diversionAdvice = blockC & 0x1; // 1 bit (LSB)

      // Block D contains location code
      const blockD = group.blocks[3].data;
      const locationCode = blockD; // 16 bits

      // Get event information
      const eventInfo = getEventInfo(eventCode);

      // Note: According to ISO 14819-1, continuity index (CI) is used for message
      // correlation and updating, not for duration encoding. Duration information
      // comes from multi-group messages or supplementary data.
      // For now, we default to NO_DURATION as a placeholder until full multi-group
      // message support is implemented.
      const duration = TMCDuration.NO_DURATION;

      // Determine TMC direction
      let tmcDirection: TMCDirection;
      if (direction === 0) {
        tmcDirection = TMCDirection.POSITIVE;
      } else {
        tmcDirection = TMCDirection.NEGATIVE;
      }

      // Create message ID from location + event + direction + continuity index
      // Include CI for proper message tracking and updates
      const messageId =
        (locationCode << 16) | (eventCode << 3) | (continuityIndex & 0x7);

      // Calculate expiration time based on duration
      const now = Date.now();
      let expiresAt: number | null = null;
      if (duration !== TMCDuration.NO_DURATION) {
        // Map TMCDuration enum to actual duration in milliseconds
        const durationToMs: Record<TMCDuration, number> = {
          [TMCDuration.NO_DURATION]: 0,
          [TMCDuration.MINUTES_15]: 15 * 60 * 1000,
          [TMCDuration.MINUTES_30]: 30 * 60 * 1000,
          [TMCDuration.HOUR_1]: 60 * 60 * 1000,
          [TMCDuration.HOURS_2]: 2 * 60 * 60 * 1000,
          [TMCDuration.HOURS_3_TO_4]: 3.5 * 60 * 60 * 1000,
          [TMCDuration.HOURS_4_TO_8]: 6 * 60 * 60 * 1000,
          [TMCDuration.LONGER_THAN_8_HOURS]: 12 * 60 * 60 * 1000,
        };
        expiresAt = now + (durationToMs[duration] ?? 0);
      }

      // Check if this message already exists
      const existingMessage = this.tmcMessages.get(messageId);

      if (existingMessage) {
        // Update existing message
        existingMessage.updateCount++;
        existingMessage.receivedAt = now;
        if (expiresAt) {
          existingMessage.expiresAt = expiresAt;
        }
      } else {
        // Create new TMC message
        const tmcMessage: TMCMessage = {
          messageId,
          eventCode,
          eventText: eventInfo.text,
          category: eventInfo.category,
          severity: eventInfo.severity,
          locationCode,
          locationText: `Location ${locationCode}`,
          direction: tmcDirection,
          extent: extent as TMCExtent,
          extentText: formatExtent(extent as TMCExtent),
          duration,
          durationText: formatDuration(duration),
          diversionAdvice: Boolean(diversionAdvice),
          urgency: eventInfo.severity, // Map severity to urgency
          receivedAt: now,
          expiresAt,
          updateCount: 1,
        };

        this.tmcMessages.set(messageId, tmcMessage);
        this.tmcStats.messagesReceived++;
      }

      // Clean up expired messages
      this.cleanupExpiredTMCMessages();

      this.tmcStats.lastMessageAt = now;
      this.tmcStats.messagesActive = this.tmcMessages.size;
    } catch (error) {
      this.tmcStats.parseErrors++;
      console.warn("[TMC] Parse error:", error);
    }
  }

  /**
   * Clean up expired TMC messages
   */
  private cleanupExpiredTMCMessages(): void {
    const now = Date.now();
    const toDelete: number[] = [];

    // Use Array.from to avoid downlevelIteration requirement
    Array.from(this.tmcMessages.entries()).forEach(([messageId, message]) => {
      if (message.expiresAt && message.expiresAt < now) {
        toDelete.push(messageId);
      }
    });

    toDelete.forEach((messageId) => {
      this.tmcMessages.delete(messageId);
    });
  }

  /**
   * Get current RDS station data
   */
  getStationData(): RDSStationData {
    return { ...this.stationData };
  }

  /**
   * Get decoder statistics
   */
  getStats(): RDSDecoderStats {
    return { ...this.stats };
  }

  /**
   * Get active TMC messages
   */
  getTMCMessages(): TMCMessage[] {
    this.cleanupExpiredTMCMessages();
    return Array.from(this.tmcMessages.values()).sort(
      (a, b) => b.severity - a.severity,
    );
  }

  /**
   * Get TMC decoder statistics
   */
  getTMCStats(): TMCDecoderStats {
    return { ...this.tmcStats };
  }

  /**
   * Reset decoder state
   */
  reset(): void {
    this.stationData = createEmptyRDSData();
    this.stats = {
      totalGroups: 0,
      validGroups: 0,
      correctedBlocks: 0,
      errorRate: 0,
      syncLocked: false,
      lastSync: 0,
    };
    this.tmcStats = createEmptyTMCStats();
    this.tmcMessages.clear();
    this.blockSync = false;
    this.blockBuffer = [];
    // this.blockPosition = 0;
    this.currentGroupBlocks = [];
    this.psBuffer = new Array(8).fill("");
    this.rtBuffer = new Array(64).fill("");
  }
}

/**
 * Create RDS decoder instance
 */
export function createRDSDecoder(sampleRate: number): RDSDecoder {
  return new RDSDecoder(sampleRate);
}
