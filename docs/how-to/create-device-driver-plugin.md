# How-To: Create a Device Driver Plugin

**Time to complete**: 60-90 minutes
**Prerequisites**: TypeScript, WebUSB API, hardware documentation
**Difficulty**: Advanced

## Overview

This guide shows you how to create a device driver plugin for rad.io that adds support for new SDR hardware. Device driver plugins wrap WebUSB devices and implement the `ISDRDevice` interface.

## Device Driver Plugin Interface

Every device driver plugin must implement:

```typescript
interface DeviceDriverPlugin extends Plugin {
  createDevice(usbDevice: USBDevice): Promise<ISDRDevice>;
  getUSBFilters(): USBDeviceFilter[];
  supportsDevice(device: USBDevice): boolean;
  getDeviceInfo(device: USBDevice): Promise<DeviceInfo>;
}
```

## Prerequisites

Before creating a driver, you need:

1. **Hardware documentation**: USB protocol, commands, data formats
2. **USB identifiers**: Vendor ID and Product ID
3. **Device capabilities**: Frequency range, sample rates, gain control
4. **Test hardware**: Physical device for testing

## Step 1: Create Plugin Structure

```typescript
import { BasePlugin } from "../../lib/BasePlugin";
import { PluginType } from "../../types/plugin";
import type { DeviceDriverPlugin, PluginMetadata } from "../../types/plugin";
import type { ISDRDevice } from "../../models/SDRDevice";

export class CustomSDRDriverPlugin
  extends BasePlugin
  implements DeviceDriverPlugin
{
  declare metadata: PluginMetadata & { type: PluginType.DEVICE_DRIVER };

  // USB identifiers for your device
  private static readonly VENDOR_ID = 0x1234;
  private static readonly PRODUCT_ID = 0x5678;

  constructor() {
    const metadata: PluginMetadata = {
      id: "custom-sdr-driver",
      name: "Custom SDR Driver",
      version: "1.0.0",
      author: "Your Name",
      description: "WebUSB driver for Custom SDR hardware",
      type: PluginType.DEVICE_DRIVER,
    };

    super(metadata);
  }

  protected onInitialize(): void {
    // Initialize driver
  }

  protected async onActivate(): Promise<void> {
    // Activate driver (register with device manager)
  }

  protected async onDeactivate(): Promise<void> {
    // Deactivate driver
  }

  protected async onDispose(): Promise<void> {
    // Clean up resources
  }

  /**
   * Get USB filters for device detection
   */
  getUSBFilters(): USBDeviceFilter[] {
    return [
      {
        vendorId: CustomSDRDriverPlugin.VENDOR_ID,
        productId: CustomSDRDriverPlugin.PRODUCT_ID,
      },
    ];
  }

  /**
   * Check if device is supported
   */
  supportsDevice(device: USBDevice): boolean {
    return (
      device.vendorId === CustomSDRDriverPlugin.VENDOR_ID &&
      device.productId === CustomSDRDriverPlugin.PRODUCT_ID
    );
  }

  /**
   * Get device information
   */
  async getDeviceInfo(device: USBDevice) {
    return {
      manufacturer: device.manufacturerName || "Custom Manufacturer",
      model: device.productName || "Custom SDR",
      serialNumber: device.serialNumber ?? undefined,
    };
  }

  /**
   * Create device instance
   */
  async createDevice(usbDevice: USBDevice): Promise<ISDRDevice> {
    return new CustomSDRDevice(usbDevice);
  }
}
```

## Step 2: Implement ISDRDevice

Create a separate class that implements the device interface:

```typescript
import type {
  ISDRDevice,
  IQSample,
  SDRDeviceInfo,
  SDRCapabilities,
  SDRStreamConfig,
} from "../../models/SDRDevice";
import { SDRDeviceType } from "../../models/SDRDevice";

export class CustomSDRDevice implements ISDRDevice {
  private usbDevice: USBDevice;
  private isDeviceOpen = false;
  private isStreaming = false;
  private dataCallback?: (samples: DataView) => void;

  // Device configuration
  private currentConfig: SDRStreamConfig;

  // USB endpoints
  private static readonly INTERFACE_NUM = 0;
  private static readonly ENDPOINT_IN = 1;
  private static readonly ENDPOINT_OUT = 2;

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
    this.currentConfig = {
      centerFrequency: 100e6, // 100 MHz
      sampleRate: 2.4e6, // 2.4 MS/s
    };
  }

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return {
      type: SDRDeviceType.GENERIC,
      vendorId: this.usbDevice.vendorId,
      productId: this.usbDevice.productId,
      serialNumber: this.usbDevice.serialNumber ?? undefined,
    };
  }

  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 24e6, // 24 MHz
      maxFrequency: 1.766e9, // 1.766 GHz
      supportedSampleRates: [
        0.9e6, 1.024e6, 1.536e6, 1.8e6, 1.92e6, 2.048e6, 2.4e6, 2.56e6, 3.2e6,
      ],
      supportsAmpControl: false,
      supportsAntennaControl: false,
    };
  }

  async open(): Promise<void> {
    if (this.isDeviceOpen) {
      throw new Error("Device already open");
    }

    try {
      await this.usbDevice.open();
      await this.usbDevice.selectConfiguration(1);
      await this.usbDevice.claimInterface(CustomSDRDevice.INTERFACE_NUM);

      // Initialize device hardware
      await this.initializeHardware();

      this.isDeviceOpen = true;
    } catch (error) {
      throw new Error(
        `Failed to open device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async close(): Promise<void> {
    if (!this.isDeviceOpen) return;

    try {
      await this.stopStreaming();
      await this.usbDevice.releaseInterface(CustomSDRDevice.INTERFACE_NUM);
      await this.usbDevice.close();
      this.isDeviceOpen = false;
    } catch (error) {
      console.error("Error closing device:", error);
    }
  }

  isOpen(): boolean {
    return this.isDeviceOpen;
  }

  async configure(config: SDRStreamConfig): Promise<void> {
    this.validateConfig(config);

    // Set frequency
    if (config.centerFrequency !== this.currentConfig.centerFrequency) {
      await this.setFrequency(config.centerFrequency);
    }

    // Set sample rate
    if (config.sampleRate !== this.currentConfig.sampleRate) {
      await this.setSampleRate(config.sampleRate);
    }

    // Set gains
    if (config.lnaGain !== undefined) {
      await this.setGain("lna", config.lnaGain);
    }
    if (config.vgaGain !== undefined) {
      await this.setGain("vga", config.vgaGain);
    }

    this.currentConfig = { ...config };
  }

  async startStreaming(callback: (samples: DataView) => void): Promise<void> {
    if (this.isStreaming) {
      throw new Error("Already streaming");
    }

    this.dataCallback = callback;
    await this.sendCommand({ type: "START_RX" });
    this.isStreaming = true;

    // Start transfer loop
    void this.transferLoop();
  }

  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    await this.sendCommand({ type: "STOP_RX" });
    this.dataCallback = undefined;
  }

  // Private helper methods

  private async initializeHardware(): Promise<void> {
    // Device-specific initialization
    // Read firmware version, reset, etc.
    const version = await this.readFirmwareVersion();
    console.log(`Custom SDR firmware: ${version}`);
  }

  private async setFrequency(freq: number): Promise<void> {
    await this.sendCommand({
      type: "SET_FREQ",
      value: freq,
    });
  }

  private async setSampleRate(rate: number): Promise<void> {
    await this.sendCommand({
      type: "SET_SAMPLE_RATE",
      value: rate,
    });
  }

  private async setGain(type: "lna" | "vga", gain: number): Promise<void> {
    await this.sendCommand({
      type: type === "lna" ? "SET_LNA_GAIN" : "SET_VGA_GAIN",
      value: gain,
    });
  }

  private async sendCommand(command: DeviceCommand): Promise<void> {
    const buffer = this.encodeCommand(command);

    const result = await this.usbDevice.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: this.getRequestCode(command.type),
        value: 0,
        index: 0,
      },
      buffer,
    );

    if (result.status !== "ok") {
      throw new Error(`Command failed: ${command.type}`);
    }
  }

  private encodeCommand(command: DeviceCommand): ArrayBuffer {
    // Device-specific command encoding
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);

    if (command.value !== undefined) {
      // Encode value as little-endian uint32
      view.setUint32(0, command.value, true);
    }

    return buffer;
  }

  private getRequestCode(type: string): number {
    // Map command types to USB request codes
    const codes: Record<string, number> = {
      SET_FREQ: 0x01,
      SET_SAMPLE_RATE: 0x02,
      SET_LNA_GAIN: 0x03,
      SET_VGA_GAIN: 0x04,
      START_RX: 0x10,
      STOP_RX: 0x11,
    };
    return codes[type] || 0;
  }

  private async transferLoop(): Promise<void> {
    const bufferSize = 262144; // 256 KB

    while (this.isStreaming) {
      try {
        const result = await this.usbDevice.transferIn(
          CustomSDRDevice.ENDPOINT_IN,
          bufferSize,
        );

        if (result.status === "ok" && result.data) {
          if (this.dataCallback) {
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

  private async readFirmwareVersion(): Promise<string> {
    const result = await this.usbDevice.controlTransferIn(
      {
        requestType: "vendor",
        recipient: "device",
        request: 0xff,
        value: 0,
        index: 0,
      },
      16,
    );

    if (result.status === "ok" && result.data) {
      const decoder = new TextDecoder();
      return decoder.decode(result.data);
    }

    return "unknown";
  }

  private validateConfig(config: SDRStreamConfig): void {
    const caps = this.getCapabilities();

    if (
      config.centerFrequency < caps.minFrequency ||
      config.centerFrequency > caps.maxFrequency
    ) {
      throw new Error(`Frequency ${config.centerFrequency} Hz out of range`);
    }

    if (!caps.supportedSampleRates.includes(config.sampleRate)) {
      throw new Error(`Sample rate ${config.sampleRate} not supported`);
    }
  }
}

// Internal types
interface DeviceCommand {
  type: string;
  value?: number;
}
```

## Step 3: Register and Use the Plugin

```typescript
import { pluginRegistry, CustomSDRDriverPlugin } from "./plugins";

// Register the driver
const driver = new CustomSDRDriverPlugin();
await pluginRegistry.register(driver);
await driver.activate();

// Request device from user
const filters = driver.getUSBFilters();
const usbDevice = await navigator.usb.requestDevice({ filters });

// Check if supported
if (driver.supportsDevice(usbDevice)) {
  // Create device instance
  const device = await driver.createDevice(usbDevice);

  // Open and configure
  await device.open();
  await device.configure({
    centerFrequency: 100e6,
    sampleRate: 2.4e6,
  });

  // Start streaming
  await device.startStreaming((data) => {
    // Process IQ samples
    console.log(`Received ${data.byteLength} bytes`);
  });
}
```

## Best Practices

### 1. Handle USB Errors Gracefully

```typescript
try {
  await device.open();
} catch (error) {
  if (error.name === "NotFoundError") {
    console.error("Device not found or access denied");
  } else if (error.name === "InvalidStateError") {
    console.error("Device already in use");
  } else {
    console.error("Failed to open device:", error);
  }
}
```

### 2. Validate All Parameters

```typescript
private validateFrequency(freq: number): void {
  const caps = this.getCapabilities();
  if (freq < caps.minFrequency || freq > caps.maxFrequency) {
    throw new Error(
      `Frequency ${freq} Hz out of range ` +
      `(${caps.minFrequency}-${caps.maxFrequency} Hz)`
    );
  }
}
```

### 3. Clean Up Resources

```typescript
async close(): Promise<void> {
  // Stop streaming first
  await this.stopStreaming();

  // Release interface
  try {
    await this.usbDevice.releaseInterface(0);
  } catch (error) {
    console.warn("Failed to release interface:", error);
  }

  // Close device
  try {
    await this.usbDevice.close();
  } catch (error) {
    console.warn("Failed to close device:", error);
  }

  this.isDeviceOpen = false;
}
```

### 4. Document Device-Specific Behavior

```typescript
/**
 * Custom SDR Device Driver
 *
 * @remarks
 * Known limitations:
 * - Does not support antenna power control
 * - Gain range is 0-40 dB in 1 dB steps
 * - Sample rates must be one of the predefined values
 * - Frequency tuning accuracy: ±1 ppm
 *
 * @see https://example.com/custom-sdr-docs
 */
```

## Testing

See the existing guide: [How-To: Add a New SDR Device](./add-new-sdr-device.md)

## Resources

- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [How-To: Add a New SDR Device](./add-new-sdr-device.md)
- [How-To: Debug WebUSB](./debug-webusb.md)
- [ISDRDevice Interface](../../src/models/SDRDevice.ts)
- [Example Drivers](../../src/drivers/)

## Next Steps

- Test with real hardware
- Add to device manager
- Create troubleshooting guide
- Submit to plugin catalog
