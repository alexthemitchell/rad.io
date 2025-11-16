/**
 * Diagnostics Slice
 *
 * Persistence: None (ephemeral, runtime-only)
 * Scope: Application-wide (Zustand store)
 * Expiration: Cleared on page reload
 *
 * Centralized event bus for runtime diagnostics and health metrics
 * across the signal pipeline (demodulator, TS parser, decoders).
 *
 * These are runtime-only performance metrics that don't need persistence.
 *
 * Related: See ARCHITECTURE.md "State & Persistence" section for storage pattern guidance
 */

import { type StateCreator } from "zustand";

/**
 * Diagnostic event severity levels
 */
export type DiagnosticSeverity = "info" | "warning" | "error";

/**
 * Diagnostic event source types
 */
export type DiagnosticSource =
  | "demodulator"
  | "ts-parser"
  | "video-decoder"
  | "audio-decoder"
  | "caption-decoder"
  | "system";

/**
 * Signal quality metrics
 */
export interface SignalQualityMetrics {
  /** Signal-to-Noise Ratio in dB */
  snr?: number;
  /** Bit Error Rate (0-1) */
  ber?: number;
  /** Modulation Error Ratio in dB */
  mer?: number;
  /** Signal strength (0-1) */
  signalStrength?: number;
  /** Sync lock state */
  syncLocked?: boolean;
  /** Timestamp when metrics were captured */
  timestamp: number;
}

/**
 * Demodulator metrics
 */
export interface DemodulatorMetrics extends SignalQualityMetrics {
  /** Segment sync count */
  segmentSyncCount?: number;
  /** Field sync count */
  fieldSyncCount?: number;
  /** Symbol error rate */
  symbolErrorRate?: number;
}

/**
 * Transport stream parser metrics
 */
export interface TSParserMetrics {
  /** Continuity counter errors */
  continuityErrors: number;
  /** Transport Error Indicator count */
  teiErrors: number;
  /** Sync byte errors */
  syncErrors: number;
  /** Total packets parsed */
  packetsProcessed: number;
  /** PAT updates received */
  patUpdates: number;
  /** PMT updates received */
  pmtUpdates: number;
  /** Timestamp when metrics were captured */
  timestamp: number;
}

/**
 * Decoder metrics
 */
export interface DecoderMetrics {
  /** Frames/packets dropped */
  droppedCount: number;
  /** Total frames/packets processed */
  processedCount: number;
  /** Error count */
  errorCount: number;
  /** Current state */
  state: string;
  /** Buffer health (0-1, 1 = healthy) */
  bufferHealth?: number;
  /** Timestamp when metrics were captured */
  timestamp: number;
}

/**
 * Diagnostic event payload
 */
export interface DiagnosticEvent {
  id: string;
  source: DiagnosticSource;
  severity: DiagnosticSeverity;
  message: string;
  timestamp: number;
  /** Optional additional data */
  data?: Record<string, unknown>;
}

/**
 * Diagnostics state
 */
export interface DiagnosticsState {
  /** Recent diagnostic events (max 100) */
  events: DiagnosticEvent[];
  /** Current demodulator metrics */
  demodulatorMetrics: DemodulatorMetrics | null;
  /** Current TS parser metrics */
  tsParserMetrics: TSParserMetrics | null;
  /** Current video decoder metrics */
  videoDecoderMetrics: DecoderMetrics | null;
  /** Current audio decoder metrics */
  audioDecoderMetrics: DecoderMetrics | null;
  /** Current caption decoder metrics */
  captionDecoderMetrics: DecoderMetrics | null;
  /** Whether diagnostics overlay is visible */
  overlayVisible: boolean;
}

/**
 * Diagnostics slice actions
 */
export interface DiagnosticsSlice extends DiagnosticsState {
  /** Add a diagnostic event */
  addDiagnosticEvent: (
    event: Omit<DiagnosticEvent, "id" | "timestamp">,
  ) => void;
  /** Update demodulator metrics */
  updateDemodulatorMetrics: (metrics: Partial<DemodulatorMetrics>) => void;
  /** Update TS parser metrics */
  updateTSParserMetrics: (metrics: Partial<TSParserMetrics>) => void;
  /** Update video decoder metrics */
  updateVideoDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  /** Update audio decoder metrics */
  updateAudioDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  /** Update caption decoder metrics */
  updateCaptionDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  /** Clear all diagnostic events */
  clearDiagnosticEvents: () => void;
  /** Reset all metrics */
  resetDiagnostics: () => void;
  /** Toggle overlay visibility */
  setOverlayVisible: (visible: boolean) => void;
}

/**
 * Generate a unique event ID.
 *
 * Uses crypto.randomUUID() if available for robust collision resistance.
 * Falls back to timestamp and random string for environments without crypto.randomUUID.
 */
const generateEventId = (): string => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: timestamp + random string (~10^14 possibilities)
  return `diag-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Create the diagnostics slice
 */
export const diagnosticsSlice: StateCreator<DiagnosticsSlice> = (
  set: (
    partial:
      | DiagnosticsSlice
      | Partial<DiagnosticsSlice>
      | ((
          state: DiagnosticsSlice,
        ) => DiagnosticsSlice | Partial<DiagnosticsSlice>),
  ) => void,
) => ({
  // Initial state
  events: [],
  demodulatorMetrics: null,
  tsParserMetrics: null,
  videoDecoderMetrics: null,
  audioDecoderMetrics: null,
  captionDecoderMetrics: null,
  overlayVisible: false,

  // Actions
  addDiagnosticEvent: (
    event: Omit<DiagnosticEvent, "id" | "timestamp">,
  ): void => {
    const newEvent: DiagnosticEvent = {
      ...event,
      id: generateEventId(),
      timestamp: Date.now(),
    };

    set((state: DiagnosticsSlice) => {
      const newEvents = [...state.events, newEvent];
      // Keep only last 100 events
      if (newEvents.length > 100) {
        newEvents.shift();
      }
      return { events: newEvents };
    });
  },

  updateDemodulatorMetrics: (metrics: Partial<DemodulatorMetrics>): void => {
    set((state: DiagnosticsSlice) => ({
      demodulatorMetrics: {
        ...(state.demodulatorMetrics ?? {}),
        ...metrics,
        timestamp: Date.now(),
      } as DemodulatorMetrics,
    }));
  },

  updateTSParserMetrics: (metrics: Partial<TSParserMetrics>): void => {
    set((state: DiagnosticsSlice) => ({
      tsParserMetrics: {
        ...(state.tsParserMetrics ?? {
          continuityErrors: 0,
          teiErrors: 0,
          syncErrors: 0,
          packetsProcessed: 0,
          patUpdates: 0,
          pmtUpdates: 0,
        }),
        ...metrics,
        timestamp: Date.now(),
      },
    }));
  },

  updateVideoDecoderMetrics: (metrics: Partial<DecoderMetrics>): void => {
    set((state: DiagnosticsSlice) => ({
      videoDecoderMetrics: {
        ...(state.videoDecoderMetrics ?? {
          droppedCount: 0,
          processedCount: 0,
          errorCount: 0,
          state: "unconfigured",
        }),
        ...metrics,
        timestamp: Date.now(),
      },
    }));
  },

  updateAudioDecoderMetrics: (metrics: Partial<DecoderMetrics>): void => {
    set((state: DiagnosticsSlice) => ({
      audioDecoderMetrics: {
        ...(state.audioDecoderMetrics ?? {
          droppedCount: 0,
          processedCount: 0,
          errorCount: 0,
          state: "unconfigured",
        }),
        ...metrics,
        timestamp: Date.now(),
      },
    }));
  },

  updateCaptionDecoderMetrics: (metrics: Partial<DecoderMetrics>): void => {
    set((state: DiagnosticsSlice) => ({
      captionDecoderMetrics: {
        ...(state.captionDecoderMetrics ?? {
          droppedCount: 0,
          processedCount: 0,
          errorCount: 0,
          state: "unconfigured",
        }),
        ...metrics,
        timestamp: Date.now(),
      },
    }));
  },

  clearDiagnosticEvents: (): void => {
    set({ events: [] });
  },

  resetDiagnostics: (): void => {
    set({
      events: [],
      demodulatorMetrics: null,
      tsParserMetrics: null,
      videoDecoderMetrics: null,
      audioDecoderMetrics: null,
      captionDecoderMetrics: null,
    });
  },

  setOverlayVisible: (visible: boolean): void => {
    set({ overlayVisible: visible });
  },
});
