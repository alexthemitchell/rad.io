/**
 * Simulated data source for testing and development.
 * Generates synthetic IQ samples with configurable patterns.
 */

import type { DataSource, DataSourceMetadata } from "./interfaces";
import type { Sample } from "../utils/dsp";

/**
 * Configuration for simulated signal generation.
 */
export interface SimulatedSourceConfig {
  /** Sample rate in Hz */
  sampleRate: number;
  /** Center frequency in Hz */
  centerFrequency: number;
  /** Signal pattern to generate */
  pattern: "sine" | "qpsk" | "noise" | "fm" | "multi-tone";
  /** Amplitude of the signal (0-1) */
  amplitude: number;
  /** Update interval in milliseconds */
  updateInterval: number;
  /** Number of samples per update */
  samplesPerUpdate: number;
}

/**
 * Default configuration for simulated source.
 */
const DEFAULT_CONFIG: SimulatedSourceConfig = {
  sampleRate: 2048000, // 2.048 MHz
  centerFrequency: 100000000, // 100 MHz
  pattern: "sine",
  amplitude: 0.8,
  updateInterval: 50, // 20 Hz update rate
  samplesPerUpdate: 2048,
};

/**
 * Simulated data source that generates synthetic IQ samples.
 * Useful for testing, development, and demonstrations without hardware.
 */
export class SimulatedSource implements DataSource {
  private config: SimulatedSourceConfig;
  private streaming = false;
  private intervalId: NodeJS.Timeout | null = null;
  private callback: ((samples: Sample[]) => void) | null = null;
  private phase = 0;

  constructor(config: Partial<SimulatedSourceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async startStreaming(callback: (samples: Sample[]) => void): Promise<void> {
    if (this.streaming) {
      return Promise.resolve();
    }

    this.streaming = true;
    this.callback = callback;
    this.phase = 0;

    // Start generating samples at the configured interval
    this.intervalId = setInterval(() => {
      if (!this.streaming || !this.callback) {
        return;
      }

      const samples = this.generateSamples(
        this.config.samplesPerUpdate,
        this.config.pattern,
      );
      this.callback(samples);
    }, this.config.updateInterval);

    return Promise.resolve();
  }

  async stopStreaming(): Promise<void> {
    this.streaming = false;
    this.callback = null;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    return Promise.resolve();
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  getMetadata(): DataSourceMetadata {
    return {
      name: "Simulated Source",
      sampleRate: this.config.sampleRate,
      centerFrequency: this.config.centerFrequency,
      pattern: this.config.pattern,
      amplitude: this.config.amplitude,
    };
  }

  /**
   * Update the configuration of the simulated source.
   * If streaming, it will be restarted with the new configuration.
   */
  updateConfig(config: Partial<SimulatedSourceConfig>): void {
    const wasStreaming = this.streaming;
    const oldCallback = this.callback;

    if (wasStreaming && oldCallback) {
      void this.stopStreaming();
    }

    this.config = { ...this.config, ...config };

    if (wasStreaming && oldCallback) {
      void this.startStreaming(oldCallback);
    }
  }

  /**
   * Get the current configuration.
   */
  getConfig(): SimulatedSourceConfig {
    return { ...this.config };
  }

  /**
   * Generate synthetic IQ samples based on the configured pattern.
   */
  private generateSamples(count: number, pattern: string): Sample[] {
    const samples: Sample[] = [];
    const { amplitude, sampleRate } = this.config;

    switch (pattern) {
      case "sine": {
        // Simple sine wave at 1 kHz offset
        const frequency = 1000; // 1 kHz tone
        for (let i = 0; i < count; i++) {
          const t = this.phase / sampleRate;
          samples.push({
            I: amplitude * Math.cos(2 * Math.PI * frequency * t),
            Q: amplitude * Math.sin(2 * Math.PI * frequency * t),
          });
          this.phase++;
        }
        break;
      }

      case "qpsk": {
        // QPSK constellation (4 points)
        const symbolRate = 1000; // 1k symbols/sec
        const samplesPerSymbol = Math.floor(sampleRate / symbolRate);
        const symbols = [
          { I: amplitude, Q: amplitude },
          { I: amplitude, Q: -amplitude },
          { I: -amplitude, Q: amplitude },
          { I: -amplitude, Q: -amplitude },
        ];

        for (let i = 0; i < count; i++) {
          const symbolIndex =
            Math.floor(this.phase / samplesPerSymbol) % symbols.length;
          const symbol = symbols[symbolIndex];
          if (symbol) {
            samples.push(symbol);
          }
          this.phase++;
        }
        break;
      }

      case "noise": {
        // White noise
        for (let i = 0; i < count; i++) {
          samples.push({
            I: amplitude * (Math.random() * 2 - 1),
            Q: amplitude * (Math.random() * 2 - 1),
          });
          this.phase++;
        }
        break;
      }

      case "fm": {
        // FM modulated signal (carrier with 1 kHz audio)
        const carrierFreq = 10000; // 10 kHz carrier
        const modulationFreq = 1000; // 1 kHz audio
        const modulationIndex = 5; // Frequency deviation

        for (let i = 0; i < count; i++) {
          const t = this.phase / sampleRate;
          const modulatingSignal = Math.sin(2 * Math.PI * modulationFreq * t);
          const instantFreq = carrierFreq + modulationIndex * modulatingSignal;
          const phase = 2 * Math.PI * instantFreq * t;

          samples.push({
            I: amplitude * Math.cos(phase),
            Q: amplitude * Math.sin(phase),
          });
          this.phase++;
        }
        break;
      }

      case "multi-tone": {
        // Multiple tones at different frequencies
        const tones = [1000, 3000, 5000]; // Hz
        for (let i = 0; i < count; i++) {
          const t = this.phase / sampleRate;
          let I = 0;
          let Q = 0;

          for (const freq of tones) {
            I += (amplitude / tones.length) * Math.cos(2 * Math.PI * freq * t);
            Q += (amplitude / tones.length) * Math.sin(2 * Math.PI * freq * t);
          }

          samples.push({ I, Q });
          this.phase++;
        }
        break;
      }

      default: {
        // Default to zeros
        for (let i = 0; i < count; i++) {
          samples.push({ I: 0, Q: 0 });
          this.phase++;
        }
      }
    }

    return samples;
  }
}
