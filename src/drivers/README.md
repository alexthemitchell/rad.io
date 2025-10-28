# SDR Driver Abstraction API

This module provides a unified, TypeScript-first API for SDR hardware drivers. It enables scalable WebUSB support for multiple SDR devices and simplifies future hardware expansion through a plugin-style architecture.

## Quick Start

```typescript
import {
  registerBuiltinDrivers,
  SDRDriverRegistry,
  WebUSBDeviceSelector,
} from "./drivers";

// 1. Register built-in drivers at app startup
registerBuiltinDrivers();

// 2. Request device from user
const selector = new WebUSBDeviceSelector();
const usbDevice = await selector.requestDevice();

// 3. Create appropriate driver instance
const device = await SDRDriverRegistry.createDevice(usbDevice);

// 4. Use the device (standard ISDRDevice interface)
await device.open();
await device.setSampleRate(20e6);
await device.setFrequency(100e6);
await device.receive((samples) => {
  // Process IQ samples
});
```

## Architecture

The driver abstraction consists of three main components:

### 1. SDRDriverRegistry

The central registry for SDR device drivers.

**Key Features:**

- Driver registration with metadata
- USB device matching
- Factory pattern for instantiation
- Filter aggregation for WebUSB

**Example:**

```typescript
// Register a custom driver
SDRDriverRegistry.register({
  metadata: {
    id: "my-sdr",
    name: "My Custom SDR",
    deviceType: SDRDeviceType.GENERIC,
    version: "1.0.0",
    description: "Custom SDR device driver",
    usbFilters: [{ vendorId: 0x1234, productId: 0x5678 }],
    capabilities: {
      minFrequency: 1e6,
      maxFrequency: 6e9,
      supportedSampleRates: [2e6, 4e6, 8e6],
      supportsAmpControl: true,
      supportsAntennaControl: false,
    },
    requiresWebUSB: true,
  },
  factory: async (usbDevice) => new MySDRAdapter(usbDevice),
});

// Get all USB filters for WebUSB
const filters = SDRDriverRegistry.getAllUSBFilters();

// Find driver for a specific USB device
const driver = SDRDriverRegistry.getDriverForDevice(usbDevice);

// Create device instance
const device = await SDRDriverRegistry.createDevice(usbDevice);
```

### 2. WebUSBDeviceSelector

User-friendly abstraction for WebUSB device selection.

**Key Features:**

- Browser compatibility checks
- Device enumeration
- Event handling (connect/disconnect)
- Device information formatting

**Example:**

```typescript
const selector = new WebUSBDeviceSelector();

// Check if WebUSB is supported
if (!selector.isSupported()) {
  console.error("WebUSB not supported in this browser");
  return;
}

// Request device from user (shows browser picker)
const device = await selector.requestDevice({
  useRegisteredDrivers: true, // Use filters from registry
  onConnect: (device) => console.log("Connected:", device),
  onDisconnect: (device) => console.log("Disconnected:", device),
});

// Get previously paired devices
const devices = await selector.getDevices();

// Enumerate devices with status
const result = await selector.enumerate();
console.log("Paired devices:", result.pairedDevices);
console.log("WebUSB supported:", result.supported);

// Format device info for display
const info = selector.formatDeviceInfo(device);
console.log(info); // "HackRF One [0x1d50:0x6089]"
```

### 3. Built-in Driver Registration

One-line registration of all built-in drivers.

**Example:**

```typescript
import { registerBuiltinDrivers } from "./drivers";

// At app startup
registerBuiltinDrivers();

// Now HackRF One and RTL-SDR drivers are available
```

## Built-in Drivers

### HackRF One

- **ID**: `hackrf-one`
- **Frequency Range**: 1 MHz - 6 GHz
- **Sample Rates**: 1-20 MHz
- **USB**: VID 0x1d50, PID 0x6089

### RTL-SDR

- **ID**: `rtl-sdr`
- **Frequency Range**: 24 MHz - 1.7 GHz
- **Sample Rates**: 225 kHz - 3.2 MHz
- **USB**: VID 0x0bda, PID 0x2838/0x2832

## Creating Custom Drivers

To add support for new hardware:

### 1. Implement ISDRDevice Interface

```typescript
import {
  ISDRDevice,
  SDRDeviceInfo,
  SDRCapabilities,
} from "../models/SDRDevice";

export class MySDRAdapter implements ISDRDevice {
  constructor(private usbDevice: USBDevice) {}

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return {
      type: SDRDeviceType.GENERIC,
      vendorId: 0x1234,
      productId: 0x5678,
      serialNumber: "ABC123",
    };
  }

  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 1e6,
      maxFrequency: 6e9,
      supportedSampleRates: [2e6, 4e6, 8e6],
      supportsAmpControl: true,
      supportsAntennaControl: false,
    };
  }

  // Implement all other ISDRDevice methods...
}
```

### 2. Register the Driver

```typescript
import { SDRDriverRegistry } from "./drivers";
import { MySDRAdapter } from "./MySDRAdapter";

SDRDriverRegistry.register({
  metadata: {
    id: "my-sdr",
    name: "My Custom SDR",
    deviceType: SDRDeviceType.GENERIC,
    version: "1.0.0",
    description: "Custom SDR device driver",
    usbFilters: [{ vendorId: 0x1234, productId: 0x5678 }],
    capabilities: {
      minFrequency: 1e6,
      maxFrequency: 6e9,
      supportedSampleRates: [2e6, 4e6, 8e6],
      supportsAmpControl: true,
      supportsAntennaControl: false,
    },
    requiresWebUSB: true,
    documentationUrl: "https://example.com/docs",
    experimental: false,
  },
  factory: async (usbDevice) => new MySDRAdapter(usbDevice),
});
```

### 3. Use the Driver

```typescript
const selector = new WebUSBDeviceSelector();
const usbDevice = await selector.requestDevice();
const device = await SDRDriverRegistry.createDevice(usbDevice);

// Use standard ISDRDevice interface
await device.open();
await device.setFrequency(100e6);
```

## API Reference

### SDRDriverRegistry

#### Static Methods

- `register(registration: SDRDriverRegistration): void`
  - Register a new driver
  - Throws if driver ID already exists

- `unregister(driverId: string): boolean`
  - Unregister a driver by ID
  - Returns true if found and removed

- `getAllDrivers(): SDRDriverRegistration[]`
  - Get all registered drivers

- `getDriverMetadata(driverId: string): SDRDriverMetadata | undefined`
  - Get metadata for a specific driver

- `getAllUSBFilters(): USBDeviceFilter[]`
  - Get all USB filters from all drivers
  - Useful for WebUSB requestDevice()

- `getDriverForDevice(usbDevice: USBDevice): SDRDriverRegistration | undefined`
  - Find the best matching driver for a device

- `createDevice(usbDevice: USBDevice): Promise<ISDRDevice>`
  - Create device instance using matched driver
  - Throws if no compatible driver found

- `clear(): void`
  - Remove all registered drivers (for testing)

### WebUSBDeviceSelector

#### Methods

- `isSupported(): boolean`
  - Check if WebUSB is available in the browser

- `requestDevice(options?: DeviceSelectionOptions): Promise<USBDevice | undefined>`
  - Show browser device picker
  - Returns undefined if user cancels

- `getDevices(): Promise<USBDevice[]>`
  - Get previously authorized/paired devices

- `enumerate(): Promise<DeviceEnumerationResult>`
  - Enumerate devices with status information

- `setupEventListeners(onConnect?, onDisconnect?): void`
  - Setup connect/disconnect event handlers

- `removeEventListeners(): void`
  - Remove event listeners

- `formatDeviceInfo(device: USBDevice): string`
  - Format device info for display

### Types

#### SDRDriverMetadata

```typescript
interface SDRDriverMetadata {
  id: string;
  name: string;
  deviceType: SDRDeviceType;
  version: string;
  description: string;
  usbFilters: SDRUSBFilter[];
  capabilities: SDRCapabilities;
  requiresWebUSB: boolean;
  documentationUrl?: string;
  experimental?: boolean;
}
```

#### SDRDriverRegistration

```typescript
interface SDRDriverRegistration {
  metadata: SDRDriverMetadata;
  factory: SDRDriverFactory;
}

type SDRDriverFactory = (usbDevice: USBDevice) => Promise<ISDRDevice>;
```

#### DeviceSelectionOptions

```typescript
interface DeviceSelectionOptions {
  filters?: USBDeviceFilter[];
  useRegisteredDrivers?: boolean;
  onConnect?: (device: USBDevice) => void;
  onDisconnect?: (device: USBDevice) => void;
}
```

## Best Practices

### 1. Register Drivers Early

Call `registerBuiltinDrivers()` at app startup, before any device operations.

### 2. Handle Browser Compatibility

Always check `selector.isSupported()` before using WebUSB.

### 3. User Interaction Required

WebUSB requires explicit user gesture (button click) to show device picker.

### 4. Error Handling

```typescript
try {
  const device = await selector.requestDevice();
  if (!device) {
    // User cancelled
    return;
  }

  const sdrDevice = await SDRDriverRegistry.createDevice(device);
  await sdrDevice.open();
} catch (error) {
  if (error.name === "NotFoundError") {
    // No compatible device found
  } else {
    // Other error
    console.error("Error:", error);
  }
}
```

### 5. Cleanup

```typescript
// Remove event listeners when component unmounts
useEffect(() => {
  selector.setupEventListeners(handleConnect, handleDisconnect);

  return () => {
    selector.removeEventListeners();
  };
}, []);
```

## Testing

All components are fully tested:

- `SDRDriverRegistry.test.ts` - 13 tests
- `WebUSBDeviceSelector.test.ts` - 8 tests
- `DeviceDiscovery.test.ts` - 14 tests
- `DriverHotReload.test.ts` - 14 tests
- `registerBuiltinDrivers.test.ts` - 16 tests

Run tests:

```bash
npm test -- src/drivers/__tests__
```

## Migration Guide

### From Direct Instantiation

**Before:**

```typescript
import { HackRFOneAdapter } from "./hackrf/HackRFOneAdapter";

const adapter = new HackRFOneAdapter(usbDevice);
await adapter.open();
```

**After:**

```typescript
import { SDRDriverRegistry, registerBuiltinDrivers } from "./drivers";

registerBuiltinDrivers();
const device = await SDRDriverRegistry.createDevice(usbDevice);
await device.open();
```

### Benefits

- ✅ Automatic driver selection
- ✅ Centralized configuration
- ✅ Easy to add new hardware
- ✅ Type-safe throughout
- ✅ Backward compatible

## Further Reading

- [ADR-0023: SDR Driver Abstraction API](../../docs/decisions/0023-sdr-driver-abstraction-api.md)
- [ISDRDevice Interface](../models/SDRDevice.ts)
- [WebUSB Specification](https://wicg.github.io/webusb/)
- [HackRF One Documentation](https://hackrf.readthedocs.io/)
- [RTL-SDR Documentation](https://osmocom.org/projects/rtl-sdr/wiki)
