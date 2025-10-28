/**
 * Device Discovery Utilities
 *
 * Provides automatic device detection and enumeration functionality
 * for SDR hardware. Extends the driver abstraction with dynamic discovery
 * capabilities for previously paired devices.
 */

import { SDRDriverRegistry } from "./SDRDriverRegistry";
import { WebUSBDeviceSelector } from "./WebUSBDeviceSelector";
import type { ISDRDevice } from "../models/SDRDevice";

/**
 * Result of device discovery operation
 */
export interface DeviceDiscoveryResult {
  /** Successfully discovered and initialized devices */
  devices: ISDRDevice[];

  /** USB devices that were found but failed to initialize */
  failedDevices: Array<{
    usbDevice: USBDevice;
    error: Error;
  }>;

  /** Whether discovery is supported in this browser */
  supported: boolean;
}

/**
 * Options for device discovery
 */
export interface DeviceDiscoveryOptions {
  /** Whether to automatically open discovered devices */
  autoOpen?: boolean;

  /** Callback invoked for each discovered device */
  onDeviceDiscovered?: (device: ISDRDevice, usbDevice: USBDevice) => void;

  /** Callback invoked when a device fails to initialize */
  onDeviceError?: (usbDevice: USBDevice, error: Error) => void;
}

/**
 * Device Discovery Manager
 *
 * Provides automatic detection and initialization of connected SDR devices.
 * Works with WebUSB API to find previously paired devices and instantiate
 * appropriate drivers from the registry.
 *
 * Example usage:
 * ```typescript
 * const discovery = new DeviceDiscovery();
 *
 * // Discover all paired devices
 * const result = await discovery.discoverDevices({
 *   autoOpen: true,
 *   onDeviceDiscovered: (device) => console.log('Found:', device)
 * });
 *
 * console.log(`Discovered ${result.devices.length} devices`);
 * ```
 */
export class DeviceDiscovery {
  private selector: WebUSBDeviceSelector;

  constructor() {
    this.selector = new WebUSBDeviceSelector();
  }

  /**
   * Check if device discovery is supported in this browser
   */
  isSupported(): boolean {
    return this.selector.isSupported();
  }

  /**
   * Discover all previously paired SDR devices
   *
   * Enumerates all USB devices that have been previously authorized by the user,
   * matches them against registered drivers, and optionally initializes them.
   *
   * @param options - Discovery options
   * @returns Discovery result with devices and any errors
   */
  async discoverDevices(
    options: DeviceDiscoveryOptions = {},
  ): Promise<DeviceDiscoveryResult> {
    const result: DeviceDiscoveryResult = {
      devices: [],
      failedDevices: [],
      supported: this.isSupported(),
    };

    if (!result.supported) {
      return result;
    }

    try {
      // Get all previously paired USB devices
      const usbDevices = await this.selector.getDevices();

      // Try to initialize each device
      for (const usbDevice of usbDevices) {
        try {
          // Check if we have a driver for this device
          const driverRegistration =
            SDRDriverRegistry.getDriverForDevice(usbDevice);

          if (!driverRegistration) {
            // Skip devices with no registered driver
            continue;
          }

          // Create device instance using registry
          const device = await SDRDriverRegistry.createDevice(usbDevice);

          // Optionally open the device
          if (options.autoOpen && !device.isOpen()) {
            await device.open();
          }

          // Add to results
          result.devices.push(device);

          // Invoke callback if provided
          if (options.onDeviceDiscovered) {
            options.onDeviceDiscovered(device, usbDevice);
          }
        } catch (error) {
          // Device failed to initialize
          const err = error instanceof Error ? error : new Error(String(error));

          result.failedDevices.push({
            usbDevice,
            error: err,
          });

          // Invoke error callback if provided
          if (options.onDeviceError) {
            options.onDeviceError(usbDevice, err);
          }
        }
      }
    } catch (error) {
      // Failed to enumerate devices
      console.error("Device discovery failed:", error);
    }

    return result;
  }

  /**
   * Discover devices matching specific criteria
   *
   * @param predicate - Function to filter devices by their metadata
   * @param options - Discovery options
   * @returns Discovery result with matching devices
   */
  async discoverMatchingDevices(
    predicate: (device: ISDRDevice, usbDevice: USBDevice) => boolean,
    options: DeviceDiscoveryOptions = {},
  ): Promise<DeviceDiscoveryResult> {
    // First discover all devices
    const allDevices = await this.discoverDevices({
      ...options,
      onDeviceDiscovered: undefined, // Don't call callback yet
    });

    // Filter devices by predicate
    const filteredDevices: ISDRDevice[] = [];
    const filteredFailed = [...allDevices.failedDevices];

    for (const device of allDevices.devices) {
      // Get the USB device for this SDR device
      // We need to match based on device info
      const deviceInfo = await device.getDeviceInfo();

      // Create a mock USB device for predicate matching
      const mockUSB = {
        vendorId: deviceInfo.vendorId,
        productId: deviceInfo.productId,
      } as USBDevice;

      if (predicate(device, mockUSB)) {
        filteredDevices.push(device);

        // Invoke callback for matched devices
        if (options.onDeviceDiscovered) {
          options.onDeviceDiscovered(device, mockUSB);
        }
      }
    }

    return {
      devices: filteredDevices,
      failedDevices: filteredFailed,
      supported: allDevices.supported,
    };
  }

  /**
   * Watch for device connection and disconnection events
   *
   * @param onConnect - Callback when a device is connected
   * @param onDisconnect - Callback when a device is disconnected
   */
  watchDevices(
    onConnect: (device: USBDevice) => void,
    onDisconnect: (device: USBDevice) => void,
  ): void {
    this.selector.setupEventListeners(onConnect, onDisconnect);
  }

  /**
   * Stop watching for device events
   */
  stopWatching(): void {
    this.selector.removeEventListeners();
  }
}
