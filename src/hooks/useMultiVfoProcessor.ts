/**
 * useMultiVfoProcessor Hook
 *
 * Manages MultiVfoProcessor lifecycle and integration with VFO store.
 * Connects IQ samples to VFO processing and audio output.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { MultiVfoProcessor } from "../lib/dsp/MultiVfoProcessor";
import { FMDemodulatorPlugin } from "../plugins/demodulators/FMDemodulatorPlugin";
import { useVfo, useStore } from "../store";
import { VfoStatus } from "../types/vfo";
import { createAudioContext, playAudioBuffer } from "../utils/webAudioUtils";
import type { IQSample } from "../models/SDRDevice";
import type { DemodulatorPlugin } from "../types/plugin";
import type { VfoState } from "../types/vfo";

interface UseMultiVfoProcessorOptions {
  /** Hardware center frequency in Hz */
  centerFrequencyHz: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Enable audio output */
  enableAudio: boolean;
}

/**
 * Create a demodulator plugin for the given VFO mode
 */
function createDemodulatorForMode(modeId: string): DemodulatorPlugin | null {
  switch (modeId.toLowerCase()) {
    case "am":
      // TODO: Implement AMDemodulatorPlugin
      // For now, use FM demodulator as fallback
      console.warn(`AM demodulator not implemented, using FM as fallback`);
      return new FMDemodulatorPlugin();

    case "wbfm":
    case "nbfm": {
      const plugin = new FMDemodulatorPlugin();
      plugin.setMode(modeId.toLowerCase());
      return plugin;
    }

    case "usb":
    case "lsb":
      // TODO: Implement SSB demodulator
      console.warn(
        `${modeId} demodulator not implemented, using FM as fallback`,
      );
      return new FMDemodulatorPlugin();

    default:
      console.error(`Unknown VFO mode: ${modeId}`);
      return null;
  }
}

/**
 * Hook to manage multi-VFO processing
 */
export function useMultiVfoProcessor(options: UseMultiVfoProcessorOptions): {
  /** Process a batch of IQ samples through all active VFOs */
  processSamples: (samples: IQSample[]) => Promise<void>;
  /** Whether processor is initialized */
  isReady: boolean;
} {
  const { centerFrequencyHz, sampleRate, enableAudio } = options;
  const { vfos, getAllVfos, updateVfoState } = useVfo();

  const processorRef = useRef<MultiVfoProcessor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vfoDemodulators = useRef<Map<string, DemodulatorPlugin>>(new Map());
  const addedVfoIds = useRef<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  // Initialize processor
  useEffect(() => {
    const processor = new MultiVfoProcessor({
      sampleRate,
      centerFrequency: centerFrequencyHz,
      pfbThreshold: 3,
      maxConcurrentAudio: 1, // Start with 1, can be increased later
      audioOutputSampleRate: 48000,
      enableMetrics: true,
    });

    processorRef.current = processor;
    setIsReady(true);

    // Initialize audio context for playback
    if (enableAudio) {
      audioContextRef.current = createAudioContext();
    }

    // Capture refs for cleanup
    const demodulators = vfoDemodulators.current;
    const audioCtx = audioContextRef.current;
    const vfoIds = addedVfoIds.current;

    return (): void => {
      // Clean up processor
      if (processorRef.current) {
        processorRef.current.clear();
      }
      processorRef.current = null;
      setIsReady(false);

      // Cleanup demodulators
      for (const demod of demodulators.values()) {
        void demod.dispose();
      }
      demodulators.clear();
      vfoIds.clear(); // Clear tracked VFO IDs when processor is recreated

      // Close audio context
      if (audioCtx) {
        void audioCtx.close();
        audioContextRef.current = null;
      }
    };
  }, [centerFrequencyHz, sampleRate, enableAudio]);

  // Track VFO modes to detect changes
  const vfoModes = useRef<Map<string, string>>(new Map());

  // Sync VFOs from store to processor
  useEffect(() => {
    const processor = processorRef.current;
    if (!processor) {
      return;
    }

    const vfoList = getAllVfos();

    // Add or update VFOs in processor
    const initializeVfos = async (): Promise<void> => {
      for (const vfo of vfoList) {
        // Check if mode has changed for existing VFO
        const existingMode = vfoModes.current.get(vfo.id);
        if (existingMode && existingMode !== vfo.modeId) {
          // Mode changed - dispose old demodulator and create new one
          const oldDemod = vfoDemodulators.current.get(vfo.id);
          if (oldDemod) {
            void oldDemod.dispose();
            vfoDemodulators.current.delete(vfo.id);
          }
          // Remove from processor so it can be re-added with new demodulator
          processor.removeVfo(vfo.id);
          addedVfoIds.current.delete(vfo.id);
        }

        // Create demodulator if needed
        if (!vfoDemodulators.current.has(vfo.id)) {
          const demod = createDemodulatorForMode(vfo.modeId);
          if (demod) {
            try {
              await demod.initialize();
              await demod.activate();
              vfoDemodulators.current.set(vfo.id, demod);
              vfoModes.current.set(vfo.id, vfo.modeId);
            } catch (error) {
              console.error(
                `Failed to initialize demodulator for VFO ${vfo.id}:`,
                error,
              );
              continue;
            }
          }
        }

        // Get demodulator for this VFO
        const demodulator = vfoDemodulators.current.get(vfo.id);
        if (!demodulator) {
          continue;
        }

        // Create VfoState with demodulator
        const vfoState: VfoState = {
          ...vfo,
          demodulator,
          audioNode: null, // Web Audio API node will be created when playing
          status: VfoStatus.ACTIVE,
        };

        // Only add VFO if we haven't added it yet
        if (!addedVfoIds.current.has(vfoState.id)) {
          processor.addVfo(vfoState);
          addedVfoIds.current.add(vfoState.id);
        }
      }

      // Remove VFOs that are no longer in store
      const vfoIds = new Set(vfoList.map((v) => v.id));
      for (const [id, demod] of vfoDemodulators.current.entries()) {
        if (!vfoIds.has(id)) {
          processor.removeVfo(id);
          addedVfoIds.current.delete(id);
          vfoModes.current.delete(id);
          void demod.dispose();
          vfoDemodulators.current.delete(id);
        }
      }
    };

    void initializeVfos();
  }, [vfos]); // Re-run when VFO map changes

  /**
   * Process IQ samples through all active VFOs
   */
  const processSamples = useCallback(
    async (samples: IQSample[]) => {
      const processor = processorRef.current;
      if (!processor || samples.length === 0) {
        return;
      }

      // Get fresh VFO list from store on each call
      const vfos = useStore.getState().getAllVfos();
      const activeVfos = vfos.filter((v) => v.audioEnabled);

      if (activeVfos.length === 0) {
        return;
      }

      // Build VfoState array with demodulators
      const vfoStates: VfoState[] = activeVfos
        .map((vfo): VfoState | null => {
          const demodulator = vfoDemodulators.current.get(vfo.id);
          if (!demodulator) {
            return null;
          }

          return {
            ...vfo,
            demodulator,
            audioNode: null,
            status: VfoStatus.ACTIVE,
          };
        })
        .filter((v): v is VfoState => v !== null);

      // Process samples
      const results = await processor.processSamples(samples, vfoStates);

      // Update VFO metrics in store
      for (const [vfoId, result] of results.entries()) {
        updateVfoState(vfoId, {
          metrics: result.metrics,
        });

        // Play audio if enabled
        if (result.audio && enableAudio && audioContextRef.current) {
          const { audio, sampleRate: audioRate } = result.audio;

          // Play audio buffer (fire-and-forget)
          playAudioBuffer(audioContextRef.current, audio, audioRate);
        }
      }
    },
    [updateVfoState, enableAudio],
  );

  return {
    processSamples,
    isReady,
  };
}
