/**
 * VFO (Variable Frequency Oscillator) Type Definitions
 *
 * Defines interfaces for multi-VFO architecture enabling simultaneous
 * demodulation of multiple signals within a single wideband capture.
 *
 * Related: docs/reference/multi-vfo-architecture.md
 */

import type { DemodulatorPlugin } from "./plugin";

/**
 * Configuration for a single Virtual Frequency Oscillator (VFO)
 */
export interface VfoConfig {
  /**
   * Unique identifier for this VFO
   * Format: UUID v4 or sequential ID (e.g., "vfo-1", "vfo-2")
   */
  id: string;

  /**
   * Center frequency in Hz
   * Constraints:
   * - Must be within current hardware capture bandwidth
   * - Must maintain minimum spacing from other VFOs (mode-dependent)
   * - Must be >= 0
   */
  centerHz: number;

  /**
   * Demodulation mode identifier
   * Must match a registered demodulator plugin ID
   * Examples: "am", "wbfm", "nbfm", "usb", "lsb", "cw", "atsc-8vsb"
   */
  modeId: string;

  /**
   * Demodulation bandwidth in Hz
   * Defines the filter width centered at centerHz
   * Typical values:
   * - AM: 5-10 kHz
   * - NBFM: 12.5 kHz
   * - WBFM: 200 kHz
   * - USB/LSB: 2.4-3 kHz
   * - ATSC: 6 MHz
   */
  bandwidthHz: number;

  /**
   * Audio output enabled
   * When true, demodulated audio is routed to speakers/mixer
   * When false, demodulation occurs but audio is muted (useful for RDS, metrics)
   */
  audioEnabled: boolean;

  /**
   * Optional audio gain (0.0 to 1.0, default: 1.0)
   * Applied after demodulation, before mixing
   */
  audioGain?: number;

  /**
   * Optional squelch threshold (0-100, mode-dependent)
   * Mutes audio when signal strength below threshold
   */
  squelch?: number;

  /**
   * Optional label for UI display
   * Example: "Tower", "FM 91.5", "Repeater Out"
   */
  label?: string;

  /**
   * Optional color for UI visualization
   * CSS color string for spectrum annotations
   */
  color?: string;

  /**
   * Optional stereo panning (-1.0 left, 0.0 center, 1.0 right)
   * Used when multiple VFOs route audio simultaneously
   */
  stereoPan?: number;

  /**
   * Creation timestamp (milliseconds since epoch)
   * Auto-populated on VFO creation
   */
  createdAt?: number;

  /**
   * Optional priority (0-10, default: 5)
   * Higher priority VFOs get more CPU resources under load
   */
  priority?: number;
}

/**
 * Runtime state for an active VFO instance
 * Extends VfoConfig with operational data
 */
export interface VfoState extends VfoConfig {
  /**
   * Current operational status
   */
  status: VfoStatus;

  /**
   * Reference to active demodulator plugin instance
   */
  demodulator: DemodulatorPlugin | null;

  /**
   * Audio output node (Web Audio API)
   * Null when audioEnabled is false
   */
  audioNode: AudioNode | null;

  /**
   * Most recent demodulation metrics
   */
  metrics: VfoMetrics;

  /**
   * Last error message (if status === ERROR)
   */
  error?: string;
}

/**
 * VFO operational status
 */
export enum VfoStatus {
  /** VFO created but demodulator not initialized */
  IDLE = "idle",

  /** Demodulator active, processing samples */
  ACTIVE = "active",

  /** Temporarily paused (e.g., frequency out of range) */
  PAUSED = "paused",

  /** Error occurred, see error field */
  ERROR = "error",
}

/**
 * Real-time VFO performance and signal metrics
 */
export interface VfoMetrics {
  /** Signal strength (RSSI) in dBFS */
  rssi: number;

  /** Signal-to-noise ratio in dB (if available) */
  snr?: number;

  /** Number of samples processed in last batch */
  samplesProcessed: number;

  /** CPU time for last demodulation (ms) */
  processingTime: number;

  /** Demodulator-specific metrics (e.g., RDS lock, ATSC sync) */
  custom?: Record<string, number | string | boolean>;

  /** Timestamp of last metric update */
  timestamp: number;
}

/**
 * Resource usage warning types
 */
export enum VfoResourceWarning {
  /** No resource warnings */
  NONE = "none",

  /** DSP processing time approaching limit */
  DSP_TIME_WARNING = "dsp_time_warning",

  /** DSP processing time critical - automatic action required */
  DSP_TIME_CRITICAL = "dsp_time_critical",

  /** Memory usage high */
  MEMORY_WARNING = "memory_warning",

  /** Too many concurrent audio streams */
  AUDIO_LIMIT = "audio_limit",
}

/**
 * Minimum VFO spacing requirements per modulation mode (Hz)
 * VFOs should maintain this separation to avoid filter overlap
 */
export const MIN_VFO_SPACING_HZ: Record<string, number> = {
  am: 10_000, // 10 kHz
  nbfm: 12_500, // 12.5 kHz (standard channel spacing)
  wbfm: 200_000, // 200 kHz (standard FM broadcast spacing)
  usb: 3_000, // 3 kHz
  lsb: 3_000, // 3 kHz
  cw: 500, // 500 Hz
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "atsc-8vsb": 6_000_000, // 6 MHz
};
