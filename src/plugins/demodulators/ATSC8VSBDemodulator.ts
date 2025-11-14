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
import { useStore } from "../../store";
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
const VSB_LEVELS = [-7, -5, -3, -1, 1, 3, 5, 7] as const;

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
 * Uses actual 8-VSB symbol levels from the VSB_LEVELS array
 */
const SEGMENT_SYNC_PATTERN = [5, -5, -5, 5];

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
  delayLine: Float32Array;
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
  private gardnerState: GardnerDetectorState;
  private timingLoopGain: number;

  // Equalizer
  private equalizer: EqualizerState;

  // Sync detection
  private segmentSyncCount: number;
  private fieldSyncCount: number;
  private syncLocked: boolean;
  private lastSyncPosition: number; // Track position of last detected sync

  // Demodulated data buffer
  private symbolBuffer: number[];

  // Diagnostics
  private lastDiagnosticsUpdate: number;
  private diagnosticsUpdateInterval: number;
  private previousSyncLocked: boolean; // Track previous sync state for transition detection
  private startupMessageSent: boolean; // Track if startup message has been sent

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
      delayLine: new Float32Array(64),
    };
    // Set center tap to 1, others to 0 (initial state)
    this.equalizer.taps[32] = 1.0;

    this.segmentSyncCount = 0;
    this.fieldSyncCount = 0;
    this.syncLocked = false;
    this.lastSyncPosition = -1; // -1 means no sync found yet

    this.symbolBuffer = [];

    this.lastDiagnosticsUpdate = 0;
    this.diagnosticsUpdateInterval = 500; // Update diagnostics every 500ms
    this.previousSyncLocked = false;
    this.startupMessageSent = false;
  }

  protected onInitialize(): void {
    this.resetState();
  }

  protected onActivate(): void {
    // Start demodulation
    try {
      const store = useStore.getState();
      store.addDiagnosticEvent({
        source: "demodulator",
        severity: "info",
        message: "ATSC 8-VSB demodulator activated",
      });
    } catch (_error) {
      // Silently fail if store is not available
    }
  }

  protected onDeactivate(): void {
    this.resetState();
    try {
      const store = useStore.getState();
      store.addDiagnosticEvent({
        source: "demodulator",
        severity: "info",
        message: "ATSC 8-VSB demodulator deactivated",
      });
    } catch (_error) {
      // Silently fail if store is not available
    }
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
    this.gardnerState = {
      previousSample: 0,
      previousMidpoint: 0,
    };
    this.segmentSyncCount = 0;
    this.fieldSyncCount = 0;
    this.syncLocked = false;
    this.lastSyncPosition = -1;
    this.symbolBuffer = [];

    // Reset equalizer
    this.equalizer.taps.fill(0);
    this.equalizer.taps[32] = 1.0;
    this.equalizer.delayLine.fill(0);
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
      const error = corrected[i]?.Q ?? 0;

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
   * Implements a full 64-tap FIR filter with delay line
   */
  private equalize(sample: number): number {
    // Shift delay line (move samples through)
    for (let i = this.equalizer.numTaps - 1; i > 0; i--) {
      this.equalizer.delayLine[i] = this.equalizer.delayLine[i - 1] ?? 0;
    }
    this.equalizer.delayLine[0] = sample;

    // Convolve with equalizer taps (FIR filter)
    let output = 0;
    for (let i = 0; i < this.equalizer.numTaps; i++) {
      const tap = this.equalizer.taps[i] ?? 0;
      const delayed = this.equalizer.delayLine[i] ?? 0;
      output += tap * delayed;
    }

    return output;
  }

  /**
   * Update equalizer taps using LMS algorithm
   */
  private updateEqualizer(error: number): void {
    // LMS update: taps[i] = taps[i] + stepSize * error * delayLine[i]
    for (let i = 0; i < this.equalizer.numTaps; i++) {
      const currentTap = this.equalizer.taps[i] ?? 0;
      const delayed = this.equalizer.delayLine[i] ?? 0;
      this.equalizer.taps[i] =
        currentTap + this.equalizer.stepSize * error * delayed;
    }
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
        (samples[intPart] ?? 0) * (1 - fracPart) +
        (samples[intPart + 1] ?? 0) * fracPart;

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
          (samples[midpointIntPart] ?? 0) * (1 - midpointFracPart) +
          (samples[midpointIntPart + 1] ?? 0) * midpointFracPart;
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
      // Minimum advance of 0.1 samples prevents timing loop from stalling or moving backwards
      // if symbolPhase becomes negative enough to offset samplesPerSymbol
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
    let closestLevel: number = VSB_LEVELS[0];

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
   * Searches for sync pattern at proper segment boundaries (every 832 symbols)
   */
  private detectSegmentSync(symbols: number[]): boolean {
    if (symbols.length < SEGMENT_SYNC_LENGTH) {
      return false;
    }

    // If we're not locked, search for sync pattern anywhere
    if (!this.syncLocked) {
      // Search for sync pattern using correlation
      let matches = 0;
      for (let i = 0; i < SEGMENT_SYNC_LENGTH; i++) {
        if (symbols[i] === SEGMENT_SYNC_PATTERN[i]) {
          matches++;
        }
      }
      if (matches >= 3) {
        // Found initial sync - mark the position
        this.lastSyncPosition = this.symbolBuffer.length - SEGMENT_SYNC_LENGTH;
        return true;
      }
      return false;
    } else {
      // Once locked, verify sync appears at expected 832-symbol intervals
      const symbolsSinceLastSync =
        this.symbolBuffer.length - this.lastSyncPosition;

      // Check if we're at the expected sync position (within a small window)
      if (
        symbolsSinceLastSync >= SEGMENT_LENGTH &&
        symbolsSinceLastSync < SEGMENT_LENGTH + SEGMENT_SYNC_LENGTH
      ) {
        let matches = 0;
        for (let i = 0; i < SEGMENT_SYNC_LENGTH; i++) {
          if (i < symbols.length && symbols[i] === SEGMENT_SYNC_PATTERN[i]) {
            matches++;
          }
        }
        if (matches >= 3) {
          // Update last sync position
          this.lastSyncPosition =
            this.symbolBuffer.length - SEGMENT_SYNC_LENGTH;
          return true;
        }
      }
      return false;
    }
  }

  /**
   * Detect field sync
   */
  private detectFieldSync(): boolean {
    // Field sync occurs every 313 segments
    if (this.segmentSyncCount === FIELD_SYNC_SEGMENTS) {
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
      const equalized = this.equalize(symbols[i] ?? 0);

      // Slicer decision
      const decided = this.slicerDecision(equalized);

      // Update equalizer (LMS algorithm)
      const error = equalized - decided;
      this.updateEqualizer(error);

      output[i] = decided;

      // Add to symbol buffer for sync detection
      this.symbolBuffer.push(decided);

      // Limit buffer size to prevent unbounded growth
      if (this.symbolBuffer.length > SEGMENT_LENGTH * 4) {
        const removed = this.symbolBuffer.length - SEGMENT_LENGTH * 2;
        this.symbolBuffer = this.symbolBuffer.slice(-SEGMENT_LENGTH * 2);
        // Adjust lastSyncPosition to account for removed elements
        if (this.lastSyncPosition >= 0) {
          this.lastSyncPosition = Math.max(-1, this.lastSyncPosition - removed);
        }
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
          const removed = this.symbolBuffer.length - SEGMENT_LENGTH;
          this.symbolBuffer = this.symbolBuffer.slice(-SEGMENT_LENGTH);
          // Adjust lastSyncPosition to account for removed elements
          if (this.lastSyncPosition >= 0) {
            this.lastSyncPosition = Math.max(
              -1,
              this.lastSyncPosition - removed,
            );
          }
        }
      }
    }

    // Update diagnostics
    this.updateDiagnostics();

    return output;
  }

  /**
   * Update diagnostics metrics
   */
  private updateDiagnostics(): void {
    const now = Date.now();
    if (now - this.lastDiagnosticsUpdate < this.diagnosticsUpdateInterval) {
      return;
    }

    this.lastDiagnosticsUpdate = now;

    try {
      const store = useStore.getState();

      // Calculate approximate signal quality metrics
      // Note: These are estimated/simulated values. Real implementations would need
      // additional signal processing to calculate accurate SNR, MER, BER
      const signalStrength = this.syncLocked ? 0.8 : 0.3;
      // Use stable simulated values instead of random jitter
      const snr = this.syncLocked ? 18.0 : 5.0; // Stable SNR (placeholder)
      const mer = this.syncLocked ? 22.0 : 10.0; // Stable MER (placeholder)
      const ber = this.syncLocked ? 0.00001 : 0.1; // Stable BER (placeholder)

      store.updateDemodulatorMetrics({
        syncLocked: this.syncLocked,
        signalStrength,
        snr,
        mer,
        ber,
        segmentSyncCount: this.segmentSyncCount,
        fieldSyncCount: this.fieldSyncCount,
      });

      // Add diagnostic events for state transitions
      if (this.previousSyncLocked && !this.syncLocked) {
        // Transition from locked to unlocked
        store.addDiagnosticEvent({
          source: "demodulator",
          severity: "warning",
          message: "Sync lock lost",
        });
      } else if (!this.previousSyncLocked && this.syncLocked) {
        // Transition from unlocked to locked
        store.addDiagnosticEvent({
          source: "demodulator",
          severity: "info",
          message: "Sync lock acquired",
        });
      } else if (!this.syncLocked && this.segmentSyncCount === 0) {
        // Still searching for initial lock (only emit once at startup)
        if (!this.startupMessageSent) {
          store.addDiagnosticEvent({
            source: "demodulator",
            severity: "info",
            message: "Searching for sync lock...",
          });
          this.startupMessageSent = true;
        }
      }

      // Update previous state for next comparison
      this.previousSyncLocked = this.syncLocked;
    } catch (_error) {
      // Silently fail if store is not available
      // This can happen during testing or if component is used standalone
    }
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
    // Note: samplesPerSymbol is recalculated in recoverTiming() based on actual sample rate
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
   * Get equalizer tap coefficients
   */
  getEqualizerTaps(): Float32Array {
    return new Float32Array(this.equalizer.taps);
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
