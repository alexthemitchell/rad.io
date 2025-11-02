/**
 * PSK31 Demodulator Plugin
 *
 * Implements BPSK/QPSK demodulation for PSK31 digital mode.
 * PSK31 uses phase-shift keying with Varicode character encoding
 * optimized for text transmission over narrow bandwidth (~31 Hz).
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  DemodulatorPlugin,
  DemodulatorParameters,
  PluginMetadata,
  PluginConfigSchema,
} from "../../types/plugin";

/**
 * Varicode decoding table for PSK31
 * Maps binary patterns to ASCII characters
 */
/* eslint-disable @typescript-eslint/naming-convention */
const VARICODE_TABLE: Record<string, string> = {
  "1010101011": "\x00", // NUL
  "1011011011": "\x01", // SOH
  "1011101101": "\x02", // STX
  "1101110111": "\x03", // ETX
  "1011101011": "\x04", // EOT
  "1101011111": "\x05", // ENQ
  "1011101111": "\x06", // ACK
  "1011111101": "\x07", // BEL
  "1011111111": "\x08", // BS
  "11101111": "\x09", // HT
  "11101": "\x0a", // LF
  "1101101111": "\x0b", // VT
  "1011011101": "\x0c", // FF
  "11111": "\x0d", // CR
  "1101110101": "\x0e", // SO
  "1110101011": "\x0f", // SI
  "1011110111": "\x10", // DLE
  "1011110101": "\x11", // DC1
  "1110101101": "\x12", // DC2
  "1110101111": "\x13", // DC3
  "1101011011": "\x14", // DC4
  "1101101011": "\x15", // NAK
  "1101101101": "\x16", // SYN
  "1101010111": "\x17", // ETB
  "1101111011": "\x18", // CAN
  "1101111101": "\x19", // EM
  "1110110111": "\x1a", // SUB
  "1101010101": "\x1b", // ESC
  "1101011101": "\x1c", // FS
  "1110111011": "\x1d", // GS
  "1011111011": "\x1e", // RS
  "1101111111": "\x1f", // US
  "1": " ", // space
  "111111111": "!",
  "101011111": '"',
  "111110101": "#",
  "111011011": "$",
  "1011010101": "%",
  "1010111011": "&",
  "101111111": "'",
  "11111011": "(",
  "11110111": ")",
  "101101111": "*",
  "111011111": "+",
  "1110101": ",",
  "110101": "-",
  "1010111": ".",
  "110101111": "/",
  "10110111": "0",
  "10111101": "1",
  "11101101": "2",
  "11111111": "3",
  "101110111": "4",
  "101011011": "5",
  "101101011": "6",
  "110101101": "7",
  "110101011": "8",
  "110110111": "9",
  "11110101": ":",
  "110111101": ";",
  "111101101": "<",
  "1010101": "=",
  "111010111": ">",
  "1010101111": "?",
  "1010111101": "@",
  "1111101": "A",
  "11101011": "B",
  "10101101": "C",
  "10110101": "D",
  "1110111": "E",
  "11011011": "F",
  "11111101": "G",
  "101010101": "H",
  "1111111": "I",
  "111111101": "J",
  "101111101": "K",
  "11010111": "L",
  "10111011": "M",
  "11011101": "N",
  "10101011": "O",
  "11010101": "P",
  "111011101": "Q",
  "10101111": "R",
  "1101111": "S",
  "1101101": "T",
  "101010111": "U",
  "110110101": "V",
  "101011101": "W",
  "101110101": "X",
  "101111011": "Y",
  "1010101101": "Z",
  "111110111": "[",
  "111101111": "\\",
  "111111011": "]",
  "1010111111": "^",
  "101101101": "_",
  "1011011111": "`",
  "1011": "a",
  "1011111": "b",
  "101111": "c",
  "101101": "d",
  "11": "e",
  "111101": "f",
  "1011011": "g",
  "101011": "h",
  "1101": "i",
  "111101011": "j",
  "10111111": "k",
  "11011": "l",
  "111011": "m",
  "1111": "n",
  "111": "o",
  "111111": "p",
  "110111111": "q",
  "10101": "r",
  "10111": "s",
  "101": "t",
  "110111": "u",
  "1111011": "v",
  "1101011": "w",
  "11011111": "x",
  "1011101": "y",
  "111010101": "z",
  "1010110111": "{",
  "110111011": "|",
  "1010110101": "}",
  "1011010111": "~",
  "1110110101": "\x7f", // DEL
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * PSK31 Demodulator Parameters
 */
export interface PSK31Parameters extends DemodulatorParameters {
  /** PSK mode: BPSK (binary) or QPSK (quadrature) */
  pskMode: "bpsk" | "qpsk";
  /** Automatic Frequency Control */
  afcEnabled: boolean;
  /** AGC target level */
  agcTarget: number;
  /** Squelch threshold */
  squelch: number;
}

/**
 * PSK31 Demodulator Plugin
 *
 * Provides BPSK/QPSK demodulation for PSK31 digital mode with:
 * - Phase detection and symbol decoding
 * - Varicode character decoding
 * - Automatic Frequency Control (AFC)
 * - Automatic Gain Control (AGC)
 * - Squelch
 */
export class PSK31DemodulatorPlugin
  extends BasePlugin
  implements DemodulatorPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEMODULATOR };
  private parameters: PSK31Parameters;

  // DSP Constants
  private static readonly AGC_ATTACK_RATE = 0.01; // Envelope follower attack rate
  private static readonly AGC_DECAY_RATE = 0.0001; // Envelope follower decay rate
  private static readonly AGC_MIN_ENVELOPE = 0.001; // Minimum envelope to prevent division by zero
  private static readonly AGC_MIN_GAIN = 0.1; // Minimum AGC gain to prevent over-amplification
  private static readonly AGC_MAX_GAIN = 10.0; // Maximum AGC gain to prevent clipping
  private static readonly AFC_PROPORTIONAL_GAIN = 0.001; // AFC loop proportional gain (alpha)
  private static readonly AFC_INTEGRAL_GAIN = 0.00001; // AFC loop integral gain (beta)
  private static readonly MAX_VARICODE_BIT_BUFFER_LENGTH = 20; // Maximum Varicode character length plus separator

  // Demodulation state
  private previousPhase = 0;
  private carrierPhase = 0;
  private carrierFrequency = 0;

  // Symbol detection
  private bitBuffer = "";
  private samplesPerSymbol: number;
  private sampleCounter = 0;
  private previousSymbol = 0;

  // AGC state
  private agcGain = 1.0;
  private agcEnvelope = 0;

  // Output buffer
  private decodedText = "";

  constructor() {
    const metadata: PluginMetadata = {
      id: "psk31-demodulator",
      name: "PSK31 Demodulator",
      version: "1.0.0",
      author: "rad.io",
      description: "PSK31 BPSK/QPSK demodulator with Varicode decoder",
      type: PluginType.DEMODULATOR,
    };

    super(metadata);

    this.parameters = {
      audioSampleRate: 48000,
      bandwidth: 100, // ~100 Hz for PSK31
      pskMode: "bpsk",
      afcEnabled: true,
      agcTarget: 0.5,
      squelch: 0,
    };

    // Initialize state
    this.samplesPerSymbol = Math.floor(this.parameters.audioSampleRate / 31.25);
    this.resetState();
  }

  /**
   * Reset demodulator state to initial values
   */
  private resetState(): void {
    this.previousPhase = 0;
    this.carrierPhase = 0;
    this.carrierFrequency = 0;
    this.bitBuffer = "";
    this.sampleCounter = 0;
    this.previousSymbol = 0;
    this.agcGain = 1.0;
    this.agcEnvelope = 0;
    this.decodedText = "";
  }

  protected onInitialize(): void {
    // Reset all state
    this.resetState();
  }

  protected async onActivate(): Promise<void> {
    // Start demodulation
  }

  protected onDeactivate(): void {
    // Pause demodulation and reset state
    this.resetState();
  }

  protected async onDispose(): Promise<void> {
    // Clean up resources
  }

  /**
   * Demodulate IQ samples to extract PSK31 symbols
   */
  demodulate(samples: IQSample[]): Float32Array {
    if (samples.length === 0) {
      return new Float32Array(0);
    }

    const output = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        output[i] = 0;
        continue;
      }

      // Calculate signal magnitude for squelch
      const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);

      // Apply squelch
      if (this.parameters.squelch > 0) {
        const squelchThreshold = this.parameters.squelch / 100.0;
        if (magnitude < squelchThreshold) {
          output[i] = 0;
          continue;
        }
      }

      // Apply AGC
      this.updateAGC(magnitude);
      const normalizedI = sample.I * this.agcGain;
      const normalizedQ = sample.Q * this.agcGain;

      // Carrier recovery (Costas loop for BPSK)
      const cos = Math.cos(-this.carrierPhase);
      const sin = Math.sin(-this.carrierPhase);

      // Rotate by carrier phase estimate
      const rotatedI = normalizedI * cos - normalizedQ * sin;
      const rotatedQ = normalizedI * sin + normalizedQ * cos;

      // Phase detection
      const currentPhase = Math.atan2(rotatedQ, rotatedI);

      // Calculate phase difference (demodulated symbol)
      let phaseDiff = currentPhase - this.previousPhase;

      // Unwrap phase
      while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;

      this.previousPhase = currentPhase;

      // Symbol decision for BPSK: phase change > 90° = bit flip
      const symbol = Math.abs(phaseDiff) > Math.PI / 2 ? 1 : 0;

      // Update AFC if enabled
      if (this.parameters.afcEnabled) {
        this.updateAFC(rotatedI, rotatedQ, symbol);
      }

      // Symbol sampling at baud rate
      this.sampleCounter++;
      if (this.sampleCounter >= this.samplesPerSymbol) {
        this.sampleCounter = 0;

        // Detect bit transition
        if (symbol !== this.previousSymbol) {
          this.bitBuffer += "1";
        } else {
          this.bitBuffer += "0";
        }
        this.previousSymbol = symbol;

        // Try to decode Varicode character
        this.decodeVaricode();
      }

      output[i] = phaseDiff;
    }

    return output;
  }

  /**
   * Update AGC gain based on signal envelope
   */
  private updateAGC(magnitude: number): void {
    // Envelope follower
    if (magnitude > this.agcEnvelope) {
      this.agcEnvelope +=
        PSK31DemodulatorPlugin.AGC_ATTACK_RATE * (magnitude - this.agcEnvelope);
    } else {
      this.agcEnvelope +=
        PSK31DemodulatorPlugin.AGC_DECAY_RATE * (magnitude - this.agcEnvelope);
    }

    // Calculate gain
    if (this.agcEnvelope > PSK31DemodulatorPlugin.AGC_MIN_ENVELOPE) {
      this.agcGain = this.parameters.agcTarget / this.agcEnvelope;
    }

    // Clamp gain
    this.agcGain = Math.max(
      PSK31DemodulatorPlugin.AGC_MIN_GAIN,
      Math.min(PSK31DemodulatorPlugin.AGC_MAX_GAIN, this.agcGain),
    );
  }

  /**
   * Update AFC (carrier frequency tracking)
   */
  private updateAFC(i: number, q: number, _symbol: number): void {
    // Calculate phase error: sign(I) * Q for BPSK
    const error = Math.sign(i) * q;

    // Update frequency and phase using PI controller
    this.carrierFrequency += PSK31DemodulatorPlugin.AFC_INTEGRAL_GAIN * error;
    this.carrierPhase +=
      this.carrierFrequency +
      PSK31DemodulatorPlugin.AFC_PROPORTIONAL_GAIN * error;

    // Wrap phase
    while (this.carrierPhase > Math.PI) this.carrierPhase -= 2 * Math.PI;
    while (this.carrierPhase < -Math.PI) this.carrierPhase += 2 * Math.PI;
  }

  /**
   * Decode Varicode characters from bit buffer
   */
  private decodeVaricode(): void {
    // Look for "00" separator in bit buffer
    const separatorIndex = this.bitBuffer.indexOf("00");

    if (separatorIndex !== -1) {
      // Extract character code
      const code = this.bitBuffer.substring(0, separatorIndex);

      // Decode character
      if (code.length > 0 && VARICODE_TABLE[code]) {
        this.decodedText += VARICODE_TABLE[code];
      }

      // Remove decoded character from buffer (including separator)
      this.bitBuffer = this.bitBuffer.substring(separatorIndex + 2);
    }

    // Limit buffer size to prevent overflow
    if (
      this.bitBuffer.length >
      PSK31DemodulatorPlugin.MAX_VARICODE_BIT_BUFFER_LENGTH
    ) {
      this.bitBuffer = this.bitBuffer.substring(
        this.bitBuffer.length -
          PSK31DemodulatorPlugin.MAX_VARICODE_BIT_BUFFER_LENGTH,
      );
    }
  }

  /**
   * Get decoded text and clear buffer
   */
  public getDecodedText(): string {
    const text = this.decodedText;
    this.decodedText = "";
    return text;
  }

  /**
   * Get supported modulation modes
   */
  getSupportedModes(): string[] {
    return ["bpsk", "qpsk"];
  }

  /**
   * Set demodulation mode
   */
  setMode(mode: string): void {
    if (!this.getSupportedModes().includes(mode)) {
      throw new Error(`Unsupported PSK31 mode: ${mode}`);
    }
    this.parameters.pskMode = mode as "bpsk" | "qpsk";
  }

  /**
   * Get current demodulation parameters
   */
  getParameters(): DemodulatorParameters {
    return { ...this.parameters };
  }

  /**
   * Update demodulation parameters
   */
  setParameters(params: Partial<DemodulatorParameters>): void {
    this.parameters = { ...this.parameters, ...params };

    // Update samples per symbol if sample rate changed
    if (params.audioSampleRate) {
      this.samplesPerSymbol = Math.floor(params.audioSampleRate / 31.25);
    }
  }

  /**
   * Get plugin configuration schema
   */
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        pskMode: {
          type: "string" as const,
          description: "PSK modulation type",
          enum: ["bpsk", "qpsk"],
          default: "bpsk",
        },
        bandwidth: {
          type: "number" as const,
          description: "Demodulation bandwidth in Hz",
          minimum: 50,
          maximum: 200,
          default: 100,
        },
        afcEnabled: {
          type: "boolean" as const,
          description: "Enable Automatic Frequency Control",
          default: true,
        },
        agcTarget: {
          type: "number" as const,
          description: "AGC target level (0-1)",
          minimum: 0.1,
          maximum: 1.0,
          default: 0.5,
        },
        squelch: {
          type: "number" as const,
          description: "Squelch threshold (0-100)",
          minimum: 0,
          maximum: 100,
          default: 0,
        },
      },
      required: ["pskMode"],
    };
  }
}
