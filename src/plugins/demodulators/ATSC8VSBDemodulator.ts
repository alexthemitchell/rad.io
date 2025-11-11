/**
 * ATSC 8-VSB Demodulator Plugin
 *
 * Implementation of ATSC 8-VSB (8-level Vestigial Sideband) demodulator
 * for processing digital television signals.
 *
 * Technical Specifications:
 * - Symbol rate: 10.76 Msymbols/sec
 * - 8-VSB modulation (8 amplitude levels)
 * - 6 MHz channel bandwidth
 * - Pilot tone at 309.44 kHz offset from lower band edge
 * - Data segment: 832 symbols (4-symbol sync + 828 data)
 * - Field sync: Every 313 data segments
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  DemodulatorPlugin,
  DemodulatorParameters,
  PluginConfigSchema,
  PluginMetadata,
} from "../../types/plugin";

/**
 * ATSC 8-VSB symbol levels (normalized)
 */
const VSB_LEVELS = [-7, -5, -3, -1, 1, 3, 5, 7];

/**
 * ATSC constants
 */
const SYMBOL_RATE = 10.76e6; // 10.76 Msymbols/sec
const PILOT_FREQUENCY = 309440; // 309.44 kHz offset
const SEGMENT_LENGTH = 832; // symbols per segment
const SEGMENT_SYNC_LENGTH = 4; // sync symbols at start of segment
const FIELD_SYNC_SEGMENTS = 313; // segments per field
const CHANNEL_BANDWIDTH = 6e6; // 6 MHz

/**
 * Data segment sync pattern (4 symbols)
 */
const SEGMENT_SYNC_PATTERN = [5, -5, -5, 5]; // +1, -1, -1, +1 in normalized form

/**
 * Gardner timing error detector state
 */
interface GardnerDetectorState {
  previousSample: number;
  previousMidpoint: number;
}

/**
 * Equalizer tap state
 */
interface EqualizerState {
  taps: Float32Array;
  numTaps: number;
  stepSize: number;
}

/**
 * ATSC 8-VSB Demodulator Plugin
 */
export class ATSC8VSBDemodulator
  extends BasePlugin
  implements DemodulatorPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEMODULATOR };
  private parameters: DemodulatorParameters;

  // Pilot tone recovery
  private pilotPhase: number;
  private pilotFrequencyOffset: number;
  private pllAlpha: number;
  private pllBeta: number;

  // Symbol timing recovery
  private symbolPhase: number;
  private samplesPerSymbol: number;
  private timingError: number;
  private gardnerState: GardnerDetectorState;
  private timingLoopGain: number;

  // Equalizer
  private equalizer: EqualizerState;

  // Sync detection
  private segmentSyncCount: number;
  private fieldSyncCount: number;
  private syncLocked: boolean;

  // Demodulated data buffer
  private symbolBuffer: number[];

  constructor() {
    const metadata: PluginMetadata = {
      id: "atsc-8vsb-demodulator",
      name: "ATSC 8-VSB Demodulator",
      version: "1.0.0",
      author: "rad.io",
      description:
        "ATSC 8-VSB demodulator for digital television signals (HDTV)",
      type: PluginType.DEMODULATOR,
    };

    super(metadata);

    this.parameters = {
      audioSampleRate: SYMBOL_RATE,
      bandwidth: CHANNEL_BANDWIDTH,
      squelch: 0,
      afcEnabled: true,
    };

    // Initialize state
    this.pilotPhase = 0;
    this.pilotFrequencyOffset = 0;
    this.pllAlpha = 0.01;
    this.pllBeta = 0.0001;

    this.symbolPhase = 0;
    this.samplesPerSymbol = 1;
    this.timingError = 0;
    this.gardnerState = {
      previousSample: 0,
      previousMidpoint: 0,
    };
    this.timingLoopGain = 0.01;

    // Initialize equalizer with 64 taps
    this.equalizer = {
      taps: new Float32Array(64),
      numTaps: 64,
      stepSize: 0.001,
    };
    // Set center tap to 1, others to 0
    this.equalizer.taps[32] = 1.0;

    this.segmentSyncCount = 0;
    this.fieldSyncCount = 0;
    this.syncLocked = false;

    this.symbolBuffer = [];
  }

  protected onInitialize(): void {
    this.resetState();
  }

  protected async onActivate(): Promise<void> {
    // Start demodulation
  }

  protected onDeactivate(): void {
    this.resetState();
  }

  protected onDispose(): void {
    // Clean up resources
    this.symbolBuffer = [];
  }

  /**
   * Reset all demodulator state
   */
  private resetState(): void {
    this.pilotPhase = 0;
    this.pilotFrequencyOffset = 0;
    this.symbolPhase = 0;
    this.timingError = 0;
    this.gardnerState = {
      previousSample: 0,
      previousMidpoint: 0,
    };
    this.segmentSyncCount = 0;
    this.fieldSyncCount = 0;
    this.syncLocked = false;
    this.symbolBuffer = [];

    // Reset equalizer
    this.equalizer.taps.fill(0);
    this.equalizer.taps[32] = 1.0;
  }

  /**
   * Extract and track pilot tone at 309.44 kHz offset
   */
  private recoverPilot(samples: IQSample[], sampleRate: number): IQSample[] {
    const corrected: IQSample[] = new Array<IQSample>(samples.length);
    const phaseIncrement = (2 * Math.PI * PILOT_FREQUENCY) / sampleRate;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        corrected[i] = { I: 0, Q: 0 };
        continue;
      }

      // Rotate by negative pilot frequency to center the signal
      const cos = Math.cos(-this.pilotPhase);
      const sin = Math.sin(-this.pilotPhase);

      corrected[i] = {
        I: sample.I * cos - sample.Q * sin,
        Q: sample.I * sin + sample.Q * cos,
      };

      // Phase-locked loop to track pilot
      // Error signal: imaginary part of complex correlation
      const error = corrected[i].Q;

      // Update frequency offset and phase
      this.pilotFrequencyOffset += this.pllBeta * error;
      this.pilotPhase +=
        phaseIncrement + this.pilotFrequencyOffset + this.pllAlpha * error;

      // Wrap phase
      while (this.pilotPhase > Math.PI) this.pilotPhase -= 2 * Math.PI;
      while (this.pilotPhase < -Math.PI) this.pilotPhase += 2 * Math.PI;
    }

    return corrected;
  }

  /**
   * Apply adaptive equalizer for multipath correction
   */
  private equalize(sample: number): number {
    // Shift samples through delay line (conceptually)
    // For simplicity, we'll use a direct convolution approach

    let output = 0;
    const halfTaps = Math.floor(this.equalizer.numTaps / 2);

    // Convolve with equalizer taps (simplified - in practice would maintain delay line)
    output = sample * this.equalizer.taps[halfTaps];

    return output;
  }

  /**
   * Update equalizer taps using LMS algorithm
   */
  private updateEqualizer(input: number, output: number, error: number): void {
    const halfTaps = Math.floor(this.equalizer.numTaps / 2);

    // LMS update: taps = taps + stepSize * error * input
    const currentTap = this.equalizer.taps[halfTaps] ?? 0;
    this.equalizer.taps[halfTaps] =
      currentTap + this.equalizer.stepSize * error * input;
  }

  /**
   * Symbol timing recovery using Gardner algorithm
   */
  private recoverTiming(
    samples: number[],
    sampleRate: number,
  ): { symbols: number[]; samplesPerSymbol: number } {
    const symbols: number[] = [];
    this.samplesPerSymbol = sampleRate / SYMBOL_RATE;

    let sampleIndex = 0;

    while (sampleIndex < samples.length) {
      // Interpolate sample at symbol boundary
      const intPart = Math.floor(sampleIndex);
      const fracPart = sampleIndex - intPart;

      if (intPart >= samples.length - 1) break;

      // Linear interpolation
      const currentSample =
        samples[intPart] * (1 - fracPart) + samples[intPart + 1] * fracPart;

      // Gardner timing error detector
      // Error = (current - previous) * midpoint
      const midpointIndex = sampleIndex - this.samplesPerSymbol / 2;
      const midpointIntPart = Math.floor(midpointIndex);
      const midpointFracPart = midpointIndex - midpointIntPart;

      let midpointSample = 0;
      if (
        midpointIntPart >= 0 &&
        midpointIntPart < samples.length - 1 &&
        midpointIndex >= 0
      ) {
        midpointSample =
          samples[midpointIntPart] * (1 - midpointFracPart) +
          samples[midpointIntPart + 1] * midpointFracPart;
      }

      const timingError =
        (currentSample - this.gardnerState.previousSample) *
        this.gardnerState.previousMidpoint;

      // Update symbol phase based on timing error
      this.symbolPhase += this.timingLoopGain * timingError;

      // Clamp symbol phase to prevent runaway
      this.symbolPhase = Math.max(-0.5, Math.min(0.5, this.symbolPhase));

      // Store for next iteration
      this.gardnerState.previousSample = currentSample;
      this.gardnerState.previousMidpoint = midpointSample;

      symbols.push(currentSample);

      // Advance to next symbol (ensure we always move forward)
      const advance = this.samplesPerSymbol + this.symbolPhase;
      sampleIndex += Math.max(0.1, advance);
    }

    return { symbols, samplesPerSymbol: this.samplesPerSymbol };
  }

  /**
   * Detect 8-VSB symbol levels
   */
  private slicerDecision(sample: number): number {
    // Find closest VSB level
    let minDistance = Infinity;
    let closestLevel = VSB_LEVELS[0];

    for (const level of VSB_LEVELS) {
      const distance = Math.abs(sample - level);
      if (distance < minDistance) {
        minDistance = distance;
        closestLevel = level;
      }
    }

    return closestLevel;
  }

  /**
   * Detect data segment sync pattern
   */
  private detectSegmentSync(symbols: number[]): boolean {
    if (symbols.length < SEGMENT_SYNC_LENGTH) {
      return false;
    }

    // Check if the first 4 symbols match the sync pattern
    let matches = 0;
    for (let i = 0; i < SEGMENT_SYNC_LENGTH; i++) {
      const decision = this.slicerDecision(symbols[i]);
      if (decision === SEGMENT_SYNC_PATTERN[i]) {
        matches++;
      }
    }

    return matches >= 3; // Allow for 1 error
  }

  /**
   * Detect field sync
   */
  private detectFieldSync(): boolean {
    // Field sync occurs every 313 segments
    if (this.segmentSyncCount >= FIELD_SYNC_SEGMENTS) {
      this.segmentSyncCount = 0;
      this.fieldSyncCount++;
      return true;
    }
    return false;
  }

  /**
   * Demodulate IQ samples to 8-VSB symbols
   */
  demodulate(samples: IQSample[]): Float32Array {
    if (samples.length === 0) {
      return new Float32Array(0);
    }

    // Assume sample rate matches symbol rate for simplicity
    const sampleRate = this.parameters.audioSampleRate || SYMBOL_RATE;

    // Step 1: Pilot tone recovery and carrier correction
    const carrierCorrected = this.recoverPilot(samples, sampleRate);

    // Step 2: Extract real part (VSB is primarily in I channel)
    const realSamples = carrierCorrected.map((s) => s.I);

    // Step 3: Symbol timing recovery
    const { symbols } = this.recoverTiming(realSamples, sampleRate);

    // Step 4: Equalization and symbol slicing
    const output = new Float32Array(symbols.length);

    for (let i = 0; i < symbols.length; i++) {
      // Apply equalizer
      const equalized = this.equalize(symbols[i]);

      // Slicer decision
      const decided = this.slicerDecision(equalized);

      // Update equalizer (LMS algorithm)
      const error = equalized - decided;
      this.updateEqualizer(symbols[i], equalized, error);

      output[i] = decided;

      // Add to symbol buffer for sync detection
      this.symbolBuffer.push(decided);

      // Limit buffer size to prevent unbounded growth
      if (this.symbolBuffer.length > SEGMENT_LENGTH * 4) {
        this.symbolBuffer = this.symbolBuffer.slice(-SEGMENT_LENGTH * 2);
      }
    }

    // Step 5: Sync detection
    if (this.symbolBuffer.length >= SEGMENT_SYNC_LENGTH) {
      const syncDetected = this.detectSegmentSync(
        this.symbolBuffer.slice(-SEGMENT_SYNC_LENGTH),
      );
      if (syncDetected) {
        this.segmentSyncCount++;
        this.syncLocked = true;
        this.detectFieldSync();

        // Keep only recent symbols
        if (this.symbolBuffer.length > SEGMENT_LENGTH * 2) {
          this.symbolBuffer = this.symbolBuffer.slice(-SEGMENT_LENGTH);
        }
      }
    }

    return output;
  }

  /**
   * Get supported modulation modes
   */
  getSupportedModes(): string[] {
    return ["8vsb"];
  }

  /**
   * Set demodulation mode
   */
  setMode(mode: string): void {
    if (!this.getSupportedModes().includes(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }
    // Only 8-VSB is supported
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

    // Update internal state based on parameters
    if (params.audioSampleRate) {
      this.samplesPerSymbol = params.audioSampleRate / SYMBOL_RATE;
    }
  }

  /**
   * Get sync lock status
   */
  isSyncLocked(): boolean {
    return this.syncLocked;
  }

  /**
   * Get segment sync count
   */
  getSegmentSyncCount(): number {
    return this.segmentSyncCount;
  }

  /**
   * Get field sync count
   */
  getFieldSyncCount(): number {
    return this.fieldSyncCount;
  }

  /**
   * Get plugin configuration schema
   */
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        mode: {
          type: "string" as const,
          description: "Demodulation mode (8-VSB)",
          enum: ["8vsb"],
          default: "8vsb",
        },
        bandwidth: {
          type: "number" as const,
          description: "Channel bandwidth in Hz",
          minimum: 5000000,
          maximum: 7000000,
          default: CHANNEL_BANDWIDTH,
        },
        squelch: {
          type: "number" as const,
          description: "Squelch threshold (0-100)",
          minimum: 0,
          maximum: 100,
          default: 0,
        },
        afcEnabled: {
          type: "boolean" as const,
          description: "Enable automatic frequency control",
          default: true,
        },
      },
      required: ["mode"],
    };
  }
}
