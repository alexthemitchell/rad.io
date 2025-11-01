# Plugin API Reference

Complete API reference for the rad.io plugin system.

## Table of Contents

- [Core Interfaces](#core-interfaces)
- [Plugin Types](#plugin-types)
- [Plugin Registry](#plugin-registry)
- [Base Plugin Class](#base-plugin-class)
- [Plugin States](#plugin-states)
- [Plugin Events](#plugin-events)
- [Configuration](#configuration)

## Core Interfaces

### Plugin

Base interface that all plugins must implement.

```typescript
interface Plugin {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;

  /** Current plugin state */
  readonly state: PluginState;

  /** Initialize the plugin (called once when registered) */
  initialize(): Promise<void>;

  /** Activate the plugin (start functionality) */
  activate(): Promise<void>;

  /** Deactivate the plugin (stop functionality) */
  deactivate(): Promise<void>;

  /** Clean up plugin resources (called before removal) */
  dispose(): Promise<void>;

  /** Get plugin configuration schema (optional) */
  getConfigSchema?(): PluginConfigSchema;

  /** Update plugin configuration (optional) */
  updateConfig?(config: Record<string, unknown>): Promise<void>;
}
```

### PluginMetadata

Plugin identification and version information.

```typescript
interface PluginMetadata {
  /** Unique identifier for the plugin */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin version (semver format) */
  version: string;

  /** Plugin author information */
  author: string;

  /** Brief description of plugin functionality */
  description: string;

  /** Plugin type category */
  type: PluginType;

  /** Optional homepage or documentation URL */
  homepage?: string;

  /** Plugin dependencies (other plugin IDs required) */
  dependencies?: string[];

  /** Minimum rad.io version required */
  minRadioVersion?: string;
}
```

**Example:**

```typescript
const metadata: PluginMetadata = {
  id: "my-demodulator",
  name: "My Custom Demodulator",
  version: "1.0.0",
  author: "John Doe",
  description: "Custom demodulation algorithm",
  type: PluginType.DEMODULATOR,
  homepage: "https://github.com/johndoe/my-demodulator",
  dependencies: ["required-plugin-id"],
  minRadioVersion: "0.1.0",
};
```

## Plugin Types

### PluginType Enum

```typescript
enum PluginType {
  /** Signal demodulator plugin */
  DEMODULATOR = "demodulator",

  /** Visualization component plugin */
  VISUALIZATION = "visualization",

  /** SDR device driver plugin */
  DEVICE_DRIVER = "device-driver",

  /** General utility/integration plugin */
  UTILITY = "utility",
}
```

### DemodulatorPlugin

Interface for signal demodulation plugins.

```typescript
interface DemodulatorPlugin extends Plugin {
  metadata: PluginMetadata & { type: PluginType.DEMODULATOR };

  /**
   * Demodulate IQ samples to audio
   * @param samples - Input IQ samples
   * @returns Audio samples (mono, typically 48kHz)
   */
  demodulate(samples: IQSample[]): Float32Array;

  /** Get supported modulation types */
  getSupportedModes(): string[];

  /** Set demodulation mode */
  setMode(mode: string): void;

  /** Get current demodulation parameters */
  getParameters(): DemodulatorParameters;

  /** Update demodulation parameters */
  setParameters(params: Partial<DemodulatorParameters>): void;
}
```

**Parameters:**

```typescript
interface DemodulatorParameters {
  /** Audio output sample rate in Hz */
  audioSampleRate: number;

  /** Demodulation bandwidth in Hz */
  bandwidth: number;

  /** Squelch threshold (0-100) */
  squelch?: number;

  /** Automatic Frequency Control enabled */
  afcEnabled?: boolean;

  /** Additional mode-specific parameters */
  [key: string]: unknown;
}
```

**Example:**

```typescript
class MyDemodulator extends BasePlugin implements DemodulatorPlugin {
  demodulate(samples: IQSample[]): Float32Array {
    const output = new Float32Array(samples.length);
    // Demodulation logic here
    return output;
  }

  getSupportedModes(): string[] {
    return ["am", "fm"];
  }

  setMode(mode: string): void {
    // Switch demodulation mode
  }

  getParameters(): DemodulatorParameters {
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

### VisualizationPlugin

Interface for custom visualization plugins.

```typescript
interface VisualizationPlugin extends Plugin {
  metadata: PluginMetadata & { type: PluginType.VISUALIZATION };

  /**
   * Render visualization to canvas
   * @param canvas - Target canvas element
   * @param dataSource - Data source to visualize
   */
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void;

  /**
   * Update visualization with new data
   * @param samples - New IQ samples to display
   */
  update(samples: IQSample[]): void;

  /**
   * Resize visualization
   * @param width - New width in pixels
   * @param height - New height in pixels
   */
  resize(width: number, height: number): void;

  /** Get visualization capabilities */
  getCapabilities(): VisualizationCapabilities;

  /**
   * Take a snapshot of the current visualization
   * @returns Data URL of the snapshot image
   */
  takeSnapshot?(): string | Promise<string>;
}
```

**Capabilities:**

```typescript
interface VisualizationCapabilities {
  /** Supports real-time updates */
  supportsRealtime: boolean;

  /** Supports offline/recorded data */
  supportsOffline: boolean;

  /** Supports WebGL acceleration */
  supportsWebGL: boolean;

  /** Minimum update rate in Hz */
  minUpdateRate: number;

  /** Maximum update rate in Hz */
  maxUpdateRate: number;

  /** Preferred aspect ratio (width/height) */
  preferredAspectRatio?: number;
}
```

**Example:**

```typescript
class MyVisualization extends BasePlugin implements VisualizationPlugin {
  private canvas: HTMLCanvasElement | null = null;

  render(canvas: HTMLCanvasElement, dataSource: DataSource): void {
    this.canvas = canvas;
    void dataSource.startStreaming((samples) => {
      this.update(samples);
    });
  }

  update(samples: IQSample[]): void {
    // Update visualization with new samples
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  getCapabilities(): VisualizationCapabilities {
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

### DeviceDriverPlugin

Interface for SDR device driver plugins.

```typescript
interface DeviceDriverPlugin extends Plugin {
  metadata: PluginMetadata & { type: PluginType.DEVICE_DRIVER };

  /**
   * Create a device instance
   * @param usbDevice - WebUSB device to wrap
   * @returns SDR device instance
   */
  createDevice(usbDevice: USBDevice): Promise<ISDRDevice>;

  /** Get USB device filters for device detection */
  getUSBFilters(): USBDeviceFilter[];

  /**
   * Check if a USB device is supported
   * @param device - USB device to check
   */
  supportsDevice(device: USBDevice): boolean;

  /** Get device information from USB device */
  getDeviceInfo(device: USBDevice): Promise<{
    manufacturer: string;
    model: string;
    serialNumber?: string;
  }>;
}
```

**Example:**

```typescript
class MyDeviceDriver extends BasePlugin implements DeviceDriverPlugin {
  private static readonly VENDOR_ID = 0x1234;
  private static readonly PRODUCT_ID = 0x5678;

  async createDevice(usbDevice: USBDevice): Promise<ISDRDevice> {
    return new MySDRDevice(usbDevice);
  }

  getUSBFilters(): USBDeviceFilter[] {
    return [
      {
        vendorId: MyDeviceDriver.VENDOR_ID,
        productId: MyDeviceDriver.PRODUCT_ID,
      },
    ];
  }

  supportsDevice(device: USBDevice): boolean {
    return (
      device.vendorId === MyDeviceDriver.VENDOR_ID &&
      device.productId === MyDeviceDriver.PRODUCT_ID
    );
  }

  async getDeviceInfo(device: USBDevice) {
    return {
      manufacturer: "My Company",
      model: "SDR-1000",
      serialNumber: device.serialNumber ?? undefined,
    };
  }
}
```

## Plugin Registry

The global plugin registry manages plugin lifecycle and discovery.

### PluginRegistry Interface

```typescript
interface PluginRegistry {
  /** Register a plugin */
  register(plugin: Plugin): Promise<void>;

  /** Unregister a plugin */
  unregister(pluginId: string): Promise<void>;

  /** Get a registered plugin by ID */
  getPlugin(pluginId: string): Plugin | undefined;

  /** Get all registered plugins */
  getAllPlugins(): Plugin[];

  /** Get plugins by type */
  getPluginsByType(type: PluginType): Plugin[];

  /** Check if a plugin is registered */
  hasPlugin(pluginId: string): boolean;

  /** Add event listener */
  addEventListener(listener: PluginEventListener): void;

  /** Remove event listener */
  removeEventListener(listener: PluginEventListener): void;

  /** Clear all plugins */
  clear(): Promise<void>;
}
```

### Global Instance

```typescript
import { pluginRegistry } from "./plugins";

// Register a plugin
const plugin = new MyPlugin();
await pluginRegistry.register(plugin);

// Get a plugin
const myPlugin = pluginRegistry.getPlugin("my-plugin-id");

// Get all demodulators
const demodulators = pluginRegistry.getPluginsByType(PluginType.DEMODULATOR);

// Unregister
await pluginRegistry.unregister("my-plugin-id");
```

### Registry Methods

#### register(plugin: Plugin): Promise<void>

Registers a plugin with the registry.

- Validates plugin metadata
- Checks for duplicate IDs
- Validates dependencies
- Calls `plugin.initialize()`
- Emits `REGISTERED` event

**Throws:**

- If plugin ID already registered
- If dependencies not satisfied
- If initialization fails

**Example:**

```typescript
const plugin = new MyPlugin();
await pluginRegistry.register(plugin);
console.log(plugin.state); // PluginState.INITIALIZED
```

#### unregister(pluginId: string): Promise<void>

Unregisters a plugin from the registry.

- Checks for dependent plugins
- Calls `plugin.deactivate()` if active
- Calls `plugin.dispose()`
- Removes from registry
- Emits `UNREGISTERED` event

**Throws:**

- If plugin not found
- If other plugins depend on it
- If cleanup fails

**Example:**

```typescript
await pluginRegistry.unregister("my-plugin-id");
```

#### getPlugin(pluginId: string): Plugin | undefined

Get a plugin by its ID.

**Example:**

```typescript
const plugin = pluginRegistry.getPlugin("fm-demodulator");
if (plugin) {
  await plugin.activate();
}
```

#### getPluginsByType(type: PluginType): Plugin[]

Get all plugins of a specific type.

**Example:**

```typescript
const demodulators = pluginRegistry.getPluginsByType(PluginType.DEMODULATOR);
const visualizations = pluginRegistry.getPluginsByType(
  PluginType.VISUALIZATION,
);
```

## Base Plugin Class

Abstract base class providing common plugin functionality.

```typescript
abstract class BasePlugin implements Plugin {
  constructor(public readonly metadata: PluginMetadata);

  get state(): PluginState;

  async initialize(): Promise<void>;
  async activate(): Promise<void>;
  async deactivate(): Promise<void>;
  async dispose(): Promise<void>;

  async updateConfig(config: Record<string, unknown>): Promise<void>;

  protected abstract onInitialize(): void | Promise<void>;
  protected abstract onActivate(): void | Promise<void>;
  protected abstract onDeactivate(): void | Promise<void>;
  protected abstract onDispose(): void | Promise<void>;
  protected onConfigUpdate?(config: Record<string, unknown>): void | Promise<void>;
}
```

### Lifecycle Hooks

Plugins extending `BasePlugin` implement these hooks:

#### onInitialize(): void | Promise<void>

Called during `initialize()`. Set up initial state.

```typescript
protected onInitialize(): void {
  this.buffer = new Float32Array(1024);
  this.state = initialState;
}
```

#### onActivate(): void | Promise<void>

Called during `activate()`. Start plugin functionality.

```typescript
protected async onActivate(): Promise<void> {
  this.worker = new Worker("./worker.js");
  this.animationId = requestAnimationFrame(this.render);
}
```

#### onDeactivate(): void | Promise<void>

Called during `deactivate()`. Stop plugin but keep state.

```typescript
protected onDeactivate(): void {
  if (this.animationId) {
    cancelAnimationFrame(this.animationId);
  }
}
```

#### onDispose(): void | Promise<void>

Called during `dispose()`. Clean up all resources.

```typescript
protected async onDispose(): Promise<void> {
  if (this.worker) {
    this.worker.terminate();
    this.worker = null;
  }
  this.buffer = null;
}
```

#### onConfigUpdate(config: Record<string, unknown>): void | Promise<void>

Called during `updateConfig()`. Apply configuration changes.

```typescript
protected onConfigUpdate(config: Record<string, unknown>): void {
  if (typeof config["mode"] === "string") {
    this.setMode(config["mode"]);
  }
}
```

## Plugin States

### PluginState Enum

```typescript
enum PluginState {
  /** Plugin is registered but not initialized */
  REGISTERED = "registered",

  /** Plugin is initialized and ready */
  INITIALIZED = "initialized",

  /** Plugin is currently active/running */
  ACTIVE = "active",

  /** Plugin encountered an error */
  ERROR = "error",

  /** Plugin is disabled */
  DISABLED = "disabled",
}
```

### State Transitions

```
REGISTERED → initialize() → INITIALIZED → activate() → ACTIVE
                                         ← deactivate() ←
              ← dispose() ←
```

**Valid transitions:**

- `REGISTERED` → `INITIALIZED` (via `initialize()`)
- `INITIALIZED` → `ACTIVE` (via `activate()`)
- `ACTIVE` → `INITIALIZED` (via `deactivate()`)
- Any state → `ERROR` (on exception)

**Invalid transitions:**

- Cannot activate from `REGISTERED` (must initialize first)
- Cannot dispose active plugin (must deactivate first)

## Plugin Events

### PluginEvent Enum

```typescript
enum PluginEvent {
  /** Plugin was registered */
  REGISTERED = "registered",

  /** Plugin was unregistered */
  UNREGISTERED = "unregistered",

  /** Plugin state changed */
  STATE_CHANGED = "state-changed",

  /** Plugin error occurred */
  ERROR = "error",
}
```

### PluginEventData

```typescript
interface PluginEventData {
  plugin: Plugin;
  event: PluginEvent;
  timestamp: number;
  error?: Error;
  previousState?: PluginState;
  newState?: PluginState;
}
```

### Event Listeners

```typescript
type PluginEventListener = (event: PluginEventData) => void;

// Add listener
pluginRegistry.addEventListener((event: PluginEventData) => {
  console.log(`Plugin ${event.plugin.metadata.name} ${event.event}`);
  if (event.error) {
    console.error("Error:", event.error);
  }
});

// Remove listener
pluginRegistry.removeEventListener(myListener);
```

## Configuration

### PluginConfigSchema

JSON Schema-like configuration definition.

```typescript
interface PluginConfigSchema {
  properties: Record<string, PropertySchema>;
  required?: string[];
}

interface PropertySchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}
```

### Example Configuration

```typescript
class MyPlugin extends BasePlugin {
  override getConfigSchema(): PluginConfigSchema {
    return {
      properties: {
        mode: {
          type: "string",
          description: "Operation mode",
          enum: ["mode1", "mode2"],
          default: "mode1",
        },
        threshold: {
          type: "number",
          description: "Detection threshold",
          minimum: 0,
          maximum: 100,
          default: 50,
        },
        enabled: {
          type: "boolean",
          description: "Enable processing",
          default: true,
        },
      },
      required: ["mode"],
    };
  }

  protected override onConfigUpdate(config: Record<string, unknown>): void {
    if (typeof config["mode"] === "string") {
      this.mode = config["mode"];
    }
    if (typeof config["threshold"] === "number") {
      this.threshold = config["threshold"];
    }
  }
}

// Usage
await plugin.updateConfig({
  mode: "mode2",
  threshold: 75,
  enabled: false,
});
```

## Common Patterns

### Error Handling

```typescript
try {
  await plugin.initialize();
  await plugin.activate();
} catch (error) {
  console.error("Plugin failed:", error);
  // Plugin state is set to ERROR automatically
}
```

### Dependency Management

```typescript
const metadata: PluginMetadata = {
  id: "my-plugin",
  // ...
  dependencies: ["required-plugin-1", "required-plugin-2"],
};

// Dependencies must be registered first
await pluginRegistry.register(requiredPlugin1);
await pluginRegistry.register(requiredPlugin2);
await pluginRegistry.register(myPlugin); // OK
```

### Cleanup

```typescript
// Proper cleanup order
await plugin.deactivate(); // Stop activity
await pluginRegistry.unregister(plugin.metadata.id); // Dispose and remove
```

## Best Practices

1. **Always extend BasePlugin**: Provides automatic lifecycle management
2. **Validate input**: Check parameters in public methods
3. **Handle errors gracefully**: Use try-catch in lifecycle hooks
4. **Clean up resources**: Release all resources in `onDispose()`
5. **Document configuration**: Provide clear schema with descriptions
6. **Test thoroughly**: Unit test all plugin methods
7. **Follow naming conventions**: Use consistent naming for plugin IDs

## Examples

See the [example plugins](../../src/plugins/) directory for complete reference implementations:

- **FMDemodulatorPlugin**: Complete FM demodulator
- **WaterfallVisualizationPlugin**: Waterfall display
- **ExampleDeviceDriverPlugin**: Device driver template

## Related Documentation

- [Creating Your First Plugin Tutorial](../tutorials/03-creating-plugins.md)
- [How-to: Create a Demodulator Plugin](../how-to/create-demodulator-plugin.md)
- [How-to: Create a Visualization Plugin](../how-to/create-visualization-plugin.md)
- [How-to: Create a Device Driver Plugin](../how-to/create-device-driver-plugin.md)
- [Plugin System Architecture (ADR-0024)](../decisions/0024-plugin-system-architecture.md)
