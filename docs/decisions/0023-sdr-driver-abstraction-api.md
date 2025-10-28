# ADR-0023: SDR Driver Abstraction API

Date: 2025-10-28

## Status

Accepted

## Context

The application previously had fragmented support for SDR hardware. While `ISDRDevice` interface existed, there was no unified system for:

1. **Driver Discovery**: No centralized mechanism to enumerate available device drivers
2. **Device Selection**: WebUSB device selection logic was scattered across components
3. **Driver Registration**: No plugin-style architecture for adding new hardware support
4. **Factory Pattern**: Manual device instantiation required knowledge of specific adapter classes
5. **Metadata**: Limited ability to query driver capabilities before instantiation

This made adding new hardware support difficult and created tight coupling between UI code and specific device implementations.

## Decision

We have implemented a comprehensive **TypeScript-first driver abstraction API** consisting of:

### 1. SDR Driver Registry (`src/drivers/SDRDriverRegistry.ts`)

A central registry that:

- Stores driver registrations with metadata and factory functions
- Matches USB devices to appropriate drivers
- Provides USB filters for WebUSB device discovery
- Creates device instances via factory pattern

**Key APIs:**

```typescript
// Register a driver
SDRDriverRegistry.register({
  metadata: { id, name, deviceType, capabilities, usbFilters, ... },
  factory: async (usbDevice) => new DriverAdapter(usbDevice)
});

// Find compatible driver
const driver = SDRDriverRegistry.getDriverForDevice(usbDevice);

// Create device instance
const device = await SDRDriverRegistry.createDevice(usbDevice);

// Get all USB filters for WebUSB
const filters = SDRDriverRegistry.getAllUSBFilters();
```

### 2. WebUSB Device Selector (`src/drivers/WebUSBDeviceSelector.ts`)

A user-friendly abstraction for WebUSB operations:

- Browser compatibility checks
- Device enumeration (previously paired devices)
- User device selection dialog
- Event handling for connect/disconnect
- Device information formatting

**Key APIs:**

```typescript
const selector = new WebUSBDeviceSelector();

// Check support
if (selector.isSupported()) {
  // Request device from user
  const device = await selector.requestDevice();

  // Get paired devices
  const devices = await selector.getDevices();

  // Setup event listeners
  selector.setupEventListeners(onConnect, onDisconnect);
}
```

### 3. Built-in Driver Registration (`src/drivers/registerBuiltinDrivers.ts`)

One-line registration of all built-in drivers:

- HackRF One (via `HackRFOneAdapter`)
- RTL-SDR (via `RTLSDRDeviceAdapter`)

**Usage:**

```typescript
import { registerBuiltinDrivers } from "./drivers";

// At app startup
registerBuiltinDrivers();
```

### 4. Driver Metadata Interface

Comprehensive metadata for each driver:

```typescript
interface SDRDriverMetadata {
  id: string; // Unique identifier
  name: string; // Human-readable name
  deviceType: SDRDeviceType; // Device type enum
  version: string; // Driver version
  description: string; // Brief description
  usbFilters: SDRUSBFilter[]; // USB device identification
  capabilities: SDRCapabilities; // Frequency, sample rates, gains, etc.
  requiresWebUSB: boolean; // WebUSB requirement flag
  documentationUrl?: string; // Optional docs link
  experimental?: boolean; // Stability flag
}
```

## Complete Usage Example

```typescript
import {
  registerBuiltinDrivers,
  SDRDriverRegistry,
  WebUSBDeviceSelector,
} from "./drivers";

// 1. Register drivers at app startup
registerBuiltinDrivers();

// 2. Request device from user
const selector = new WebUSBDeviceSelector();
const usbDevice = await selector.requestDevice();

// 3. Create appropriate driver instance
const sdrDevice = await SDRDriverRegistry.createDevice(usbDevice);

// 4. Use the device (standard ISDRDevice interface)
await sdrDevice.open();
await sdrDevice.setSampleRate(20e6);
await sdrDevice.setFrequency(100e6);
await sdrDevice.receive((samples) => {
  // Process IQ samples
});
```

## Consequences

### Positive

1. **Scalability**: Adding new hardware requires only implementing `ISDRDevice` and registering a driver
2. **Decoupling**: UI code doesn't need to know about specific device types
3. **Plugin Architecture**: Third-party drivers can be registered at runtime
4. **Type Safety**: Full TypeScript typing throughout the abstraction layer
5. **Discoverability**: Centralized registry makes it easy to enumerate available drivers
6. **WebUSB Best Practices**: Encapsulated in reusable `WebUSBDeviceSelector` class
7. **Testing**: Clear separation enables easier mocking and testing

### Negative

1. **Additional Abstraction**: One more layer between UI and devices (minimal overhead)
2. **Learning Curve**: Developers need to understand registry/factory pattern
3. **Migration**: Existing code needs to adopt new patterns (backward compatible)

### Neutral

1. **Existing Interface**: `ISDRDevice` remains unchanged, ensuring compatibility
2. **Adapters Preserved**: Existing `HackRFOneAdapter` and `RTLSDRDeviceAdapter` work as-is
3. **Optional Adoption**: New API can be adopted incrementally

## Implementation Details

### File Structure

```
src/drivers/
├── SDRDriverRegistry.ts          # Core registry
├── WebUSBDeviceSelector.ts       # WebUSB helper
├── DeviceDiscovery.ts            # Automatic device detection
├── DriverHotReload.ts            # Runtime driver updates
├── registerBuiltinDrivers.ts     # Built-in registrations
├── index.ts                      # Public API exports
└── __tests__/
    ├── SDRDriverRegistry.test.ts
    ├── WebUSBDeviceSelector.test.ts
    ├── DeviceDiscovery.test.ts
    ├── DriverHotReload.test.ts
    └── registerBuiltinDrivers.test.ts
```

### Test Coverage

- **SDRDriverRegistry**: 13 tests covering registration, matching, and factory
- **WebUSBDeviceSelector**: 8 tests covering browser support and formatting
- **DeviceDiscovery**: 14 tests covering automatic detection and enumeration
- **DriverHotReload**: 14 tests covering runtime driver updates and rollback
- **registerBuiltinDrivers**: 16 tests verifying driver metadata and instantiation
- **Total**: 65 tests with 100% coverage of new code

### Design Patterns Used

1. **Registry Pattern**: Central driver storage and lookup
2. **Factory Pattern**: Driver instantiation via factory functions
3. **Strategy Pattern**: Different drivers implement same interface
4. **Adapter Pattern**: Existing adapters work with registry

## Implemented Enhancements

1. **✅ Dynamic Discovery** (`DeviceDiscovery` class): Auto-detect and enumerate previously paired devices on page load
   - Automatic device detection from WebUSB paired devices
   - Optional auto-open functionality
   - Error handling for failed initializations
   - Device filtering with custom predicates
   - Event watching for connect/disconnect

2. **✅ Driver Hot-Reload** (`DriverHotReload` class): Unregister and re-register drivers at runtime
   - Runtime driver updates without application restart
   - Safe driver replacement with rollback on failure
   - Bulk driver reloading
   - Lifecycle callbacks (beforeUnload, afterLoad)
   - Useful for development, testing, and A/B testing

## Future Enhancements

1. **Capability Negotiation**: Request specific capabilities and find matching drivers
2. **Driver Versioning**: Support multiple versions of same driver
3. **Class/Protocol Matching**: Enhanced USB descriptor matching beyond vendor/product IDs
4. **Serial Number Filtering**: Support for device-specific serial number matching (partially supported via predicates)
5. **Driver Priority**: Allow multiple drivers for same device with priority ordering

## References

- **Interface**: `src/models/SDRDevice.ts` (ISDRDevice)
- **Adapters**:
  - `src/hackrf/HackRFOneAdapter.ts`
  - `src/models/RTLSDRDeviceAdapter.ts`
- **WebUSB Spec**: https://wicg.github.io/webusb/
- **Related ADRs**:
  - ADR-0020: E2E Testing Strategy (Mock device pattern)
  - ADR-0007: Type Safety Validation (TypeScript-first approach)

## Migration Path

For existing code using direct device instantiation:

### Before

```typescript
import { HackRFOneAdapter } from "./hackrf/HackRFOneAdapter";

const adapter = new HackRFOneAdapter(usbDevice);
await adapter.open();
```

### After

```typescript
import { SDRDriverRegistry, registerBuiltinDrivers } from "./drivers";

registerBuiltinDrivers();
const device = await SDRDriverRegistry.createDevice(usbDevice);
await device.open();
```

Both approaches remain valid, enabling gradual migration.
