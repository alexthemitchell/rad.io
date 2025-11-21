/**
 * VFO Slice
 *
 * Persistence: None (ephemeral, runtime-only)
 * Scope: Application-wide (Zustand store)
 * Expiration: Cleared on page reload
 *
 * Manages multiple Virtual Frequency Oscillators (VFOs) for simultaneous
 * demodulation of different signals within the current hardware bandwidth.
 *
 * VFO state is ephemeral because:
 * - Demodulator plugin instances cannot be serialized
 * - Audio nodes are tied to the current Web Audio context
 * - VFO configurations are tied to current hardware setup
 *
 * For persistent VFO presets, see vfoPresetStorage.ts (future implementation)
 *
 * Related: See ARCHITECTURE.md "State & Persistence" section for storage pattern guidance
 * Related: docs/reference/multi-vfo-architecture.md for detailed specification
 */

import { type StateCreator } from "zustand";
import { VfoStatus, MIN_VFO_SPACING_HZ } from "../../types/vfo";
import type { VfoConfig, VfoState } from "../../types/vfo";

/**
 * VFO validation error
 */
export class VfoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VfoValidationError";
  }
}

/**
 * Validation context for VFO constraints
 * These values come from the current hardware/device state
 */
export interface VfoValidationContext {
  /** Current hardware center frequency in Hz */
  hardwareCenterHz: number;

  /** Current hardware sample rate in Hz */
  sampleRateHz: number;

  /** Existing VFOs to check for conflicts */
  existingVfos: VfoState[];

  /** Maximum allowed VFO count */
  maxVfos: number;
}

/**
 * Validate VFO configuration against hardware and spacing constraints
 * @throws {VfoValidationError} If validation fails
 */
export function validateVfoConfig(
  config: VfoConfig,
  context: VfoValidationContext,
): void {
  const { hardwareCenterHz, sampleRateHz, existingVfos, maxVfos } = context;

  // 1. Check VFO count limit
  if (existingVfos.length >= maxVfos) {
    throw new VfoValidationError(
      `Maximum VFO count (${maxVfos}) reached. Remove a VFO before adding a new one.`,
    );
  }

  // 2. Check center frequency is valid
  if (config.centerHz < 0) {
    throw new VfoValidationError(
      `VFO center frequency (${config.centerHz} Hz) must be >= 0`,
    );
  }

  // 3. Check VFO center frequency is within hardware bandwidth
  const hwLowEdge = hardwareCenterHz - sampleRateHz / 2;
  const hwHighEdge = hardwareCenterHz + sampleRateHz / 2;

  if (config.centerHz < hwLowEdge || config.centerHz > hwHighEdge) {
    throw new VfoValidationError(
      `VFO center frequency (${config.centerHz} Hz) is outside hardware capture range (${hwLowEdge} Hz to ${hwHighEdge} Hz)`,
    );
  }

  // 4. Check VFO bandwidth fits within hardware capture
  const vfoLowEdge = config.centerHz - config.bandwidthHz / 2;
  const vfoHighEdge = config.centerHz + config.bandwidthHz / 2;

  if (vfoLowEdge < hwLowEdge || vfoHighEdge > hwHighEdge) {
    throw new VfoValidationError(
      `VFO bandwidth (${config.bandwidthHz} Hz centered at ${config.centerHz} Hz) exceeds hardware capture range (${hwLowEdge} Hz to ${hwHighEdge} Hz)`,
    );
  }

  // 5. Check minimum spacing from other VFOs (warn but allow for now, per spec)
  for (const existingVfo of existingVfos) {
    // Skip checking against itself when updating
    if (existingVfo.id === config.id) {
      continue;
    }

    const spacing = Math.abs(config.centerHz - existingVfo.centerHz);
    const minSpacing = Math.max(
      MIN_VFO_SPACING_HZ[config.modeId] ?? 0,
      MIN_VFO_SPACING_HZ[existingVfo.modeId] ?? 0,
    );

    if (spacing < minSpacing) {
      // Per spec: "allow overlap for now but warn TODO"
      console.warn(
        `⚠️ VFO spacing warning: VFO at ${config.centerHz} Hz is ${spacing} Hz from existing VFO at ${existingVfo.centerHz} Hz (minimum recommended: ${minSpacing} Hz). This may cause filter crosstalk.`,
      );
    }
  }
}

/**
 * Check if two VFOs have overlapping bandwidths
 */
export function detectVfoOverlap(vfo1: VfoConfig, vfo2: VfoConfig): boolean {
  const edge1Low = vfo1.centerHz - vfo1.bandwidthHz / 2;
  const edge1High = vfo1.centerHz + vfo1.bandwidthHz / 2;
  const edge2Low = vfo2.centerHz - vfo2.bandwidthHz / 2;
  const edge2High = vfo2.centerHz + vfo2.bandwidthHz / 2;

  // True overlap requires one VFO's band to extend into the other
  // Edge-adjacent (touching but not overlapping) returns false
  return !(edge1High <= edge2Low || edge2High <= edge1Low);
}

export interface VfoSlice {
  /** Active VFOs, keyed by ID */
  vfos: Map<string, VfoState>;

  /** Maximum allowed VFOs (dynamic, based on platform) */
  maxVfos: number;

  /** Add a new VFO with validation */
  addVfo: (
    config: VfoConfig,
    validationContext: Omit<VfoValidationContext, "existingVfos" | "maxVfos">,
  ) => void;

  /** Remove a VFO by ID */
  removeVfo: (id: string) => void;

  /** Update VFO configuration (validates new config) */
  updateVfo: (
    id: string,
    updates: Partial<VfoConfig>,
    validationContext: Omit<VfoValidationContext, "existingVfos" | "maxVfos">,
  ) => void;

  /** Update VFO runtime state (metrics, status) - no validation */
  updateVfoState: (id: string, updates: Partial<VfoState>) => void;

  /** Enable/disable VFO audio */
  setVfoAudio: (id: string, enabled: boolean) => void;

  /** Remove all VFOs */
  clearVfos: () => void;

  /** Get VFO by ID */
  getVfo: (id: string) => VfoState | undefined;

  /** Get all VFOs as array */
  getAllVfos: () => VfoState[];

  /** Get active VFOs (status === ACTIVE) */
  getActiveVfos: () => VfoState[];

  /** Set maximum VFO count */
  setMaxVfos: (max: number) => void;
}

export const vfoSlice: StateCreator<VfoSlice> = (
  set: (
    partial:
      | VfoSlice
      | Partial<VfoSlice>
      | ((state: VfoSlice) => VfoSlice | Partial<VfoSlice>),
  ) => void,
  get: () => VfoSlice,
) => ({
  vfos: new Map(),
  maxVfos: 8, // Default, can be updated based on platform detection

  addVfo: (
    config: VfoConfig,
    validationContext: Omit<VfoValidationContext, "existingVfos" | "maxVfos">,
  ): void => {
    const state = get();

    // Build full validation context
    const fullContext: VfoValidationContext = {
      ...validationContext,
      existingVfos: Array.from(state.vfos.values()),
      maxVfos: state.maxVfos,
    };

    // Validate configuration (throws on failure)
    validateVfoConfig(config, fullContext);

    // Create VFO state with default runtime values
    const vfoState: VfoState = {
      ...config,
      status: VfoStatus.IDLE,
      demodulator: null,
      audioNode: null,
      metrics: {
        rssi: -100, // Start with very low signal
        samplesProcessed: 0,
        processingTime: 0,
        timestamp: Date.now(),
      },
      createdAt: config.createdAt ?? Date.now(),
      audioGain: config.audioGain ?? 1.0,
      priority: config.priority ?? 5,
    };

    set((currentState: VfoSlice) => {
      const newVfos = new Map(currentState.vfos);
      newVfos.set(config.id, vfoState);
      return { vfos: newVfos };
    });
  },

  removeVfo: (id: string): void => {
    set((state: VfoSlice) => {
      const vfo = state.vfos.get(id);
      if (!vfo) {
        console.warn(`⚠️ VFO: Attempted to remove non-existent VFO ${id}`);
        return state;
      }

      // Clean up resources (following memory leak mitigation pattern from spec)
      // Note: Actual demodulator cleanup will be handled by MultiVfoProcessor
      if (vfo.demodulator) {
        console.debug(`🎛️ VFO: Cleaning up demodulator for VFO ${id}`);
        // demodulator.dispose() would be called here in production
      }
      if (vfo.audioNode) {
        console.debug(`🔊 VFO: Disconnecting audio node for VFO ${id}`);
        // audioNode.disconnect() would be called here in production
      }

      const newVfos = new Map(state.vfos);
      newVfos.delete(id);

      return { vfos: newVfos };
    });
  },

  updateVfo: (
    id: string,
    updates: Partial<VfoConfig>,
    validationContext: Omit<VfoValidationContext, "existingVfos" | "maxVfos">,
  ): void => {
    const state = get();
    const vfo = state.vfos.get(id);

    if (!vfo) {
      console.warn(`⚠️ VFO: Attempted to update non-existent VFO ${id}`);
      return;
    }

    // Create updated config for validation
    const updatedConfig: VfoConfig = {
      ...vfo,
      ...updates,
    };

    // Build full validation context
    const fullContext: VfoValidationContext = {
      ...validationContext,
      existingVfos: Array.from(state.vfos.values()),
      maxVfos: state.maxVfos,
    };

    // Validate updated configuration (throws on failure)
    validateVfoConfig(updatedConfig, fullContext);

    // Apply update
    set((currentState: VfoSlice) => {
      const newVfos = new Map(currentState.vfos);
      const currentVfo = newVfos.get(id);
      if (currentVfo) {
        newVfos.set(id, { ...currentVfo, ...updates });
      }
      return { vfos: newVfos };
    });
  },

  updateVfoState: (id: string, updates: Partial<VfoState>): void => {
    set((state: VfoSlice) => {
      const vfo = state.vfos.get(id);
      if (!vfo) {
        console.warn(
          `⚠️ VFO: Attempted to update state of non-existent VFO ${id}`,
        );
        return state;
      }

      const newVfos = new Map(state.vfos);
      newVfos.set(id, { ...vfo, ...updates });

      return { vfos: newVfos };
    });
  },

  setVfoAudio: (id: string, enabled: boolean): void => {
    set((state: VfoSlice) => {
      const vfo = state.vfos.get(id);
      if (!vfo) {
        console.warn(
          `⚠️ VFO: Attempted to set audio for non-existent VFO ${id}`,
        );
        return state;
      }

      const newVfos = new Map(state.vfos);
      newVfos.set(id, { ...vfo, audioEnabled: enabled });

      return { vfos: newVfos };
    });
  },

  clearVfos: (): void => {
    const state = get();

    // Clean up all VFO resources before clearing
    for (const [id, vfo] of state.vfos.entries()) {
      if (vfo.demodulator || vfo.audioNode) {
        console.debug(`🎛️ VFO: Cleaning up VFO ${id} before clear`);
      }
    }

    set({ vfos: new Map() });
  },

  getVfo: (id: string): VfoState | undefined => {
    return get().vfos.get(id);
  },

  getAllVfos: (): VfoState[] => {
    return Array.from(get().vfos.values());
  },

  getActiveVfos: (): VfoState[] => {
    return Array.from(get().vfos.values()).filter(
      (vfo: VfoState) => vfo.status === VfoStatus.ACTIVE,
    );
  },

  setMaxVfos: (max: number): void => {
    if (max < 1) {
      console.warn(`⚠️ VFO: Invalid max VFO count ${max}, must be >= 1`);
      return;
    }
    set({ maxVfos: max });
  },
});
