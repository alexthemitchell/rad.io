# How-To: Create a Demodulator Plugin

**Time to complete**: 45-60 minutes
**Prerequisites**: TypeScript, DSP basics, completed [Plugin Tutorial](../tutorials/03-creating-plugins.md)
**Difficulty**: Advanced

## Overview

This guide shows you how to create a production-quality demodulator plugin for rad.io. We'll cover advanced topics like proper filtering, state management, and performance optimization.

## Demodulator Plugin Interface

Every demodulator plugin must implement:

```typescript
interface DemodulatorPlugin extends Plugin {
  demodulate(samples: IQSample[]): Float32Array;
  getSupportedModes(): string[];
  setMode(mode: string): void;
  getParameters(): DemodulatorParameters;
  setParameters(params: Partial<DemodulatorParameters>): void;
}
```

## Step 1: Choose Your Modulation Type

Common modulation types:

- **FM (Frequency Modulation)**: Broadcast radio, NBFM/WBFM
- **AM (Amplitude Modulation)**: Broadcast radio, aircraft
- **SSB (Single Sideband)**: Ham radio, military
- **PSK (Phase Shift Keying)**: Digital modes
- **FSK (Frequency Shift Keying)**: RTTY, packet radio

This guide focuses on creating a SSB demodulator.

## Step 2: Understand SSB Demodulation

SSB (Single Sideband) demodulation requires:

1. **Frequency translation**: Shift signal to baseband
2. **Filtering**: Select upper or lower sideband
3. **Product detection**: Multiply by local oscillator
4. **Audio filtering**: Band-pass filter for voice frequencies

## Step 3: Create the Plugin Structure

```typescript
import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  DemodulatorPlugin,
  DemodulatorParameters,
  PluginMetadata,
} from "../../types/plugin";

export class SSBDemodulatorPlugin
  extends BasePlugin
  implements DemodulatorPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEMODULATOR };

  // Demodulation state
  private parameters: DemodulatorParameters;
  private mode: "usb" | "lsb";
  private sampleRate: number;
  private audioSampleRate: number;

  // Filter state
  private hilbertState: Float32Array;
  private audioFilterState: Float32Array;

  // AGC state
  private agcGain: number;
  private agcTarget: number;

  constructor() {
    const metadata: PluginMetadata = {
      id: "ssb-demodulator",
      name: "SSB Demodulator",
      version: "1.0.0",
      author: "rad.io",
      description: "Single Sideband demodulator with AGC and noise reduction",
      type: PluginType.DEMODULATOR,
    };

    super(metadata);

    // Initialize state
    this.mode = "usb";
    this.sampleRate = 48000;
    this.audioSampleRate = 48000;
    this.agcGain = 1.0;
    this.agcTarget = 0.5;

    this.parameters = {
      audioSampleRate: 48000,
      bandwidth: 3000, // 3 kHz for voice
      squelch: 0,
      afcEnabled: false,
    };

    // Initialize filter state
    this.hilbertState = new Float32Array(128);
    this.audioFilterState = new Float32Array(64);
  }
}
```

## Step 4: Implement Lifecycle Hooks

```typescript
  protected onInitialize(): void {
    // Reset all state
    this.hilbertState.fill(0);
    this.audioFilterState.fill(0);
    this.agcGain = 1.0;
  }

  protected async onActivate(): Promise<void> {
    // Start demodulation
    // Could initialize worker threads here for better performance
  }

  protected onDeactivate(): void {
    // Pause demodulation
  }

  protected async onDispose(): Promise<void> {
    // Clean up resources
    this.hilbertState = new Float32Array(0);
    this.audioFilterState = new Float32Array(0);
  }
```

## Step 5: Implement Core Demodulation

```typescript
  demodulate(samples: IQSample[]): Float32Array {
    if (!samples || samples.length === 0) {
      return new Float32Array(0);
    }

    const output = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        continue;
      }

      // SSB demodulation using phasing method
      let audio: number;

      if (this.mode === "usb") {
        // Upper sideband: I + Q
        audio = sample.I + sample.Q;
      } else {
        // Lower sideband: I - Q
        audio = sample.I - sample.Q;
      }

      // Apply AGC
      audio *= this.agcGain;

      // Update AGC
      this.updateAGC(Math.abs(audio));

      // Apply audio filter (simple low-pass)
      audio = this.applyAudioFilter(audio);

      output[i] = audio;
    }

    return output;
  }

  /**
   * Simple audio filter (low-pass)
   */
  private applyAudioFilter(input: number): number {
    // Simple single-pole IIR filter
    const alpha = 0.1; // Cutoff frequency control
    this.audioFilterState[0] =
      alpha * input + (1 - alpha) * this.audioFilterState[0];
    return this.audioFilterState[0];
  }

  /**
   * AGC update
   */
  private updateAGC(magnitude: number): void {
    // Simple AGC algorithm
    const attackRate = 0.01;
    const decayRate = 0.0001;

    if (magnitude > this.agcTarget) {
      // Signal too loud, reduce gain quickly
      this.agcGain *= 1 - attackRate;
    } else {
      // Signal too quiet, increase gain slowly
      this.agcGain *= 1 + decayRate;
    }

    // Clamp gain to reasonable range
    this.agcGain = Math.max(0.1, Math.min(10.0, this.agcGain));
  }
```

## Step 6: Implement Mode and Parameter Control

```typescript
  getSupportedModes(): string[] {
    return ["usb", "lsb"];
  }

  setMode(mode: string): void {
    if (!this.getSupportedModes().includes(mode)) {
      throw new Error(`Unsupported SSB mode: ${mode}`);
    }
    this.mode = mode as "usb" | "lsb";
  }

  getParameters(): DemodulatorParameters {
    return { ...this.parameters };
  }

  setParameters(params: Partial<DemodulatorParameters>): void {
    this.parameters = { ...this.parameters, ...params };

    // Update internal state based on parameters
    if (params.bandwidth) {
      // Recalculate filter coefficients
      this.updateFilterCoefficients();
    }
  }

  private updateFilterCoefficients(): void {
    // Update filter based on bandwidth
    // In a real implementation, calculate FIR/IIR coefficients
  }
```

## Step 7: Add Advanced Features

### Squelch

```typescript
  private applySquelch(audio: number, magnitude: number): number {
    const threshold = this.parameters.squelch || 0;

    if (threshold > 0) {
      const squelchLevel = threshold / 100.0;

      if (magnitude < squelchLevel) {
        return 0; // Mute audio below threshold
      }
    }

    return audio;
  }
```

### AFC (Automatic Frequency Control)

```typescript
  private afc: number = 0;

  private updateAFC(sample: IQSample): void {
    if (!this.parameters.afcEnabled) {
      return;
    }

    // Simple frequency error detection
    // Calculate phase difference
    const phase = Math.atan2(sample.Q, sample.I);
    const freqError = phase - this.afc;
    this.afc += freqError * 0.01; // Slow tracking
  }
```

### Noise Blanker

```typescript
  private noiseBlanker(samples: IQSample[]): IQSample[] {
    const threshold = 3.0; // 3x average

    // Calculate average magnitude
    let avgMag = 0;
    for (const sample of samples) {
      if (sample) {
        avgMag += Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
      }
    }
    avgMag /= samples.length;

    // Blank pulses above threshold
    return samples.map((sample) => {
      if (!sample) return sample;

      const mag = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
      if (mag > threshold * avgMag) {
        return { I: 0, Q: 0 }; // Blank this sample
      }
      return sample;
    });
  }
```

## Step 8: Add Configuration Schema

```typescript
  override getConfigSchema() {
    return {
      properties: {
        mode: {
          type: "string" as const,
          description: "Sideband selection",
          enum: ["usb", "lsb"],
          default: "usb",
        },
        bandwidth: {
          type: "number" as const,
          description: "Audio bandwidth in Hz",
          minimum: 1500,
          maximum: 4000,
          default: 3000,
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
          default: false,
        },
        agcTarget: {
          type: "number" as const,
          description: "AGC target level (0-1)",
          minimum: 0.1,
          maximum: 1.0,
          default: 0.5,
        },
        noiseBlanker: {
          type: "boolean" as const,
          description: "Enable noise blanker",
          default: false,
        },
      },
      required: ["mode"],
    };
  }

  protected override onConfigUpdate(config: Record<string, unknown>): void {
    if (typeof config["mode"] === "string") {
      this.setMode(config["mode"]);
    }
    if (typeof config["bandwidth"] === "number") {
      this.parameters.bandwidth = config["bandwidth"];
      this.updateFilterCoefficients();
    }
    if (typeof config["squelch"] === "number") {
      this.parameters.squelch = config["squelch"];
    }
    if (typeof config["afcEnabled"] === "boolean") {
      this.parameters.afcEnabled = config["afcEnabled"];
    }
    if (typeof config["agcTarget"] === "number") {
      this.agcTarget = config["agcTarget"];
    }
  }
```

## Step 9: Performance Optimization

### Use Typed Arrays

```typescript
// Good: Use typed arrays for performance
const output = new Float32Array(samples.length);

// Bad: Don't use regular arrays
const output: number[] = [];
```

### Minimize Allocations

```typescript
// Good: Reuse buffers
private workBuffer: Float32Array = new Float32Array(8192);

// Bad: Allocate in hot path
demodulate(samples: IQSample[]): Float32Array {
  const temp = new Float32Array(samples.length); // ❌ Allocates every call
}
```

### Consider Web Workers

For CPU-intensive demodulation, consider using Web Workers:

```typescript
  private worker: Worker | null = null;

  protected override async onActivate(): Promise<void> {
    // Create worker for background processing
    this.worker = new Worker(
      new URL("./ssb-worker.ts", import.meta.url),
    );

    this.worker.onmessage = (e) => {
      // Handle demodulated audio
      const audio = e.data;
      this.handleAudio(audio);
    };
  }

  demodulate(samples: IQSample[]): Float32Array {
    if (this.worker) {
      // Send to worker for processing
      this.worker.postMessage(samples);
      return new Float32Array(0); // Return empty, audio comes via callback
    }

    // Fallback to main thread
    return this.demodulateSync(samples);
  }
```

## Step 10: Write Comprehensive Tests

```typescript
describe("SSBDemodulatorPlugin", () => {
  let plugin: SSBDemodulatorPlugin;

  beforeEach(() => {
    plugin = new SSBDemodulatorPlugin();
  });

  describe("demodulation", () => {
    beforeEach(async () => {
      await plugin.initialize();
      await plugin.activate();
    });

    it("should demodulate USB signal", () => {
      // Generate test signal
      const samples: IQSample[] = [];
      const freq = 1000; // 1 kHz tone
      const sampleRate = 48000;

      for (let i = 0; i < 1000; i++) {
        const t = i / sampleRate;
        const phase = 2 * Math.PI * freq * t;
        samples.push({
          I: Math.cos(phase),
          Q: Math.sin(phase),
        });
      }

      plugin.setMode("usb");
      const audio = plugin.demodulate(samples);

      expect(audio.length).toBe(samples.length);
      // Check that we got non-zero output
      const hasSignal = Array.from(audio).some((v) => Math.abs(v) > 0.01);
      expect(hasSignal).toBe(true);
    });

    it("should handle AGC correctly", () => {
      // Test with loud signal
      const loudSamples: IQSample[] = Array.from({ length: 100 }, () => ({
        I: 10.0,
        Q: 10.0,
      }));

      const audio1 = plugin.demodulate(loudSamples);

      // Test with quiet signal
      const quietSamples: IQSample[] = Array.from({ length: 100 }, () => ({
        I: 0.1,
        Q: 0.1,
      }));

      const audio2 = plugin.demodulate(quietSamples);

      // AGC should normalize levels
      const avg1 =
        audio1.reduce((sum, v) => sum + Math.abs(v), 0) / audio1.length;
      const avg2 =
        audio2.reduce((sum, v) => sum + Math.abs(v), 0) / audio2.length;

      // Levels should be more similar after AGC
      expect(avg1).toBeGreaterThan(0);
      expect(avg2).toBeGreaterThan(0);
    });

    it("should apply squelch", () => {
      plugin.setParameters({ squelch: 50 });

      const quietSamples: IQSample[] = Array.from({ length: 100 }, () => ({
        I: 0.01,
        Q: 0.01,
      }));

      const audio = plugin.demodulate(quietSamples);

      // Squelch should mute quiet signals
      const allZero = Array.from(audio).every((v) => v === 0);
      expect(allZero).toBe(true);
    });
  });

  describe("modes", () => {
    it("should switch between USB and LSB", () => {
      plugin.setMode("usb");
      plugin.setMode("lsb");
      expect(() => plugin.setMode("usb")).not.toThrow();
    });
  });
});
```

## Best Practices

### 1. Handle Edge Cases

```typescript
demodulate(samples: IQSample[]): Float32Array {
  // Check input validity
  if (!samples || samples.length === 0) {
    return new Float32Array(0);
  }

  // Handle null samples
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample) {
      output[i] = 0;
      continue;
    }
    // Process sample...
  }
}
```

### 2. Validate Parameters

```typescript
setParameters(params: Partial<DemodulatorParameters>): void {
  if (params.bandwidth) {
    if (params.bandwidth < 1500 || params.bandwidth > 4000) {
      throw new Error("Bandwidth must be between 1500-4000 Hz");
    }
  }

  if (params.squelch) {
    if (params.squelch < 0 || params.squelch > 100) {
      throw new Error("Squelch must be between 0-100");
    }
  }

  this.parameters = { ...this.parameters, ...params };
}
```

### 3. Provide Clear Documentation

````typescript
/**
 * Demodulate IQ samples to audio
 *
 * @param samples - Input IQ samples at the configured sample rate
 * @returns Audio samples (mono, Float32Array) at audioSampleRate
 *
 * @remarks
 * This method applies:
 * - Phasing method SSB demodulation
 * - Automatic Gain Control (AGC)
 * - Audio filtering
 * - Optional squelch
 * - Optional AFC
 *
 * @example
 * ```typescript
 * const iqSamples = getFromSDR();
 * const audio = plugin.demodulate(iqSamples);
 * playAudio(audio);
 * ```
 */
demodulate(samples: IQSample[]): Float32Array {
  // ...
}
````

### 4. Performance Monitoring

```typescript
  demodulate(samples: IQSample[]): Float32Array {
    const startTime = performance.now();

    // Do demodulation
    const output = this.demodulateInternal(samples);

    const elapsed = performance.now() - startTime;

    // Warn if processing takes too long
    if (elapsed > 10) {
      console.warn(`Demodulation took ${elapsed.toFixed(2)}ms`);
    }

    return output;
  }
```

## Advanced Topics

### DSP Optimization with WebAssembly

For maximum performance, consider implementing the core DSP in WebAssembly:

```typescript
// Load WASM module
import init, { ssb_demodulate } from "./ssb_wasm.js";

protected override async onInitialize(): Promise<void> {
  await init();
}

demodulate(samples: IQSample[]): Float32Array {
  // Use WASM implementation
  const input = new Float32Array(samples.length * 2);

  for (let i = 0; i < samples.length; i++) {
    input[i * 2] = samples[i].I;
    input[i * 2 + 1] = samples[i].Q;
  }

  return ssb_demodulate(input, this.mode === "usb");
}
```

### Real-time Performance

Monitor and optimize for real-time constraints:

```typescript
// Ensure processing completes within time budget
const samplesPerBlock = 4096;
const sampleRate = 48000;
const timePerBlock = samplesPerBlock / sampleRate; // ~85ms
const maxProcessingTime = timePerBlock * 0.5; // Use 50% of time budget
```

## Resources

- [DSP Guide](https://www.dspguide.com/)
- [SDR for Engineers](https://pysdr.org/)
- [Plugin API Reference](../reference/plugin-api.md)
- [ADR-0024: Plugin System](../decisions/0024-plugin-system-architecture.md)
- [FM Demodulator Example](../../src/plugins/demodulators/FMDemodulatorPlugin.ts)

## Next Steps

- Create a [Visualization Plugin](./create-visualization-plugin.md)
- Learn about [Device Driver Plugins](./create-device-driver-plugin.md)
- Explore [DSP Performance Optimization](./optimize-dsp-performance.md)
