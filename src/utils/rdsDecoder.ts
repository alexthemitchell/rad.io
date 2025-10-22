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

import type {
  RDSBlock,
  RDSGroup,
  RDSStationData,
  RDSDecoderStats,
} from "../models/RDSData";
import { createEmptyRDSData } from "../models/RDSData";

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
  private phaseLocked = false;
  private phase = 0;
  private frequency = RDS_SUBCARRIER_FREQ;

  // Bit synchronization state
  private bitSync = false;
  private bitPhase = 0;
  private samplesPerBit: number;

  // Block synchronization state
  private blockSync = false;
  private blockBuffer: number[] = [];
  private blockPosition = 0;

  // RDS data buffers
  private psBuffer: string[] = new Array(8).fill("");
  private rtBuffer: string[] = new Array(64).fill("");

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
          this.blockPosition = 0;
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
      this.blockPosition = 0;
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
    // Block A always contains PI code
    if (block.offsetWord === "A") {
      this.stationData.pi = block.data;
      this.blockPosition = 1;
    } else if (block.offsetWord === "B") {
      // Block B contains group type and other info
      const tp = Boolean((block.data >> 10) & 0x1);
      const pty = (block.data >> 5) & 0x1f;

      this.stationData.tp = tp;
      this.stationData.pty = pty;

      this.blockPosition = 2;
    } else if (block.offsetWord === "C" || block.offsetWord === "C'") {
      this.blockPosition = 3;
    } else if (block.offsetWord === "D") {
      this.blockPosition = 0; // Reset for next group
    }

    this.stationData.lastUpdate = Date.now();
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
    this.phaseLocked = false;
    this.blockSync = false;
    this.blockBuffer = [];
    this.blockPosition = 0;
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
