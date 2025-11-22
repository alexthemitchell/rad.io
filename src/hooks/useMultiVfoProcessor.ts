/**
 * useMultiVfoProcessor Hook
 *
 * Manages MultiVfoProcessor lifecycle and integration with VFO store.
 * Connects IQ samples to VFO processing and audio output.
 */

import { useEffect, useRef, useCallback } from "react";
import { MultiVfoProcessor } from "../lib/dsp/MultiVfoProcessor";
import { FMDemodulatorPlugin } from "../plugins/demodulators/FMDemodulatorPlugin";
import { useVfo } from "../store";
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
  const { getAllVfos, updateVfoState } = useVfo();

  const processorRef = useRef<MultiVfoProcessor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vfoDemodulators = useRef<Map<string, DemodulatorPlugin>>(new Map());
  const isInitialized = useRef(false);

  // Initialize processor
  useEffect(() => {
    if (isInitialized.current) {
      return;
    }

    const processor = new MultiVfoProcessor({
      sampleRate,
      centerFrequency: centerFrequencyHz,
      pfbThreshold: 3,
      maxConcurrentAudio: 1, // Start with 1, can be increased later
      audioOutputSampleRate: 48000,
      enableMetrics: true,
    });

    processorRef.current = processor;
    isInitialized.current = true;

    // Initialize audio context for playback
    if (enableAudio) {
      audioContextRef.current = createAudioContext();
    }

    return (): void => {
      // Cleanup
      processorRef.current = null;
      isInitialized.current = false;

      // Cleanup demodulators - intentionally using ref for cleanup
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const demodulatorMap = vfoDemodulators.current;
      for (const demod of demodulatorMap.values()) {
        void demod.dispose();
      }
      demodulatorMap.clear();

      // Close audio context
      const audioCtx = audioContextRef.current;
      if (audioCtx) {
        void audioCtx.close();
        audioContextRef.current = null;
      }
    };
  }, [centerFrequencyHz, sampleRate, enableAudio]);

  // Update processor when center frequency or sample rate changes
  useEffect(() => {
    if (!processorRef.current) {
      return;
    }

    processorRef.current.updateConfig({
      sampleRate,
      centerFrequency: centerFrequencyHz,
    });
  }, [centerFrequencyHz, sampleRate]);

  // Sync VFOs from store to processor
  useEffect(() => {
    const processor = processorRef.current;
    if (!processor) {
      return;
    }

    const vfos = getAllVfos();

    // Add or update VFOs in processor
    const initializeVfos = async (): Promise<void> => {
      for (const vfo of vfos) {
        // Create demodulator if needed
        if (!vfoDemodulators.current.has(vfo.id)) {
          const demod = createDemodulatorForMode(vfo.modeId);
          if (demod) {
            try {
              await demod.initialize();
              await demod.activate();
              vfoDemodulators.current.set(vfo.id, demod);
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
          status: "ACTIVE",
        };

        processor.addVfo(vfoState);
      }

      // Remove VFOs that are no longer in store
      const vfoIds = new Set(vfos.map((v) => v.id));
      for (const [id, demod] of vfoDemodulators.current.entries()) {
        if (!vfoIds.has(id)) {
          processor.removeVfo(id);
          void demod.dispose();
          vfoDemodulators.current.delete(id);
        }
      }
    };

    void initializeVfos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllVfos()]); // Re-run when VFO list changes

  /**
   * Process IQ samples through all active VFOs
   */
  const processSamples = useCallback(
    async (samples: IQSample[]) => {
      const processor = processorRef.current;
      if (!processor || samples.length === 0) {
        return;
      }

      const vfos = getAllVfos();
      const activeVfos = vfos.filter((v) => v.audioEnabled);

      if (activeVfos.length === 0) {
        return;
      }

      // Build VfoState array with demodulators
      const vfoStates: VfoState[] = activeVfos
        .map((vfo) => {
          const demodulator = vfoDemodulators.current.get(vfo.id);
          if (!demodulator) {
            return null;
          }

          return {
            ...vfo,
            demodulator,
            audioNode: null,
            status: "ACTIVE" as const,
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

          // Play audio buffer
          void playAudioBuffer(audioContextRef.current, audio, audioRate);
        }
      }
    },
    [getAllVfos, updateVfoState, enableAudio],
  );

  return {
    processSamples,
    isReady: isInitialized.current,
  };
}
