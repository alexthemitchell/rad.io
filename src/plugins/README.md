# rad.io Plugin System

A TypeScript-based plugin architecture for extending rad.io with custom SDR features including demodulators, visualizations, and device drivers.

## Table of Contents

- [Overview](#overview)
- [Plugin Types](#plugin-types)
- [Quick Start](#quick-start)
- [Creating Plugins](#creating-plugins)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Overview

The rad.io plugin system provides a flexible, type-safe way to extend the application with custom functionality. Plugins are compiled into the application bundle and managed through a central registry.

### Features

- **Type Safety**: Full TypeScript support with strict type checking
- **Lifecycle Management**: Automated plugin initialization, activation, and cleanup
- **Dependency Resolution**: Declare and validate plugin dependencies
- **Event System**: Listen to plugin state changes and errors
- **Configuration**: Optional schema-based configuration for plugins
- **Testing**: Easy to unit test with Jest

### Architecture

```
Plugin System
├── Plugin Registry (central management)
├── Plugin Types (interfaces for different plugin categories)
├── Base Plugin (abstract class for common functionality)
└── Example Plugins (reference implementations)
```

## Plugin Types

### Demodulator Plugins

Extract audio or data from IQ samples. Examples: FM, AM, SSB, PSK31, RTTY.

**Use cases:**
- Broadcast radio demodulation (FM/AM)
- Digital mode decoding (PSK, RTTY, etc.)
- Custom modulation schemes
- Signal analysis

### Visualization Plugins

Create custom displays for signal analysis. Examples: Waterfall, Constellation, Eye diagram.

**Use cases:**
- Frequency domain displays
- Time domain waveforms
- Signal quality indicators
- Custom analysis views

### Device Driver Plugins

Add support for new SDR hardware. Examples: RTL-SDR variants, custom devices.

**Use cases:**
- Supporting new SDR hardware
- Custom device protocols
- Device-specific optimizations
- Hardware abstraction layers

### Utility Plugins

General integrations and tools. Examples: Logging, Recording, Network streaming.

**Use cases:**
- Data recording and playback
- Network streaming protocols
- Signal processing utilities
- Integration with external services

## Quick Start

### Installing and Using a Plugin

```typescript
import { pluginRegistry, FMDemodulatorPlugin } from './plugins';

// Create and register plugin
const fmPlugin = new FMDemodulatorPlugin();
await pluginRegistry.register(fmPlugin);

// Activate the plugin
await fmPlugin.activate();

// Use the plugin
const audioSamples = fmPlugin.demodulate(iqSamples);

// Deactivate when done
await fmPlugin.deactivate();
```

### Discovering Plugins

```typescript
// Get all plugins
const allPlugins = pluginRegistry.getAllPlugins();

// Get plugins by type
const demodulators = pluginRegistry.getPluginsByType(PluginType.DEMODULATOR);

// Get specific plugin
const plugin = pluginRegistry.getPlugin('fm-demodulator');
```

## Creating Plugins

### 1. Create a Demodulator Plugin

```typescript
import { BasePlugin } from '../lib/BasePlugin';
import type { DemodulatorPlugin, PluginMetadata } from '../types/plugin';
import { PluginType } from '../types/plugin';
import type { IQSample } from '../models/SDRDevice';

export class AMDemodulatorPlugin
  extends BasePlugin
  implements DemodulatorPlugin
{
  constructor() {
    const metadata: PluginMetadata = {
      id: 'am-demodulator',
      name: 'AM Demodulator',
      version: '1.0.0',
      author: 'Your Name',
      description: 'Amplitude Modulation demodulator',
      type: PluginType.DEMODULATOR,
    };
    super(metadata);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize demodulator state
  }

  protected async onActivate(): Promise<void> {
    // Start demodulation
  }

  protected async onDeactivate(): Promise<void> {
    // Stop demodulation
  }

  protected async onDispose(): Promise<void> {
    // Clean up resources
  }

  demodulate(samples: IQSample[]): Float32Array {
    const output = new Float32Array(samples.length);
    
    // AM demodulation: extract magnitude
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        continue;
      }
      const magnitude = Math.sqrt(
        sample.I ** 2 + sample.Q ** 2
      );
      output[i] = magnitude;
    }
    
    return output;
  }

  getSupportedModes(): string[] {
    return ['am', 'dsb', 'usb', 'lsb'];
  }

  setMode(mode: string): void {
    // Implement mode switching
  }

  getParameters() {
    return {
      audioSampleRate: 48000,
      bandwidth: 10000,
    };
  }

  setParameters(params: Partial<DemodulatorParameters>): void {
    // Update parameters
  }
}
```

### 2. Create a Visualization Plugin

```typescript
import { BasePlugin } from '../lib/BasePlugin';
import type { VisualizationPlugin, PluginMetadata } from '../types/plugin';
import { PluginType } from '../types/plugin';

export class ConstellationPlugin
  extends BasePlugin
  implements VisualizationPlugin
{
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    const metadata: PluginMetadata = {
      id: 'constellation-viz',
      name: 'Constellation Diagram',
      version: '1.0.0',
      author: 'Your Name',
      description: 'IQ constellation visualization',
      type: PluginType.VISUALIZATION,
    };
    super(metadata);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize visualization
  }

  protected async onActivate(): Promise<void> {
    // Start rendering
  }

  protected async onDeactivate(): Promise<void> {
    // Stop rendering
  }

  protected async onDispose(): Promise<void> {
    this.canvas = null;
    this.ctx = null;
  }

  render(canvas: HTMLCanvasElement, dataSource: DataSource): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    void dataSource.startStreaming((samples) => {
      this.update(samples);
    });
  }

  update(samples: IQSample[]): void {
    if (!this.ctx) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
    
    // Plot IQ points
    samples.forEach(sample => {
      const x = (sample.I + 1) * this.canvas!.width / 2;
      const y = (sample.Q + 1) * this.canvas!.height / 2;
      
      this.ctx!.fillRect(x, y, 2, 2);
    });
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  getCapabilities() {
    return {
      supportsRealtime: true,
      supportsOffline: true,
      supportsWebGL: false,
      minUpdateRate: 1,
      maxUpdateRate: 60,
    };
  }
}
```

### 3. Create a Device Driver Plugin

```typescript
import { BasePlugin } from '../lib/BasePlugin';
import type { DeviceDriverPlugin, PluginMetadata } from '../types/plugin';
import { PluginType } from '../types/plugin';

export class CustomSDRDriver
  extends BasePlugin
  implements DeviceDriverPlugin
{
  constructor() {
    const metadata: PluginMetadata = {
      id: 'custom-sdr-driver',
      name: 'Custom SDR Driver',
      version: '1.0.0',
      author: 'Your Name',
      description: 'Driver for custom SDR hardware',
      type: PluginType.DEVICE_DRIVER,
    };
    super(metadata);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize driver
  }

  protected async onActivate(): Promise<void> {
    // Activate driver
  }

  protected async onDeactivate(): Promise<void> {
    // Deactivate driver
  }

  protected async onDispose(): Promise<void> {
    // Clean up driver
  }

  async createDevice(usbDevice: USBDevice): Promise<ISDRDevice> {
    return new CustomSDRDevice(usbDevice);
  }

  getUSBFilters(): USBDeviceFilter[] {
    return [
      {
        vendorId: 0x1234,
        productId: 0x5678,
      },
    ];
  }

  supportsDevice(device: USBDevice): boolean {
    return device.vendorId === 0x1234 && device.productId === 0x5678;
  }

  async getDeviceInfo(device: USBDevice) {
    return {
      manufacturer: 'Custom',
      model: 'SDR-1000',
      serialNumber: device.serialNumber,
    };
  }
}
```

## API Reference

### Plugin Interface

```typescript
interface Plugin {
  readonly metadata: PluginMetadata;
  readonly state: PluginState;
  
  initialize(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;
  
  getConfigSchema?(): PluginConfigSchema;
  updateConfig?(config: Record<string, unknown>): Promise<void>;
}
```

### PluginRegistry

```typescript
class PluginRegistry {
  // Registration
  register(plugin: Plugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  
  // Discovery
  getPlugin(pluginId: string): Plugin | undefined;
  getAllPlugins(): Plugin[];
  getPluginsByType(type: PluginType): Plugin[];
  hasPlugin(pluginId: string): boolean;
  
  // Events
  addEventListener(listener: PluginEventListener): void;
  removeEventListener(listener: PluginEventListener): void;
  
  // Cleanup
  clear(): Promise<void>;
}
```

### BasePlugin

```typescript
abstract class BasePlugin implements Plugin {
  constructor(metadata: PluginMetadata);
  
  protected abstract onInitialize(): Promise<void>;
  protected abstract onActivate(): Promise<void>;
  protected abstract onDeactivate(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
  protected onConfigUpdate?(config: Record<string, unknown>): Promise<void>;
}
```

## Examples

See the [examples directory](../src/plugins/) for complete implementations:

- **FMDemodulatorPlugin**: FM demodulation with WBFM/NBFM modes
- **WaterfallVisualizationPlugin**: Waterfall/spectrogram display
- **ExampleDeviceDriverPlugin**: Template for device drivers

## Testing

### Unit Testing Plugins

```typescript
import { FMDemodulatorPlugin } from '../FMDemodulatorPlugin';
import { PluginState } from '../../../types/plugin';

describe('FMDemodulatorPlugin', () => {
  let plugin: FMDemodulatorPlugin;

  beforeEach(() => {
    plugin = new FMDemodulatorPlugin();
  });

  it('should initialize successfully', async () => {
    await plugin.initialize();
    expect(plugin.state).toBe(PluginState.INITIALIZED);
  });

  it('should demodulate IQ samples', () => {
    const samples = [{ I: 1, Q: 0 }, { I: 0, Q: 1 }];
    const audio = plugin.demodulate(samples);
    
    expect(audio).toBeInstanceOf(Float32Array);
    expect(audio.length).toBe(samples.length);
  });
});
```

### Integration Testing

```typescript
describe('Plugin Registry Integration', () => {
  it('should register and use plugin', async () => {
    const registry = new PluginRegistry();
    const plugin = new FMDemodulatorPlugin();
    
    await registry.register(plugin);
    await plugin.activate();
    
    const samples = generateTestSamples();
    const audio = plugin.demodulate(samples);
    
    expect(audio.length).toBeGreaterThan(0);
    
    await plugin.deactivate();
    await registry.unregister(plugin.metadata.id);
  });
});
```

## Best Practices

### 1. Extend BasePlugin

Always extend `BasePlugin` for automatic lifecycle management:

```typescript
class MyPlugin extends BasePlugin implements DemodulatorPlugin {
  // Implement required methods
}
```

### 2. Handle Errors Gracefully

```typescript
protected async onInitialize(): Promise<void> {
  try {
    // Initialization logic
  } catch (error) {
    console.error('Failed to initialize:', error);
    throw error; // Re-throw to set ERROR state
  }
}
```

### 3. Clean Up Resources

```typescript
protected async onDispose(): Promise<void> {
  // Release references
  this.canvas = null;
  this.ctx = null;
  
  // Clear buffers
  this.buffer = [];
  
  // Remove event listeners
  this.listeners.clear();
}
```

### 4. Validate Input

```typescript
demodulate(samples: IQSample[]): Float32Array {
  if (!samples || samples.length === 0) {
    return new Float32Array(0);
  }
  
  // Process samples
}
```

### 5. Provide Configuration Schema

```typescript
getConfigSchema() {
  return {
    properties: {
      mode: {
        type: 'string',
        enum: ['wbfm', 'nbfm'],
        default: 'wbfm',
      },
      bandwidth: {
        type: 'number',
        minimum: 5000,
        maximum: 250000,
      },
    },
    required: ['mode'],
  };
}
```

### 6. Write Comprehensive Tests

- Test all lifecycle methods
- Test edge cases (empty input, invalid config)
- Test integration with other components
- Mock external dependencies

### 7. Document Your Plugin

Include JSDoc comments:

```typescript
/**
 * FM Demodulator Plugin
 * 
 * Provides frequency modulation demodulation for broadcast radio.
 * Supports both wide-band (WBFM) and narrow-band (NBFM) modes.
 * 
 * @example
 * ```typescript
 * const fm = new FMDemodulatorPlugin();
 * await fm.initialize();
 * const audio = fm.demodulate(iqSamples);
 * ```
 */
export class FMDemodulatorPlugin extends BasePlugin {
  // ...
}
```

### 8. Follow TypeScript Best Practices

- Use strict type checking
- Avoid `any` types
- Use `readonly` for immutable properties
- Implement all interface methods

### 9. Performance Considerations

- Avoid unnecessary allocations in hot paths
- Use typed arrays for numeric data
- Consider Web Workers for heavy processing
- Profile and optimize critical sections

### 10. Version Your Plugin

Follow semantic versioning:
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes

## Contributing

To contribute a plugin:

1. Create plugin in appropriate directory (`demodulators/`, `visualizations/`, `device-drivers/`)
2. Implement all required interface methods
3. Write comprehensive unit tests
4. Add documentation and examples
5. Submit pull request

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## License

Plugins follow the same license as rad.io core. See [LICENSE](../../LICENSE).

## Support

- Documentation: [docs/](../../docs/)
- Issues: [GitHub Issues](https://github.com/alexthemitchell/rad.io/issues)
- Discussions: [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)

## Related Documentation

- [ADR-0024: Plugin System Architecture](../../docs/decisions/0024-plugin-system-architecture.md)
- [Architecture Documentation](../../ARCHITECTURE.md)
- [Contributing Guide](../../CONTRIBUTING.md)
