/**
 * WebUSB Device Selector
 *
 * Provides a user-friendly abstraction for WebUSB device selection and enumeration.
 * Handles browser compatibility, user permissions, and device lifecycle.
 */

import { SDRDriverRegistry } from "./SDRDriverRegistry";

/**
 * Device selection options
 */
export interface DeviceSelectionOptions {
  /** Custom USB filters (if not using registry defaults) */
  filters?: USBDeviceFilter[];

  /** Whether to include all registered drivers' filters */
  useRegisteredDrivers?: boolean;

  /** Optional callback for device connection events */
  onConnect?: (device: USBDevice) => void;

  /** Optional callback for device disconnection events */
  onDisconnect?: (device: USBDevice) => void;
}

/**
 * Result of device enumeration
 */
export interface DeviceEnumerationResult {
  /** Previously paired/authorized devices */
  pairedDevices: USBDevice[];

  /** Whether WebUSB is supported in this browser */
  supported: boolean;

  /** Error message if enumeration failed */
  error?: string;
}

/**
 * WebUSB device selector with SDR-specific enhancements
 *
 * This class provides:
 * - Browser compatibility checks
 * - User-friendly device selection
 * - Automatic device enumeration
 * - Event handling for connect/disconnect
 *
 * Example usage:
 * ```typescript
 * const selector = new WebUSBDeviceSelector();
 *
 * // Check browser support
 * if (!selector.isSupported()) {
 *   console.error("WebUSB not supported");
 *   return;
 * }
 *
 * // Request device from user
 * const device = await selector.requestDevice();
 *
 * // Get previously paired devices
 * const devices = await selector.getDevices();
 * ```
 */
export class WebUSBDeviceSelector {
  private connectListener?: (event: USBConnectionEvent) => void;
  private disconnectListener?: (event: USBConnectionEvent) => void;

  /**
   * Check if WebUSB is supported in the current browser
   * @returns true if WebUSB is available
   */
  isSupported(): boolean {
    return "usb" in navigator;
  }

  /**
   * Request a USB device from the user
   * Shows the browser's native device picker dialog
   *
   * @param options - Device selection options
   * @returns Selected USB device or undefined if user cancelled
   * @throws Error if WebUSB is not supported
   */
  async requestDevice(
    options: DeviceSelectionOptions = {},
  ): Promise<USBDevice | undefined> {
    if (!this.isSupported()) {
      throw new Error(
        "WebUSB is not supported in this browser. " +
          "Please use Chrome, Edge, or another Chromium-based browser.",
      );
    }

    // Build filter list
    const filters: USBDeviceFilter[] = [];

    // Add custom filters if provided
    if (options.filters) {
      filters.push(...options.filters);
    }

    // Add registered drivers' filters if requested (default: true)
    if (options.useRegisteredDrivers !== false) {
      filters.push(...SDRDriverRegistry.getAllUSBFilters());
    }

    // If no filters at all, throw error
    if (filters.length === 0) {
      throw new Error(
        "No USB device filters specified. " +
          "Either provide custom filters or register drivers first.",
      );
    }

    try {
      const device = await navigator.usb.requestDevice({ filters });

      // Setup event listeners if callbacks provided
      if (options.onConnect || options.onDisconnect) {
        this.setupEventListeners(options.onConnect, options.onDisconnect);
      }

      return device;
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name === "NotFoundError") {
        // User cancelled - this is not an error, just return undefined
        return undefined;
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get all previously authorized/paired USB devices
   * @returns Array of paired USB devices
   * @throws Error if WebUSB is not supported
   */
  async getDevices(): Promise<USBDevice[]> {
    if (!this.isSupported()) {
      throw new Error("WebUSB is not supported in this browser.");
    }

    return navigator.usb.getDevices();
  }

  /**
   * Enumerate all devices with metadata
   * @returns Enumeration result with devices and status
   */
  async enumerate(): Promise<DeviceEnumerationResult> {
    const result: DeviceEnumerationResult = {
      pairedDevices: [],
      supported: this.isSupported(),
    };

    if (!result.supported) {
      result.error = "WebUSB is not supported in this browser";
      return result;
    }

    try {
      result.pairedDevices = await this.getDevices();
    } catch (error) {
      result.error =
        error instanceof Error
          ? error.message
          : "Unknown error enumerating devices";
    }

    return result;
  }

  /**
   * Setup event listeners for device connect/disconnect
   * @param onConnect - Callback for device connection
   * @param onDisconnect - Callback for device disconnection
   */
  setupEventListeners(
    onConnect?: (device: USBDevice) => void,
    onDisconnect?: (device: USBDevice) => void,
  ): void {
    if (!this.isSupported()) {
      return;
    }

    // Remove existing listeners
    this.removeEventListeners();

    // Setup connect listener
    if (onConnect) {
      this.connectListener = (event: USBConnectionEvent) => {
        onConnect(event.device);
      };
      navigator.usb.addEventListener("connect", this.connectListener);
    }

    // Setup disconnect listener
    if (onDisconnect) {
      this.disconnectListener = (event: USBConnectionEvent) => {
        onDisconnect(event.device);
      };
      navigator.usb.addEventListener("disconnect", this.disconnectListener);
    }
  }

  /**
   * Remove event listeners
   */
  removeEventListeners(): void {
    if (!this.isSupported()) {
      return;
    }

    if (this.connectListener) {
      navigator.usb.removeEventListener("connect", this.connectListener);
      this.connectListener = undefined;
    }

    if (this.disconnectListener) {
      navigator.usb.removeEventListener("disconnect", this.disconnectListener);
      this.disconnectListener = undefined;
    }
  }

  /**
   * Format device information for display
   * @param device - USB device to format
   * @returns Human-readable device description
   */
  formatDeviceInfo(device: USBDevice): string {
    const vendorId = `0x${device.vendorId.toString(16).padStart(4, "0")}`;
    const productId = `0x${device.productId.toString(16).padStart(4, "0")}`;

    // Try to get product name from device
    const productName =
      device.productName || `Unknown Device (${vendorId}:${productId})`;

    return `${productName} [${vendorId}:${productId}]`;
  }
}
