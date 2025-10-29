# Plugin System Architecture

- Status: accepted
- Date: 2025-10-29
- Deciders: Development Team
- Technical Story: Implement extensible plugin system for SDR features

## Context and Problem Statement

As rad.io grows, the monolithic architecture can become tightly coupled and difficult to extend. Third-party developers and contributors need a way to add custom features like demodulators, visualizations, and device drivers without modifying core codebase. How can we design a plugin architecture that is type-safe, maintainable, and follows TypeScript best practices?

## Decision Drivers

- **Extensibility**: Allow third-party features without core modifications
- **Type Safety**: Maintain TypeScript strict mode compatibility
- **Developer Experience**: Clear APIs and good documentation
- **Performance**: Minimal overhead for plugin loading and execution
- **Security**: Sandboxing and validation of plugin code
- **Maintainability**: Easy to understand and test
- **Compatibility**: Works with existing rad.io architecture

## Considered Options

### Option 1: Dynamic Module Loading with `import()`

Use dynamic `import()` to load plugins at runtime from URLs or local files.

**Pros:**

- True dynamic loading
- Can load plugins from external sources
- Standard ES6 feature

**Cons:**

- Security risks (arbitrary code execution)
- TypeScript type checking limited
- Bundle size management complex
- CORS and CSP issues in browser

### Option 2: Registry Pattern with Compile-Time Plugins

Define plugin interfaces and registry, plugins registered at compile time.

**Pros:**

- Full TypeScript type safety
- No security risks
- Simple implementation
- Easy to test and debug
- Works well with webpack bundling

**Cons:**

- Requires recompilation for new plugins
- Not truly "dynamic" at runtime
- Less flexible than runtime loading

### Option 3: WebAssembly Plugin System

Compile plugins to WebAssembly modules for sandboxed execution.

**Pros:**

- Strong sandboxing
- Performance benefits
- Language-agnostic plugins

**Cons:**

- Complex implementation
- Limited browser APIs access
- Steep learning curve
- Overkill for current needs

## Decision Outcome

**Chosen option: "Option 2: Registry Pattern with Compile-Time Plugins"**

We implement a registry-based plugin system with strong TypeScript interfaces. Plugins are registered at compile time and managed through a central registry. This provides the best balance of type safety, security, and maintainability for the current stage of the project.

### Architecture Overview

```typescript
// Plugin hierarchy
Plugin (base interface)
  ├── DemodulatorPlugin
  ├── VisualizationPlugin
  ├── DeviceDriverPlugin
  └── UtilityPlugin

// Core components
PluginRegistry: Central registration and lifecycle management
BasePlugin: Abstract base class for plugin implementations
Plugin Types: Strong TypeScript interfaces for each plugin category
```

### Plugin Types Supported

1. **Demodulator Plugins**: Extract audio/data from IQ samples (FM, AM, SSB, digital modes)
2. **Visualization Plugins**: Custom displays for signal analysis (waterfall, constellation, etc.)
3. **Device Driver Plugins**: Support for new SDR hardware (RTL-SDR variants, custom devices)
4. **Utility Plugins**: General integrations and tools (logging, recording, analysis)

### Plugin Lifecycle

```
REGISTERED → initialize() → INITIALIZED → activate() → ACTIVE
                                          ←  deactivate() ←
                           ← dispose() ←
```

### Key Interfaces

**Base Plugin Interface:**

```typescript
interface Plugin {
  metadata: PluginMetadata;
  state: PluginState;
  initialize(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;
  getConfigSchema?(): PluginConfigSchema;
  updateConfig?(config: Record<string, unknown>): Promise<void>;
}
```

**Demodulator Plugin Interface:**

```typescript
interface DemodulatorPlugin extends Plugin {
  demodulate(samples: IQSample[]): Float32Array;
  getSupportedModes(): string[];
  setMode(mode: string): void;
  getParameters(): DemodulatorParameters;
  setParameters(params: Partial<DemodulatorParameters>): void;
}
```

**Visualization Plugin Interface:**

```typescript
interface VisualizationPlugin extends Plugin {
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void;
  update(samples: IQSample[]): void;
  resize(width: number, height: number): void;
  getCapabilities(): VisualizationCapabilities;
  takeSnapshot?(): Promise<string>;
}
```

**Device Driver Plugin Interface:**

```typescript
interface DeviceDriverPlugin extends Plugin {
  createDevice(usbDevice: USBDevice): Promise<ISDRDevice>;
  getUSBFilters(): USBDeviceFilter[];
  supportsDevice(device: USBDevice): boolean;
  getDeviceInfo(device: USBDevice): Promise<DeviceInfo>;
}
```

### Plugin Registry Features

- **Registration**: `register(plugin)` - Register and initialize plugin
- **Unregistration**: `unregister(pluginId)` - Clean up and remove plugin
- **Discovery**: `getPlugin(id)`, `getAllPlugins()`, `getPluginsByType(type)`
- **Dependency Management**: Validates and enforces plugin dependencies
- **Event System**: Listeners for registration, state changes, errors
- **Lifecycle Management**: Ensures proper state transitions

### Example Plugin Implementation

```typescript
class FMDemodulatorPlugin extends BasePlugin implements DemodulatorPlugin {
  constructor() {
    super({
      id: "fm-demodulator",
      name: "FM Demodulator",
      version: "1.0.0",
      type: PluginType.DEMODULATOR,
    });
  }

  demodulate(samples: IQSample[]): Float32Array {
    // FM demodulation logic
  }

  // ... other required methods
}

// Usage
const plugin = new FMDemodulatorPlugin();
await pluginRegistry.register(plugin);
await plugin.activate();
```

### Consequences

**Good:**

- Full TypeScript type safety across plugin system
- Simple, understandable architecture
- Easy to test (unit tests for each plugin)
- Secure (no arbitrary code execution)
- Works seamlessly with existing architecture
- Minimal runtime overhead
- Clear separation of concerns

**Bad:**

- Requires recompilation to add new plugins
- Cannot load plugins dynamically from URLs
- All plugins bundled (affects initial load time)
- Limited to JavaScript/TypeScript plugins

**Neutral:**

- Plugin discovery handled at compile time
- Configuration through TypeScript objects
- Dependency resolution manual (not NPM-based)

## Implementation Notes

### File Structure

```
src/
├── types/
│   └── plugin.ts              # Core plugin type definitions
├── lib/
│   ├── PluginRegistry.ts      # Registry implementation
│   └── BasePlugin.ts          # Base plugin class
├── plugins/
│   ├── index.ts               # Plugin exports
│   ├── demodulators/
│   │   ├── FMDemodulatorPlugin.ts
│   │   └── AMDemodulatorPlugin.ts
│   ├── visualizations/
│   │   ├── WaterfallVisualizationPlugin.ts
│   │   └── ConstellationPlugin.ts
│   └── device-drivers/
│       └── ExampleDeviceDriverPlugin.ts
```

### Testing Strategy

- Unit tests for plugin registry
- Unit tests for base plugin lifecycle
- Unit tests for each plugin implementation
- Integration tests for plugin interactions
- Mock plugins for testing registry behavior

### Configuration

Plugins support optional configuration through:

- `getConfigSchema()`: JSON Schema for validation
- `updateConfig(config)`: Update configuration at runtime
- Type-safe config objects in TypeScript

### Best Practices for Plugin Developers

1. Extend `BasePlugin` for automatic lifecycle management
2. Implement all required interface methods
3. Use proper error handling in hooks
4. Document configuration schema
5. Write unit tests for plugin logic
6. Follow rad.io coding standards

### Migration Path

For existing features that could become plugins:

1. Define appropriate plugin interface
2. Implement existing feature as plugin
3. Register plugin in global registry
4. Deprecate old implementation
5. Remove old code in next major version

### Future Enhancements

**Near Term (Current Architecture):**

- Hot reload during development
- Plugin marketplace/catalog UI
- Configuration UI for plugins
- Plugin sandboxing (resource limits)

**Long Term (Architecture Evolution):**

- Dynamic module loading (with security review)
- WebAssembly plugin support
- Cross-origin plugin loading
- NPM-based plugin distribution
- Plugin versioning and updates

### Security Considerations

Current implementation:

- All plugins compiled into bundle
- No runtime code execution
- TypeScript type checking enforced
- Dependency validation at registration

Future considerations:

- If dynamic loading added: CSP policies, origin validation
- Plugin permissions system
- Resource usage limits
- Signed plugins for verification

## Links

- [Plugin Types Definition](../../src/types/plugin.ts)
- [Plugin Registry Implementation](../../src/lib/PluginRegistry.ts)
- [Base Plugin Class](../../src/lib/BasePlugin.ts)
- [Example Plugins](../../src/plugins/)
- [ADR-0016: Signal Decoder Architecture](./0016-signal-decoder-architecture.md)
- [ADR-0023: SDR Driver Abstraction API](./0023-sdr-driver-abstraction-api.md)

## Related Decisions

- **ADR-0016**: Signal decoder architecture influenced plugin design patterns
- **ADR-0023**: SDR device interface used as model for plugin interfaces
- **ADR-0009**: State management pattern applies to plugin lifecycle
- **ADR-0007**: Type safety requirements enforced in plugin system
