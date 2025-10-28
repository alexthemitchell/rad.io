import type { Sample } from "../../utils/dsp";
import type { FrameProcessor, FrameProcessorConfig } from "../interfaces";

/**
 * Configuration for AGC (Automatic Gain Control) processing
 */
export interface AGCProcessorConfig extends FrameProcessorConfig {
  type: "agc";
  /** Target output level (0.0 to 1.0) */
  targetLevel: number;
  /** Attack time constant (how quickly gain increases) */
  attackTime: number;
  /** Decay time constant (how quickly gain decreases) */
  decayTime: number;
  /** Maximum gain factor to prevent over-amplification */
  maxGain: number;
}

/**
 * AGC processor output data
 */
export interface AGCOutput {
  /** Gain-adjusted samples */
  samples: Sample[];
  /** Current gain level applied */
  currentGain: number;
}

/**
 * FrameProcessor implementation that applies Automatic Gain Control.
 * Normalizes signal amplitude to maintain consistent output levels.
 *
 * @example
 * ```typescript
 * const processor = new AGCProcessor({
 *   type: "agc",
 *   targetLevel: 0.7,
 *   attackTime: 0.01,
 *   decayTime: 0.1,
 *   maxGain: 10.0,
 * });
 *
 * const output = processor.process(samples);
 * // output.samples contains gain-adjusted IQ samples
 * ```
 */
export class AGCProcessor implements FrameProcessor<Sample[], AGCOutput> {
  private config: AGCProcessorConfig;
  private currentGain = 1.0;

  constructor(config: AGCProcessorConfig) {
    this.validateConfig(config);
    this.config = { ...config };
  }

  /**
   * Process IQ samples with AGC
   */
  process(samples: Sample[]): AGCOutput {
    if (samples.length === 0) {
      return {
        samples: [],
        currentGain: this.currentGain,
      };
    }

    // Calculate current signal level
    let sumSquared = 0;
    for (const sample of samples) {
      sumSquared += sample.I * sample.I + sample.Q * sample.Q;
    }
    const rms = Math.sqrt(sumSquared / (samples.length * 2));

    // Update gain based on error from target level
    const error = this.config.targetLevel - rms;
    const timeConstant = error > 0 ? this.config.attackTime : this.config.decayTime;
    
    // Exponential smoothing
    const alpha = 1.0 - Math.exp(-1.0 / timeConstant);
    const gainAdjustment = 1.0 + error / (rms + 1e-10);
    this.currentGain = this.currentGain * (1.0 - alpha) + this.currentGain * gainAdjustment * alpha;

    // Clamp gain to maximum
    this.currentGain = Math.min(this.currentGain, this.config.maxGain);
    this.currentGain = Math.max(this.currentGain, 0.1); // Minimum gain to prevent divide-by-zero

    // Apply calculated gain to samples
    const processed = samples.map((sample) => ({
      I: sample.I * this.currentGain,
      Q: sample.Q * this.currentGain,
    }));

    return {
      samples: processed,
      currentGain: this.currentGain,
    };
  }

  getConfig(): AGCProcessorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AGCProcessorConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);
    this.config = newConfig;
  }

  /**
   * Reset the AGC state (current gain level)
   */
  reset(): void {
    this.currentGain = 1.0;
  }

  /**
   * Get the current gain level
   */
  getCurrentGain(): number {
    return this.currentGain;
  }

  private validateConfig(config: AGCProcessorConfig): void {
    if (config.targetLevel <= 0 || config.targetLevel > 1.0) {
      throw new Error("targetLevel must be between 0 and 1.0");
    }

    if (config.attackTime <= 0) {
      throw new Error("attackTime must be positive");
    }

    if (config.decayTime <= 0) {
      throw new Error("decayTime must be positive");
    }

    if (config.maxGain <= 1.0) {
      throw new Error("maxGain must be greater than 1.0");
    }
  }
}
