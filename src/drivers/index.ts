/**
 * SDR Driver Abstraction API
 *
 * This module provides a unified, TypeScript-first API for SDR hardware drivers.
 * It enables scalable WebUSB support for multiple SDR devices and simplifies
 * future hardware expansion through a plugin-style architecture.
 *
 * Core Components:
 * - SDRDriverRegistry: Central registry for driver registration and discovery
 * - WebUSBDeviceSelector: User-friendly WebUSB device selection
 * - DeviceDiscovery: Automatic device detection and enumeration
 * - registerBuiltinDrivers: One-line registration of built-in drivers
 *
 * Quick Start:
 * ```typescript
 * import { registerBuiltinDrivers, SDRDriverRegistry, DeviceDiscovery } from './drivers';
 *
 * // 1. Register built-in drivers at app startup
 * registerBuiltinDrivers();
 *
 * // 2. Automatically discover paired devices
 * const discovery = new DeviceDiscovery();
 * const result = await discovery.discoverDevices({ autoOpen: true });
 *
 * // 3. Use discovered devices
 * for (const device of result.devices) {
 *   await device.setFrequency(100e6);
 *   await device.receive((samples) => {
 *     // Process samples
 *   });
 * }
 * ```
 *
 * @module drivers
 */

export {
  SDRDriverRegistry,
  type SDRDriverMetadata,
  type SDRDriverFactory,
  type SDRDriverRegistration,
} from "./SDRDriverRegistry";

export {
  WebUSBDeviceSelector,
  type DeviceSelectionOptions,
  type DeviceEnumerationResult,
} from "./WebUSBDeviceSelector";

export {
  DeviceDiscovery,
  type DeviceDiscoveryResult,
  type DeviceDiscoveryOptions,
} from "./DeviceDiscovery";

export {
  DriverHotReload,
  type HotReloadResult,
  type HotReloadOptions,
} from "./DriverHotReload";

export { registerBuiltinDrivers } from "./registerBuiltinDrivers";

// Export HackRF driver for direct use
export { HackRFOne, HackRFOneAdapter, createHackRFAdapter } from "./hackrf";
export type { DeviceInfo, StreamOptions } from "./hackrf";
export { useHackRFDevice } from "./hackrf/hooks/useHackRFDevice";
