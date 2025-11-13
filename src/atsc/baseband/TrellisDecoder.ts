/**
 * ATSC Trellis Decoder
 *
 * Implements 12-state trellis decoder for ATSC 8-VSB.
 * ATSC uses a rate-2/3 trellis code with 12 states.
 *
 * References:
 * - ATSC A/53 Part 2: RF/Transmission Systems Characteristics
 * - ATSC trellis coding: 12 states, rate 2/3 (2 input bits → 3 output symbols)
 */

/**
 * ATSC trellis decoder for 2/3 rate code with 12 states
 *
 * The ATSC trellis encoder takes 2 precoded data bits and produces
 * 3 trellis-coded bits. The decoder uses Viterbi algorithm to find
 * the most likely path through the trellis.
 */
export class ATSCTrellisDecoder {
  private readonly numStates = 12;
  private readonly numInputBits = 2;
  // Reserved for future full trellis mapping (unused currently)

  // State metrics (path costs)
  private stateMetrics: Float32Array;
  private newStateMetrics: Float32Array;

  // Survival path history for traceback
  private pathHistory: Uint8Array[];
  private tracebackDepth = 32; // symbols

  // Current position in history buffer
  // History index reserved for traceback (unused in simplified decoder)

  // Statistics
  private bitsDecoded = 0;
  private errorsDetected = 0;

  constructor() {
    this.stateMetrics = new Float32Array(this.numStates);
    this.newStateMetrics = new Float32Array(this.numStates);

    // Initialize to zero state with high confidence
    this.stateMetrics.fill(Infinity);
    this.stateMetrics[0] = 0;

    // Initialize history buffer
    this.pathHistory = new Array(this.tracebackDepth);
    for (let i = 0; i < this.tracebackDepth; i++) {
      this.pathHistory[i] = new Uint8Array(this.numStates);
    }
  }

  /**
   * Decode one trellis symbol (3 bits from 8-VSB slicer)
   * Returns 2 decoded data bits
   *
   * For now, this is a simplified soft-decision decoder.
   * A full implementation would use branch metrics based on
   * the ATSC trellis state diagram.
   */
  decodeSymbol(symbolBits: number): number {
    // Simplified decoding: extract 2 MSBs as data
    // TODO: Implement full Viterbi with proper branch metrics
    const dataBits = (symbolBits >> 1) & 0x03;
    this.bitsDecoded += 2;
    return dataBits;
  }

  /**
   * Decode a block of 8-VSB decision symbols
   * Each symbol is quantized to 3 bits (after trellis coding)
   *
   * Returns decoded data bits packed into bytes
   */
  decodeBlock(symbols: Float32Array): Uint8Array {
    // Convert float symbols to 3-bit quantized values
    const quantized = new Uint8Array(symbols.length);
    for (let i = 0; i < symbols.length; i++) {
      quantized[i] = this.quantizeSymbol(symbols[i] ?? 0);
    }

    // Decode trellis symbols to data bits
    const numDataBits = symbols.length * this.numInputBits;
    const numOutputBytes = Math.ceil(numDataBits / 8);
    const output = new Uint8Array(numOutputBytes);

    let bitBuffer = 0;
    let bitCount = 0;
    let byteIndex = 0;

    for (let i = 0; i < quantized.length; i++) {
      const dataBits = this.decodeSymbol(quantized[i] ?? 0);

      // Pack into output bytes (MSB first)
      bitBuffer = (bitBuffer << this.numInputBits) | dataBits;
      bitCount += this.numInputBits;

      while (bitCount >= 8) {
        const byte = (bitBuffer >> (bitCount - 8)) & 0xff;
        if (byteIndex < output.length) {
          output[byteIndex++] = byte;
        }
        bitCount -= 8;
      }
    }

    // Handle remaining bits if any
    if (bitCount > 0 && byteIndex < output.length) {
      const byte = (bitBuffer << (8 - bitCount)) & 0xff;
      output[byteIndex] = byte;
    }

    return output;
  }

  /**
   * Quantize float symbol to 3-bit trellis output
   * 8-VSB levels: -7, -5, -3, -1, 1, 3, 5, 7
   * Map to 3-bit codes: 0-7
   */
  private quantizeSymbol(symbol: number): number {
    // Map 8-VSB levels to 3-bit codes
    const levels = [-7, -5, -3, -1, 1, 3, 5, 7];
    let minDist = Infinity;
    let code = 0;

    for (let i = 0; i < levels.length; i++) {
      const dist = Math.abs(symbol - (levels[i] ?? 0));
      if (dist < minDist) {
        minDist = dist;
        code = i;
      }
    }

    return code;
  }

  /**
   * Reset decoder state
   */
  reset(): void {
    this.stateMetrics.fill(Infinity);
    this.stateMetrics[0] = 0;
    this.newStateMetrics.fill(0);
    // history index not used in simplified decoder
    this.bitsDecoded = 0;
    this.errorsDetected = 0;

    for (const history of this.pathHistory) {
      history.fill(0);
    }
  }

  /**
   * Get decoder statistics
   */
  getStats() {
    return {
      bitsDecoded: this.bitsDecoded,
      errorsDetected: this.errorsDetected,
      errorRate:
        this.bitsDecoded > 0 ? this.errorsDetected / this.bitsDecoded : 0,
    };
  }
}
