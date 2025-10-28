/**
 * SDR Driver Registry and Factory
 *
 * This module provides a centralized registry for SDR device drivers,
 * enabling dynamic driver discovery, enumeration, and instantiation.
 *
 * Key features:
 * - Driver registration with metadata
 * - USB device matching and driver selection
 * - Factory pattern for driver instantiation
 * - WebUSB integration helpers
 */

import {
  ISDRDevice,
  SDRCapabilities,
  SDRDeviceType,
  SDRUSBFilter,
} from "../models/SDRDevice";

/**
 * Metadata about an SDR driver implementation
 */
export interface SDRDriverMetadata {
  /** Unique identifier for this driver */
  readonly id: string;

  /** Human-readable driver name */
  readonly name: string;

  /** Device type this driver supports */
  readonly deviceType: SDRDeviceType;

  /** Driver version */
  readonly version: string;

  /** Brief description of the driver */
  readonly description: string;

  /** USB device filters for identifying compatible hardware */
  readonly usbFilters: SDRUSBFilter[];

  /** Static capabilities (may be refined after device connection) */
  readonly capabilities: SDRCapabilities;

  /** Whether this driver requires WebUSB */
  readonly requiresWebUSB: boolean;

  /** Optional documentation URL */
  readonly documentationUrl?: string;

  /** Whether this driver is experimental */
  readonly experimental?: boolean;
}

/**
 * Factory function for creating driver instances
 */
export type SDRDriverFactory = (usbDevice: USBDevice) => Promise<ISDRDevice>;

/**
 * Complete driver registration entry
 */
export interface SDRDriverRegistration {
  /** Driver metadata */
  readonly metadata: SDRDriverMetadata;

  /** Factory function for creating instances */
  readonly factory: SDRDriverFactory;
}

/**
 * Central registry for SDR device drivers
 *
 * This class provides:
 * - Driver registration and discovery
 * - USB device matching
 * - Driver instantiation via factory pattern
 *
 * Example usage:
 * ```typescript
 * // Register a driver
 * SDRDriverRegistry.register({
 *   metadata: { ... },
 *   factory: async (usbDevice) => new MyDriver(usbDevice)
 * });
 *
 * // Find compatible driver
 * const driver = SDRDriverRegistry.getDriverForDevice(usbDevice);
 *
 * // Create driver instance
 * const device = await SDRDriverRegistry.createDevice(usbDevice);
 * ```
 */
export class SDRDriverRegistry {
  private static drivers: Map<string, SDRDriverRegistration> = new Map();

  /**
   * Register a new SDR driver
   * @param registration - Driver registration with metadata and factory
   * @throws Error if driver with same ID is already registered
   */
  static register(registration: SDRDriverRegistration): void {
    const { id } = registration.metadata;

    if (this.drivers.has(id)) {
      throw new Error(
        `Driver with ID "${id}" is already registered. ` +
          `Use unregister() first if you need to replace it.`,
      );
    }

    this.drivers.set(id, registration);
  }

  /**
   * Unregister a driver by ID
   * @param driverId - Unique driver identifier
   * @returns true if driver was found and removed, false otherwise
   */
  static unregister(driverId: string): boolean {
    return this.drivers.delete(driverId);
  }

  /**
   * Get all registered drivers
   * @returns Array of all registered drivers
   */
  static getAllDrivers(): SDRDriverRegistration[] {
    return Array.from(this.drivers.values());
  }

  /**
   * Get driver metadata by ID
   * @param driverId - Unique driver identifier
   * @returns Driver metadata or undefined if not found
   */
  static getDriverMetadata(driverId: string): SDRDriverMetadata | undefined {
    return this.drivers.get(driverId)?.metadata;
  }

  /**
   * Get all USB filters for device discovery
   * Useful for WebUSB navigator.usb.requestDevice()
   * @returns Array of all USB filters from all registered drivers
   */
  static getAllUSBFilters(): USBDeviceFilter[] {
    const filters: USBDeviceFilter[] = [];

    for (const driver of this.drivers.values()) {
      for (const filter of driver.metadata.usbFilters) {
        filters.push({
          vendorId: filter.vendorId,
          productId: filter.productId,
          classCode: filter.classCode,
          subclassCode: filter.subclassCode,
          protocolCode: filter.protocolCode,
          serialNumber: filter.serialNumber,
        });
      }
    }

    return filters;
  }

  /**
   * Find the best matching driver for a USB device
   * @param usbDevice - USB device to match
   * @returns Driver registration or undefined if no match found
   */
  static getDriverForDevice(
    usbDevice: USBDevice,
  ): SDRDriverRegistration | undefined {
    for (const driver of this.drivers.values()) {
      if (this.matchesDevice(driver.metadata, usbDevice)) {
        return driver;
      }
    }
    return undefined;
  }

  /**
   * Create an SDR device instance for the given USB device
   * @param usbDevice - USB device to create driver for
   * @returns Instantiated SDR device
   * @throws Error if no compatible driver is found
   */
  static async createDevice(usbDevice: USBDevice): Promise<ISDRDevice> {
    const driver = this.getDriverForDevice(usbDevice);

    if (!driver) {
      throw new Error(
        `No compatible driver found for USB device ` +
          `(vendorId: 0x${usbDevice.vendorId.toString(16)}, ` +
          `productId: 0x${usbDevice.productId.toString(16)})`,
      );
    }

    return driver.factory(usbDevice);
  }

  /**
   * Check if a USB device matches a driver's filters
   * @param metadata - Driver metadata with USB filters
   * @param usbDevice - USB device to check
   * @returns true if device matches any of the driver's filters
   */
  private static matchesDevice(
    metadata: SDRDriverMetadata,
    usbDevice: USBDevice,
  ): boolean {
    return metadata.usbFilters.some((filter) => {
      // VendorId is required
      if (filter.vendorId !== usbDevice.vendorId) {
        return false;
      }

      // ProductId is optional but must match if specified
      if (filter.productId !== undefined) {
        if (filter.productId !== usbDevice.productId) {
          return false;
        }
      }

      // TODO: Add support for classCode, subclassCode, protocolCode matching
      // when needed (requires configuration descriptor parsing)

      // Serial number matching would require async getInfo() call
      // Skip for now to keep this method synchronous

      return true;
    });
  }

  /**
   * Clear all registered drivers (useful for testing)
   */
  static clear(): void {
    this.drivers.clear();
  }
}
