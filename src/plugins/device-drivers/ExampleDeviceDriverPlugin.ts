/**
 * Example Device Driver Plugin
 *
 * Example implementation of a device driver plugin.
 * This demonstrates how to add support for custom SDR hardware.
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { ISDRDevice } from "../../models/SDRDevice";
import type { DeviceDriverPlugin, PluginMetadata } from "../../types/plugin";

/**
 * Example Custom SDR Device Driver Plugin
 */
export class ExampleDeviceDriverPlugin
  extends BasePlugin
  implements DeviceDriverPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEVICE_DRIVER };
  constructor() {
    const metadata: PluginMetadata = {
      id: "example-device-driver",
      name: "Example SDR Device Driver",
      version: "1.0.0",
      author: "rad.io",
      description: "Example device driver for custom SDR hardware",
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
    // Clean up driver resources
  }

  /**
   * Create a device instance
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async createDevice(usbDevice: USBDevice): Promise<ISDRDevice> {
    // Return a device adapter that implements ISDRDevice
    // In a real implementation, this would wrap the USB device
    throw new Error(`Device not yet implemented for ${usbDevice.productName}`);
  }

  /**
   * Get USB device filters
   */
  getUSBFilters(): USBDeviceFilter[] {
    return [
      {
        vendorId: 0x1234, // Example vendor ID
        productId: 0x5678, // Example product ID
      },
    ];
  }

  /**
   * Check if device is supported
   */
  supportsDevice(device: USBDevice): boolean {
    return device.vendorId === 0x1234 && device.productId === 0x5678;
  }

  /**
   * Get device information
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getDeviceInfo(device: USBDevice): Promise<{
    manufacturer: string;
    model: string;
    serialNumber?: string;
  }> {
    return {
      manufacturer: "Example Manufacturer",
      model: "Example SDR Device",
      serialNumber: device.serialNumber ?? undefined,
    };
  }
}

/**
 * Note: In a real implementation, you would create a class that implements
 * ISDRDevice interface. See src/models/RTLSDRDevice.ts or HackRFDevice.ts
 * for complete reference implementations.
 */
