# Tutorial: Creating Your First Plugin

**Time to complete**: 30-45 minutes
**Prerequisites**: TypeScript knowledge, familiarity with rad.io basics
**Difficulty**: Intermediate

## Introduction

In this tutorial, you'll learn how to create a custom plugin for rad.io. We'll build a simple AM (Amplitude Modulation) demodulator plugin from scratch, teaching you the core concepts of the plugin system along the way.

By the end of this tutorial, you'll understand:

- Plugin system architecture and lifecycle
- How to implement plugin interfaces
- Best practices for plugin development
- Testing your plugins
- Integrating plugins into rad.io

## Understanding the Plugin System

The rad.io plugin system allows you to extend the application with custom features:

- **Demodulator Plugins**: Convert IQ samples to audio (FM, AM, SSB, digital modes)
- **Visualization Plugins**: Create custom signal displays (waterfall, constellation, etc.)
- **Device Driver Plugins**: Add support for new SDR hardware
- **Utility Plugins**: General integrations and tools

All plugins follow a consistent lifecycle:

```
REGISTERED → initialize() → INITIALIZED → activate() → ACTIVE
                                         ← deactivate() ←
              ← dispose() ←
```

## Step 1: Set Up Your Plugin File

Create a new file at `src/plugins/demodulators/AMDemodulatorPlugin.ts`:

```typescript
/**
 * AM Demodulator Plugin
 *
 * Amplitude Modulation (AM) demodulator for broadcast radio.
 * Implements envelope detection to extract audio from IQ samples.
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  DemodulatorPlugin,
  DemodulatorParameters,
  PluginMetadata,
} from "../../types/plugin";

export class AMDemodulatorPlugin
  extends BasePlugin
  implements DemodulatorPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEMODULATOR };
  private parameters: DemodulatorParameters;

  constructor() {
    const metadata: PluginMetadata = {
      id: "am-demodulator",
      name: "AM Demodulator",
      version: "1.0.0",
      author: "Your Name",
      description: "Amplitude Modulation (AM) demodulator for broadcast radio",
      type: PluginType.DEMODULATOR,
      homepage: "https://github.com/yourusername/rad.io-am-demodulator",
    };

    super(metadata);

    // Initialize default parameters
    this.parameters = {
      audioSampleRate: 48000,
      bandwidth: 10000, // 10 kHz for AM broadcast
      squelch: 0,
      afcEnabled: false,
    };
  }
}
```

### What We Did

1. **Imported necessary types**: We brought in `BasePlugin`, `PluginType`, and our plugin interfaces
2. **Extended BasePlugin**: This gives us automatic lifecycle management
3. **Implemented DemodulatorPlugin**: This interface defines the methods we must implement
4. **Defined metadata**: Each plugin needs unique identification and version info
5. **Initialized parameters**: Set sensible defaults for our demodulator

## Step 2: Implement Lifecycle Hooks

Now add the lifecycle methods that BasePlugin requires:

```typescript
  protected onInitialize(): void {
    // Called when plugin is first registered
    // Initialize any state or resources needed
    console.log(`${this.metadata.name} initialized`);
  }

  protected async onActivate(): Promise<void> {
    // Called when plugin should start working
    // Start any background tasks or prepare for processing
    console.log(`${this.metadata.name} activated`);
  }

  protected onDeactivate(): void {
    // Called when plugin should stop working
    // Pause processing but keep state
    console.log(`${this.metadata.name} deactivated`);
  }

  protected async onDispose(): Promise<void> {
    // Called when plugin is being removed
    // Clean up all resources, stop all tasks
    console.log(`${this.metadata.name} disposed`);
  }
```

### Understanding the Lifecycle

- **onInitialize()**: One-time setup when plugin is registered
- **onActivate()**: Start the plugin's functionality (can be called multiple times)
- **onDeactivate()**: Pause the plugin (can be called multiple times)
- **onDispose()**: Final cleanup before plugin is removed (called once)

## Step 3: Implement Demodulator Methods

Now let's add the core demodulation functionality:

```typescript
  /**
   * Demodulate IQ samples to audio
   * This is the main processing function
   */
  demodulate(samples: IQSample[]): Float32Array {
    if (!samples || samples.length === 0) {
      return new Float32Array(0);
    }

    const output = new Float32Array(samples.length);

    // AM demodulation using envelope detection
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        continue;
      }

      // Calculate magnitude (envelope)
      const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);

      // Remove DC component (simple high-pass filter)
      // In a real implementation, you'd use a proper filter
      output[i] = magnitude - 1.0;
    }

    return output;
  }

  /**
   * Get supported modulation types
   */
  getSupportedModes(): string[] {
    return ["am", "dsb", "usb", "lsb"];
  }

  /**
   * Set demodulation mode
   */
  setMode(mode: string): void {
    if (!this.getSupportedModes().includes(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }

    // Adjust bandwidth based on mode
    switch (mode) {
      case "am":
        this.parameters.bandwidth = 10000; // 10 kHz
        break;
      case "dsb":
        this.parameters.bandwidth = 10000; // 10 kHz
        break;
      case "usb":
      case "lsb":
        this.parameters.bandwidth = 3000; // 3 kHz for SSB
        break;
    }
  }

  /**
   * Get current parameters
   */
  getParameters(): DemodulatorParameters {
    return { ...this.parameters };
  }

  /**
   * Update parameters
   */
  setParameters(params: Partial<DemodulatorParameters>): void {
    this.parameters = { ...this.parameters, ...params };
  }
```

### Understanding the Demodulation

AM demodulation is one of the simplest: we just calculate the magnitude of each IQ sample. This extracts the envelope, which contains the audio signal.

The formula is: `magnitude = sqrt(I² + Q²)`

## Step 4: Add Configuration Support

Let's add a configuration schema so users can adjust settings:

```typescript
  /**
   * Define configuration schema
   */
  override getConfigSchema() {
    return {
      properties: {
        mode: {
          type: "string" as const,
          description: "Demodulation mode (AM, DSB, USB, LSB)",
          enum: ["am", "dsb", "usb", "lsb"],
          default: "am",
        },
        bandwidth: {
          type: "number" as const,
          description: "Demodulation bandwidth in Hz",
          minimum: 3000,
          maximum: 15000,
          default: 10000,
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

  /**
   * Handle configuration updates
   */
  protected override onConfigUpdate(config: Record<string, unknown>): void {
    if (typeof config["mode"] === "string") {
      this.setMode(config["mode"]);
    }
    if (typeof config["bandwidth"] === "number") {
      this.parameters.bandwidth = config["bandwidth"];
    }
    if (typeof config["squelch"] === "number") {
      this.parameters.squelch = config["squelch"];
    }
  }
```

## Step 5: Export Your Plugin

Add your plugin to the exports in `src/plugins/index.ts`:

```typescript
// Add to existing exports
export { AMDemodulatorPlugin } from "./demodulators/AMDemodulatorPlugin";
```

## Step 6: Write Tests

Create a test file at `src/plugins/demodulators/__tests__/AMDemodulatorPlugin.test.ts`:

```typescript
import { AMDemodulatorPlugin } from "../AMDemodulatorPlugin";
import { PluginState } from "../../../types/plugin";
import type { IQSample } from "../../../models/SDRDevice";

describe("AMDemodulatorPlugin", () => {
  let plugin: AMDemodulatorPlugin;

  beforeEach(() => {
    plugin = new AMDemodulatorPlugin();
  });

  describe("initialization", () => {
    it("should create plugin with correct metadata", () => {
      expect(plugin.metadata.id).toBe("am-demodulator");
      expect(plugin.metadata.name).toBe("AM Demodulator");
      expect(plugin.metadata.type).toBe("demodulator");
    });

    it("should initialize successfully", async () => {
      await plugin.initialize();
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });
  });

  describe("lifecycle", () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it("should activate successfully", async () => {
      await plugin.activate();
      expect(plugin.state).toBe(PluginState.ACTIVE);
    });

    it("should deactivate successfully", async () => {
      await plugin.activate();
      await plugin.deactivate();
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });

    it("should dispose successfully", async () => {
      await plugin.dispose();
    });
  });

  describe("demodulation", () => {
    beforeEach(async () => {
      await plugin.initialize();
      await plugin.activate();
    });

    it("should demodulate IQ samples", () => {
      const samples: IQSample[] = [
        { I: 1.0, Q: 0.0 },
        { I: 0.707, Q: 0.707 },
        { I: 0.0, Q: 1.0 },
        { I: -0.707, Q: 0.707 },
      ];

      const audio = plugin.demodulate(samples);

      expect(audio).toBeInstanceOf(Float32Array);
      expect(audio.length).toBe(samples.length);

      // Check that we got reasonable values
      expect(audio[0]).toBeCloseTo(0.0, 1); // |1| - 1 = 0
      expect(audio[1]).toBeCloseTo(0.0, 1); // |1| - 1 = 0
    });

    it("should handle empty input", () => {
      const audio = plugin.demodulate([]);
      expect(audio.length).toBe(0);
    });

    it("should handle invalid samples", () => {
      const samples: IQSample[] = [
        { I: 1.0, Q: 0.0 },
        null as any,
        { I: 0.0, Q: 1.0 },
      ];

      const audio = plugin.demodulate(samples);
      expect(audio.length).toBe(samples.length);
    });
  });

  describe("modes", () => {
    it("should support correct modes", () => {
      const modes = plugin.getSupportedModes();
      expect(modes).toContain("am");
      expect(modes).toContain("dsb");
      expect(modes).toContain("usb");
      expect(modes).toContain("lsb");
    });

    it("should set mode successfully", () => {
      plugin.setMode("am");
      expect(plugin.getParameters().bandwidth).toBe(10000);

      plugin.setMode("usb");
      expect(plugin.getParameters().bandwidth).toBe(3000);
    });

    it("should reject invalid mode", () => {
      expect(() => plugin.setMode("invalid")).toThrow();
    });
  });

  describe("parameters", () => {
    it("should get parameters", () => {
      const params = plugin.getParameters();
      expect(params.audioSampleRate).toBe(48000);
      expect(params.bandwidth).toBe(10000);
    });

    it("should set parameters", () => {
      plugin.setParameters({
        bandwidth: 8000,
        squelch: 20,
      });

      const params = plugin.getParameters();
      expect(params.bandwidth).toBe(8000);
      expect(params.squelch).toBe(20);
    });
  });

  describe("configuration", () => {
    it("should provide configuration schema", () => {
      const schema = plugin.getConfigSchema();
      expect(schema).toBeDefined();
      expect(schema?.properties.mode).toBeDefined();
      expect(schema?.properties.bandwidth).toBeDefined();
    });

    it("should update configuration", async () => {
      await plugin.updateConfig({
        mode: "usb",
        bandwidth: 5000,
        squelch: 15,
      });

      const params = plugin.getParameters();
      expect(params.bandwidth).toBe(5000);
      expect(params.squelch).toBe(15);
    });
  });
});
```

## Step 7: Run Your Tests

```bash
npm test -- --testPathPatterns="AMDemodulatorPlugin"
```

All tests should pass!

## Step 8: Use Your Plugin

Now you can use your plugin in the application:

```typescript
import { pluginRegistry, AMDemodulatorPlugin } from "./plugins";

// Create and register plugin
const amDemod = new AMDemodulatorPlugin();
await pluginRegistry.register(amDemod);
await amDemod.activate();

// Use it to demodulate IQ samples
const iqSamples = getIQSamplesFromSDR();
const audioSamples = amDemod.demodulate(iqSamples);

// Feed audio to speakers
playAudio(audioSamples);
```

## Complete Code

Here's the complete plugin implementation:

<details>
<summary>Click to expand full code</summary>

```typescript
/**
 * AM Demodulator Plugin
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { IQSample } from "../../models/SDRDevice";
import type {
  DemodulatorPlugin,
  DemodulatorParameters,
  PluginMetadata,
} from "../../types/plugin";

export class AMDemodulatorPlugin
  extends BasePlugin
  implements DemodulatorPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEMODULATOR };
  private parameters: DemodulatorParameters;

  constructor() {
    const metadata: PluginMetadata = {
      id: "am-demodulator",
      name: "AM Demodulator",
      version: "1.0.0",
      author: "Your Name",
      description: "Amplitude Modulation (AM) demodulator",
      type: PluginType.DEMODULATOR,
    };

    super(metadata);

    this.parameters = {
      audioSampleRate: 48000,
      bandwidth: 10000,
      squelch: 0,
      afcEnabled: false,
    };
  }

  protected onInitialize(): void {
    console.log(`${this.metadata.name} initialized`);
  }

  protected async onActivate(): Promise<void> {
    console.log(`${this.metadata.name} activated`);
  }

  protected onDeactivate(): void {
    console.log(`${this.metadata.name} deactivated`);
  }

  protected async onDispose(): Promise<void> {
    console.log(`${this.metadata.name} disposed`);
  }

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
      const magnitude = Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
      output[i] = magnitude - 1.0;
    }

    return output;
  }

  getSupportedModes(): string[] {
    return ["am", "dsb", "usb", "lsb"];
  }

  setMode(mode: string): void {
    if (!this.getSupportedModes().includes(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }
    switch (mode) {
      case "am":
      case "dsb":
        this.parameters.bandwidth = 10000;
        break;
      case "usb":
      case "lsb":
        this.parameters.bandwidth = 3000;
        break;
    }
  }

  getParameters(): DemodulatorParameters {
    return { ...this.parameters };
  }

  setParameters(params: Partial<DemodulatorParameters>): void {
    this.parameters = { ...this.parameters, ...params };
  }

  override getConfigSchema() {
    return {
      properties: {
        mode: {
          type: "string" as const,
          enum: ["am", "dsb", "usb", "lsb"],
          default: "am",
        },
        bandwidth: {
          type: "number" as const,
          minimum: 3000,
          maximum: 15000,
          default: 10000,
        },
        squelch: {
          type: "number" as const,
          minimum: 0,
          maximum: 100,
          default: 0,
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
    }
    if (typeof config["squelch"] === "number") {
      this.parameters.squelch = config["squelch"];
    }
  }
}
```

</details>

## Next Steps

Congratulations! You've created your first rad.io plugin. Here are some ideas to expand it:

1. **Add a proper high-pass filter** to remove DC offset
2. **Implement AGC (Automatic Gain Control)** for better audio quality
3. **Add noise blanker** for pulse noise reduction
4. **Support stereo AM** for C-QUAM or other stereo systems
5. **Add spectrum analyzer** to show signal strength

## Additional Resources

- [Plugin API Reference](../reference/plugin-api.md)
- [How-to: Create a Demodulator Plugin](../how-to/create-demodulator-plugin.md)
- [How-to: Create a Visualization Plugin](../how-to/create-visualization-plugin.md)
- [Example Plugins](../../src/plugins/)
- [ADR-0024: Plugin System Architecture](../decisions/0024-plugin-system-architecture.md)

## Troubleshooting

### Plugin won't register

Check that:

- Your plugin ID is unique
- All dependencies are registered first
- The plugin implements all required interface methods

### Tests failing

Common issues:

- Not calling `initialize()` before `activate()`
- Not handling null/undefined samples
- Incorrect type declarations

### TypeScript errors

Make sure:

- You're extending `BasePlugin`
- You've declared the metadata type correctly
- All interface methods are implemented

## Contributing Your Plugin

To share your plugin with the community:

1. Create a GitHub repository
2. Add comprehensive documentation
3. Include tests and examples
4. Submit to the rad.io plugin catalog

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
