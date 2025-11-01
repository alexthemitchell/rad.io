/**
 * Template Device Driver Plugin
 *
 * TODO: Replace the following:
 * - "TemplateDevice" → "YourDevice"
 * - "template-device" → "your-device"
 * - "Template Device" → "Your Device"
 * - "Your Name" → your actual name
 * - USB VendorID and ProductID
 * - Implement device communication
 */

import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { ISDRDevice } from "../../models/SDRDevice";
import type { DeviceDriverPlugin, PluginMetadata } from "../../types/plugin";

/**
 * Template Device Driver Plugin
 */
export class TemplateDeviceDriverPlugin
  extends BasePlugin
  implements DeviceDriverPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEVICE_DRIVER };

  // TODO: Update these with your device's USB IDs
  private static readonly VENDOR_ID = 0x0000;
  private static readonly PRODUCT_ID = 0x0000;

  constructor() {
    const metadata: PluginMetadata = {
      id: "template-device-driver",
      name: "Template Device Driver",
      version: "1.0.0",
      author: "Your Name",
      description: "WebUSB driver for Template SDR device",
      type: PluginType.DEVICE_DRIVER,
      homepage: "https://github.com/yourusername/rad.io-template-driver",
    };

    super(metadata);
  }

  // Lifecycle hooks

  protected async onInitialize(): Promise<void> {
    // TODO: Initialize driver state
    console.log(`${this.metadata.name} initialized`);
  }

  protected async onActivate(): Promise<void> {
    // TODO: Register driver with device manager
    console.log(`${this.metadata.name} activated`);
  }

  protected async onDeactivate(): Promise<void> {
    // TODO: Unregister driver
    console.log(`${this.metadata.name} deactivated`);
  }

  protected async onDispose(): Promise<void> {
    // TODO: Clean up resources
    console.log(`${this.metadata.name} disposed`);
  }

  // Device driver interface implementation

  /**
   * Get USB filters for device detection
   *
   * TODO: Update with your device's USB identifiers
   */
  getUSBFilters(): USBDeviceFilter[] {
    return [
      {
        vendorId: TemplateDeviceDriverPlugin.VENDOR_ID,
        productId: TemplateDeviceDriverPlugin.PRODUCT_ID,
      },
    ];
  }

  /**
   * Check if device is supported
   *
   * TODO: Add any additional checks beyond USB IDs
   */
  supportsDevice(device: USBDevice): boolean {
    return (
      device.vendorId === TemplateDeviceDriverPlugin.VENDOR_ID &&
      device.productId === TemplateDeviceDriverPlugin.PRODUCT_ID
    );
  }

  /**
   * Get device information
   *
   * TODO: Implement device info retrieval
   */
  async getDeviceInfo(device: USBDevice) {
    return {
      manufacturer: device.manufacturerName || "Template Manufacturer",
      model: device.productName || "Template SDR Device",
      serialNumber: device.serialNumber ?? undefined,
    };
  }

  /**
   * Create device instance
   *
   * TODO: Create and return your device implementation
   */
  async createDevice(usbDevice: USBDevice): Promise<ISDRDevice> {
    return new TemplateDevice(usbDevice);
  }
}

/**
 * Template Device Implementation
 *
 * TODO: Implement the ISDRDevice interface for your hardware
 * See src/models/SDRDevice.ts for the interface definition
 */
class TemplateDevice implements ISDRDevice {
  private usbDevice: USBDevice;
  private isDeviceOpen = false;
  private isStreaming = false;
  private dataCallback?: (samples: DataView) => void;

  // TODO: Update these with your device's USB configuration
  private static readonly INTERFACE_NUM = 0;
  private static readonly ENDPOINT_IN = 1;
  private static readonly ENDPOINT_OUT = 2;

  // TODO: Add device-specific state
  // private currentFrequency: number = 100e6;
  // private currentSampleRate: number = 2.4e6;

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;

    // TODO: Initialize device state
  }

  /**
   * Get device information
   *
   * TODO: Return actual device information
   */
  async getDeviceInfo() {
    return {
      type: "GENERIC" as const,
      vendorId: this.usbDevice.vendorId,
      productId: this.usbDevice.productId,
      serialNumber: this.usbDevice.serialNumber ?? undefined,
      // TODO: Read firmware version from device
      // firmwareVersion: await this.readFirmwareVersion(),
    };
  }

  /**
   * Get device capabilities
   *
   * TODO: Update with your device's actual capabilities
   */
  getCapabilities() {
    return {
      minFrequency: 24e6, // TODO: Update
      maxFrequency: 1.766e9, // TODO: Update
      supportedSampleRates: [
        // TODO: Add supported sample rates
        2.4e6,
      ],
      supportsAmpControl: false, // TODO: Update
      supportsAntennaControl: false, // TODO: Update
      // TODO: Add other capabilities as needed
    };
  }

  /**
   * Open and initialize the device
   *
   * TODO: Implement device initialization
   */
  async open(): Promise<void> {
    if (this.isDeviceOpen) {
      throw new Error("Device already open");
    }

    try {
      // Open USB device
      await this.usbDevice.open();

      // TODO: Select appropriate configuration
      await this.usbDevice.selectConfiguration(1);

      // TODO: Claim appropriate interface
      await this.usbDevice.claimInterface(TemplateDevice.INTERFACE_NUM);

      // TODO: Initialize device hardware
      // await this.initializeHardware();

      this.isDeviceOpen = true;
    } catch (error) {
      throw new Error(
        `Failed to open device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close and cleanup the device
   *
   * TODO: Implement proper cleanup
   */
  async close(): Promise<void> {
    if (!this.isDeviceOpen) return;

    try {
      // Stop streaming first
      await this.stopStreaming();

      // TODO: Send any cleanup commands to device

      // Release interface
      await this.usbDevice.releaseInterface(TemplateDevice.INTERFACE_NUM);

      // Close device
      await this.usbDevice.close();

      this.isDeviceOpen = false;
    } catch (error) {
      console.error("Error closing device:", error);
    }
  }

  /**
   * Check if device is open
   */
  isOpen(): boolean {
    return this.isDeviceOpen;
  }

  /**
   * Configure device parameters
   *
   * TODO: Implement device configuration
   */
  async configure(config: {
    centerFrequency: number;
    sampleRate: number;
    bandwidth?: number;
    lnaGain?: number;
    vgaGain?: number;
  }): Promise<void> {
    if (!this.isDeviceOpen) {
      throw new Error("Device not open");
    }

    // TODO: Validate parameters against capabilities

    // TODO: Set frequency
    // await this.setFrequency(config.centerFrequency);

    // TODO: Set sample rate
    // await this.setSampleRate(config.sampleRate);

    // TODO: Set gains
    // if (config.lnaGain !== undefined) {
    //   await this.setGain("lna", config.lnaGain);
    // }

    // TODO: Implement other parameter setting
  }

  /**
   * Start streaming IQ samples
   *
   * TODO: Implement sample streaming
   */
  async startStreaming(callback: (samples: DataView) => void): Promise<void> {
    if (!this.isDeviceOpen) {
      throw new Error("Device not open");
    }

    if (this.isStreaming) {
      throw new Error("Already streaming");
    }

    this.dataCallback = callback;

    // TODO: Send start command to device
    // await this.sendCommand({ type: "START_RX" });

    this.isStreaming = true;

    // Start transfer loop
    void this.transferLoop();
  }

  /**
   * Stop streaming IQ samples
   *
   * TODO: Implement streaming stop
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) return;

    this.isStreaming = false;

    // TODO: Send stop command to device
    // await this.sendCommand({ type: "STOP_RX" });

    this.dataCallback = undefined;
  }

  // Private helper methods

  /**
   * USB transfer loop
   *
   * TODO: Implement data transfer and parsing
   */
  private async transferLoop(): Promise<void> {
    const bufferSize = 262144; // 256 KB - TODO: Adjust as needed

    while (this.isStreaming) {
      try {
        const result = await this.usbDevice.transferIn(
          TemplateDevice.ENDPOINT_IN,
          bufferSize,
        );

        if (result.status === "ok" && result.data) {
          if (this.dataCallback) {
            // TODO: Parse and convert raw data to IQ samples
            // The DataView should contain IQ samples in the format
            // your application expects (typically pairs of floats or ints)
            this.dataCallback(result.data);
          }
        }
      } catch (error) {
        console.error("Transfer error:", error);
        this.isStreaming = false;
        break;
      }
    }
  }

  /**
   * Send command to device
   *
   * TODO: Implement device command protocol
   */
  // private async sendCommand(command: {
  //   type: string;
  //   value?: number;
  // }): Promise<void> {
  //   const buffer = this.encodeCommand(command);
  //
  //   const result = await this.usbDevice.controlTransferOut(
  //     {
  //       requestType: "vendor",
  //       recipient: "device",
  //       request: this.getRequestCode(command.type),
  //       value: 0,
  //       index: 0,
  //     },
  //     buffer,
  //   );
  //
  //   if (result.status !== "ok") {
  //     throw new Error(`Command failed: ${command.type}`);
  //   }
  // }

  /**
   * Encode command for device
   *
   * TODO: Implement device-specific command encoding
   */
  // private encodeCommand(command: {
  //   type: string;
  //   value?: number;
  // }): ArrayBuffer {
  //   // TODO: Encode command according to your device protocol
  //   const buffer = new ArrayBuffer(8);
  //   const view = new DataView(buffer);
  //
  //   if (command.value !== undefined) {
  //     view.setUint32(0, command.value, true);
  //   }
  //
  //   return buffer;
  // }

  /**
   * Get USB request code for command
   *
   * TODO: Map command types to USB request codes
   */
  // private getRequestCode(type: string): number {
  //   const codes: Record<string, number> = {
  //     SET_FREQ: 0x01,
  //     SET_SAMPLE_RATE: 0x02,
  //     START_RX: 0x10,
  //     STOP_RX: 0x11,
  //     // TODO: Add more commands
  //   };
  //   return codes[type] || 0;
  // }

  // TODO: Add more helper methods as needed
  // - setFrequency(freq: number)
  // - setSampleRate(rate: number)
  // - setGain(type: string, value: number)
  // - readFirmwareVersion()
  // - etc.
}

// TODO: After implementing:
// 1. Test with actual hardware
// 2. Write tests in __tests__/TemplateDeviceDriverPlugin.test.ts
// 3. Export from src/plugins/index.ts
// 4. Create troubleshooting guide
// 5. Document USB protocol and quirks
// 6. Add to supported devices list
