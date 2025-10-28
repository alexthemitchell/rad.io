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
 * - registerBuiltinDrivers: One-line registration of built-in drivers
 *
 * Quick Start:
 * ```typescript
 * import { registerBuiltinDrivers, SDRDriverRegistry, WebUSBDeviceSelector } from './drivers';
 *
 * // 1. Register built-in drivers at app startup
 * registerBuiltinDrivers();
 *
 * // 2. Request device from user
 * const selector = new WebUSBDeviceSelector();
 * const usbDevice = await selector.requestDevice();
 *
 * // 3. Create driver instance
 * const sdrDevice = await SDRDriverRegistry.createDevice(usbDevice);
 *
 * // 4. Use the device
 * await sdrDevice.open();
 * await sdrDevice.setFrequency(100e6);
 * await sdrDevice.receive((samples) => {
 *   // Process samples
 * });
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

export { registerBuiltinDrivers } from "./registerBuiltinDrivers";
