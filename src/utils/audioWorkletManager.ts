/**
 * AudioWorklet Manager
 *
 * Manages AudioWorkletNode for low-latency, stable audio processing.
 * Provides high-level interface for demodulation with AGC, squelch, and deemphasis.
 *
 * @module audioWorkletManager
 */

import type { IQSample } from "../models/SDRDevice";

/**
 * Demodulation types
 */
export enum WorkletDemodType {
  AM = 0,
  FM = 1,
  NFM = 2,
  WFM = 3,
  USB = 4,
  LSB = 5,
  CW = 6,
}

/**
 * AGC (Automatic Gain Control) modes
 */
export enum AGCMode {
  OFF = 0,
  SLOW = 1,
  MEDIUM = 2,
  FAST = 3,
}

/**
 * Configuration for AudioWorklet processor
 */
export interface AudioWorkletConfig {
  demodType: WorkletDemodType;
  agcMode?: AGCMode;
  agcTarget?: number; // Target RMS level (0.0 - 1.0), default 0.5
  squelchThreshold?: number; // Squelch threshold (0.0 - 1.0), default 0.0 (off)
  deemphasisEnabled?: boolean; // Enable deemphasis filter, default true for FM/WFM
  deemphasisTau?: number; // Time constant: 75 (USA) or 50 (Europe) microseconds
  volume?: number; // Output volume (0.0 - 1.0), default 1.0
  latencyHint?: AudioContextLatencyCategory; // 'interactive', 'balanced', or 'playback'
}

/**
 * AudioWorklet Manager
 *
 * Creates and manages an AudioWorkletNode for real-time audio demodulation.
 * Handles worklet loading, configuration, and IQ sample streaming.
 */
export class AudioWorkletManager {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private config: Required<AudioWorkletConfig>;

  constructor() {
    // Default configuration
    // Note: agcMode defaults to OFF here to match AudioStreamProcessor behavior
    this.config = {
      demodType: WorkletDemodType.FM,
      agcMode: AGCMode.OFF,
      agcTarget: 0.5,
      squelchThreshold: 0.0,
      deemphasisEnabled: true,
      deemphasisTau: 75,
      volume: 1.0,
      latencyHint: "interactive",
    };
  }

  /**
   * Initialize the AudioWorklet processor
   *
   * Loads the worklet module and creates the AudioWorkletNode.
   * Must be called before processing audio.
   *
   * @param config - Configuration for the audio processor
   */
  async initialize(config?: Partial<AudioWorkletConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn("AudioWorkletManager already initialized");
      return;
    }

    // Update configuration
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Create AudioContext with latency hint
      this.audioContext = new AudioContext({
        latencyHint: this.config.latencyHint,
        sampleRate: 48000, // Standard audio sample rate
      });

      // Load the AudioWorklet module
      const workletUrl = new URL(
        "../workers/audio-processor.worklet.ts",
        import.meta.url,
      );
      await this.audioContext.audioWorklet.addModule(workletUrl.href);

      // Create the AudioWorkletNode
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "audio-processor",
        {
          numberOfInputs: 0, // We'll send IQ samples via port messages
          numberOfOutputs: 1,
          outputChannelCount: [2], // Stereo output
        },
      );

      // Connect to output
      this.workletNode.connect(this.audioContext.destination);

      // Send initial configuration to worklet
      this.updateConfiguration(this.config);

      this.isInitialized = true;

      console.info("AudioWorklet initialized successfully", {
        sampleRate: this.audioContext.sampleRate,
        latency: this.audioContext.baseLatency,
        outputLatency: this.audioContext.outputLatency,
      });
    } catch (error) {
      console.error("Failed to initialize AudioWorklet:", error);
      throw error;
    }
  }

  /**
   * Update processor configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfiguration(config: Partial<AudioWorkletConfig>): void {
    if (!this.workletNode) {
      throw new Error("AudioWorklet not initialized");
    }

    // Update internal config
    this.config = { ...this.config, ...config };

    // Send configuration to worklet
    this.workletNode.port.postMessage({
      type: "configure",
      params: {
        demodType: this.config.demodType,
        agcMode: this.config.agcMode,
        agcTarget: this.config.agcTarget,
        squelchThreshold: this.config.squelchThreshold,
        deemphasisEnabled: this.config.deemphasisEnabled,
        deemphasisTau: this.config.deemphasisTau,
        volume: this.config.volume,
      },
    });
  }

  /**
   * Process IQ samples through the AudioWorklet
   *
   * Sends IQ samples to the worklet for demodulation and audio output.
   *
   * @param samples - Array of IQ samples
   */
  processSamples(samples: IQSample[]): void {
    if (!this.workletNode) {
      throw new Error("AudioWorklet not initialized");
    }

    if (samples.length === 0) {
      return;
    }

    // Send IQ samples to worklet
    this.workletNode.port.postMessage({
      type: "iqSamples",
      samples,
    });
  }

  /**
   * Set demodulation type
   */
  setDemodType(demodType: WorkletDemodType): void {
    this.updateConfiguration({ demodType });
  }

  /**
   * Set AGC mode
   */
  setAGCMode(agcMode: AGCMode): void {
    this.updateConfiguration({ agcMode });
  }

  /**
   * Set AGC target level (0.0 - 1.0)
   */
  setAGCTarget(target: number): void {
    this.updateConfiguration({ agcTarget: Math.max(0, Math.min(1, target)) });
  }

  /**
   * Set squelch threshold (0.0 - 1.0)
   * 0.0 = squelch off
   */
  setSquelchThreshold(threshold: number): void {
    this.updateConfiguration({
      squelchThreshold: Math.max(0, Math.min(1, threshold)),
    });
  }

  /**
   * Enable or disable deemphasis filter
   */
  setDeemphasisEnabled(enabled: boolean): void {
    this.updateConfiguration({ deemphasisEnabled: enabled });
  }

  /**
   * Set deemphasis time constant
   * @param tau - Time constant in microseconds (75 for USA, 50 for Europe)
   */
  setDeemphasisTau(tau: number): void {
    this.updateConfiguration({ deemphasisTau: tau });
  }

  /**
   * Set output volume (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    this.updateConfiguration({ volume: Math.max(0, Math.min(1, volume)) });
  }

  /**
   * Start audio output
   *
   * Resumes the audio context if it's suspended.
   */
  async start(): Promise<void> {
    if (!this.audioContext) {
      throw new Error("AudioWorklet not initialized");
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.info("Audio context resumed");
    }
  }

  /**
   * Stop audio output
   *
   * Suspends the audio context to save CPU.
   */
  async stop(): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    if (this.audioContext.state === "running") {
      await this.audioContext.suspend();
      console.info("Audio context suspended");
    }
  }

  /**
   * Get current audio context state
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * Get current latency information
   */
  getLatency(): {
    baseLatency: number;
    outputLatency: number;
    sampleRate: number;
  } | null {
    if (!this.audioContext) {
      return null;
    }

    return {
      baseLatency: this.audioContext.baseLatency,
      outputLatency: this.audioContext.outputLatency,
      sampleRate: this.audioContext.sampleRate,
    };
  }

  /**
   * Clean up resources
   *
   * Disconnects and closes the audio context.
   */
  async cleanup(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    console.info("AudioWorklet cleaned up");
  }

  /**
   * Check if the manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }
}

/**
 * Create a new AudioWorklet manager instance
 *
 * @param config - Optional initial configuration
 * @returns AudioWorkletManager instance
 */
export async function createAudioWorkletManager(
  config?: Partial<AudioWorkletConfig>,
): Promise<AudioWorkletManager> {
  const manager = new AudioWorkletManager();
  await manager.initialize(config);
  return manager;
}
