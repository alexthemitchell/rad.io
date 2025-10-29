/**
 * FM Demodulator Plugin Example
 *
 * Example implementation of a basic FM demodulator plugin.
 * This demonstrates how to create a demodulator plugin.
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
 * Basic FM Demodulator Plugin
 */
export class FMDemodulatorPlugin
  extends BasePlugin
  implements DemodulatorPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEMODULATOR };
  private parameters: DemodulatorParameters;
  private previousPhase: number;

  constructor() {
    const metadata: PluginMetadata = {
      id: "fm-demodulator",
      name: "FM Demodulator",
      version: "1.0.0",
      author: "rad.io",
      description: "Frequency Modulation (FM) demodulator for broadcast radio",
      type: PluginType.DEMODULATOR,
    };

    super(metadata);
    this.parameters = {
      audioSampleRate: 48000,
      bandwidth: 200000, // 200 kHz for wide-band FM
      squelch: 0,
      afcEnabled: false,
    };
    this.previousPhase = 0;
  }

  protected onInitialize(): void {
    // Initialize demodulator state
    this.previousPhase = 0;
  }

  protected async onActivate(): Promise<void> {
    // Start demodulation (nothing to do for stateless operation)
  }

  protected onDeactivate(): void {
    // Stop demodulation
    this.previousPhase = 0;
  }

  protected async onDispose(): Promise<void> {
    // Clean up resources
  }

  /**
   * Demodulate IQ samples to audio
   */
  demodulate(samples: IQSample[]): Float32Array {
    const output = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        continue;
      }

      // Calculate instantaneous phase
      const phase = Math.atan2(sample.Q, sample.I);

      // Calculate phase difference (frequency)
      let phaseDiff = phase - this.previousPhase;

      // Unwrap phase to handle discontinuities
      if (phaseDiff > Math.PI) {
        phaseDiff -= 2 * Math.PI;
      } else if (phaseDiff < -Math.PI) {
        phaseDiff += 2 * Math.PI;
      }

      // Store for next iteration
      this.previousPhase = phase;

      // Phase difference is proportional to frequency deviation
      output[i] = phaseDiff;
    }

    // Apply de-emphasis filter if needed (not implemented in this example)
    return output;
  }

  /**
   * Get supported modulation modes
   */
  getSupportedModes(): string[] {
    return ["wbfm", "nbfm"];
  }

  /**
   * Set demodulation mode
   */
  setMode(mode: string): void {
    if (!this.getSupportedModes().includes(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }

    // Adjust bandwidth for narrow-band FM
    if (mode === "nbfm") {
      this.parameters.bandwidth = 12500; // 12.5 kHz for narrow-band
    } else {
      this.parameters.bandwidth = 200000; // 200 kHz for wide-band
    }
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
  }

  /**
   * Get plugin configuration schema
   */
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        mode: {
          type: "string" as const,
          description: "Demodulation mode",
          enum: ["wbfm", "nbfm"],
          default: "wbfm",
        },
        bandwidth: {
          type: "number" as const,
          description: "Demodulation bandwidth in Hz",
          minimum: 5000,
          maximum: 250000,
          default: 200000,
        },
        squelch: {
          type: "number" as const,
          description: "Squelch threshold (0-100)",
          minimum: 0,
          maximum: 100,
          default: 0,
        },
      },
      required: ["mode"],
    };
  }
}
