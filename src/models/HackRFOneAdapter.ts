/**
 * HackRF One SDR Device Adapter
 *
 * This adapter wraps the existing HackRFOne implementation to conform
 * to the universal ISDRDevice interface, providing plug-and-play
 * compatibility with the visualization and control components.
 */

import { HackRFOne } from "./HackRFOne";
import {
  ISDRDevice,
  IQSample,
  IQSampleCallback,
  SDRDeviceInfo,
  SDRCapabilities,
  SDRDeviceType,
  SDRStreamConfig,
  DeviceMemoryInfo,
  convertInt8ToIQ,
} from "./SDRDevice";

export class HackRFOneAdapter implements ISDRDevice {
  private device: HackRFOne;
  private currentFrequency: number = 100e6; // 100 MHz default
  private currentSampleRate: number = 20e6; // 20 MS/s default
  private currentBandwidth: number = 20e6; // 20 MHz default
  private isReceivingFlag: boolean = false;

  constructor(usbDevice: USBDevice) {
    this.device = new HackRFOne(usbDevice);
  }

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return {
      type: SDRDeviceType.HACKRF_ONE,
      vendorId: 0x1d50,
      productId: 0x6089,
      serialNumber: "Unknown", // HackRF doesn't expose serial via WebUSB easily
      firmwareVersion: "Unknown",
      hardwareRevision: "HackRF One",
    };
  }

  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 1e6, // 1 MHz
      maxFrequency: 6e9, // 6 GHz
      supportedSampleRates: [1e6, 2e6, 4e6, 8e6, 10e6, 12.5e6, 16e6, 20e6], // Common rates
      maxLNAGain: 40, // 0-40 dB in 8 dB steps
      maxVGAGain: 62, // 0-62 dB in 2 dB steps
      supportsAmpControl: true,
      supportsAntennaControl: true,
      supportedBandwidths: [
        1.75e6, 2.5e6, 3.5e6, 5e6, 5.5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6, 14e6,
        15e6, 20e6, 24e6, 28e6,
      ], // HackRF baseband filter bandwidths
    };
  }

  async open(): Promise<void> {
    await this.device.open();
  }

  async close(): Promise<void> {
    this.isReceivingFlag = false;
    await this.device.close();
  }

  isOpen(): boolean {
    // Access the private usbDevice through type assertion
    // This is safe because we control the HackRFOne implementation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.device as any).usbDevice?.opened ?? false;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    this.currentFrequency = frequencyHz;
    await this.device.setFrequency(frequencyHz);
  }

  async getFrequency(): Promise<number> {
    return this.currentFrequency;
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    this.currentSampleRate = sampleRateHz;
    await this.device.setSampleRate(sampleRateHz);
  }

  async getSampleRate(): Promise<number> {
    return this.currentSampleRate;
  }

  async setLNAGain(gainDb: number): Promise<void> {
    // Validate gain is in 8 dB steps (0, 8, 16, 24, 32, 40)
    const validGains = [0, 8, 16, 24, 32, 40];
    if (!validGains.includes(gainDb)) {
      const nearest = validGains.reduce((prev, curr) =>
        Math.abs(curr - gainDb) < Math.abs(prev - gainDb) ? curr : prev,
      );
      console.warn(
        `HackRF LNA gain must be in 8 dB steps. Rounding ${gainDb} to ${nearest}`,
      );
      gainDb = nearest;
    }
    await this.device.setLNAGain(gainDb);
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    await this.device.setAmpEnable(enabled);
  }

  async setBandwidth(bandwidthHz: number): Promise<void> {
    const capabilities = this.getCapabilities();
    const supportedBandwidths = capabilities.supportedBandwidths || [];

    // Validate bandwidth is supported
    if (
      supportedBandwidths.length > 0 &&
      !supportedBandwidths.includes(bandwidthHz)
    ) {
      // Find the closest supported bandwidth
      const nearest = supportedBandwidths.reduce((prev, curr) =>
        Math.abs(curr - bandwidthHz) < Math.abs(prev - bandwidthHz)
          ? curr
          : prev,
      );
      console.warn(
        `Bandwidth ${bandwidthHz / 1e6} MHz not supported. Using nearest: ${nearest / 1e6} MHz`,
      );
      bandwidthHz = nearest;
    }

    this.currentBandwidth = bandwidthHz;
    await this.device.setBandwidth(bandwidthHz);
  }

  async getBandwidth(): Promise<number> {
    return this.currentBandwidth;
  }

  async receive(
    callback: IQSampleCallback,
    config?: Partial<SDRStreamConfig>,
  ): Promise<void> {
    // Apply configuration if provided
    if (config) {
      if (config.centerFrequency !== undefined) {
        await this.setFrequency(config.centerFrequency);
      }
      if (config.sampleRate !== undefined) {
        await this.setSampleRate(config.sampleRate);
      }
      if (config.bandwidth !== undefined) {
        await this.setBandwidth(config.bandwidth);
      }
      if (config.lnaGain !== undefined) {
        await this.setLNAGain(config.lnaGain);
      }
      if (config.ampEnabled !== undefined) {
        await this.setAmpEnable(config.ampEnabled);
      }
    }

    this.isReceivingFlag = true;

    // Wrap the callback to convert DataView to IQ samples
    await this.device.receive((data: DataView) => {
      if (callback) {
        callback(data);
      }
    });

    this.isReceivingFlag = false;
  }

  async stopRx(): Promise<void> {
    this.isReceivingFlag = false;
    await this.device.stopRx();
  }

  isReceiving(): boolean {
    return this.isReceivingFlag;
  }

  parseSamples(data: DataView): IQSample[] {
    // HackRF uses Int8 format for IQ samples
    return convertInt8ToIQ(data);
  }

  getMemoryInfo(): DeviceMemoryInfo {
    const deviceMemInfo = this.device.getMemoryInfo();
    // Calculate samples (2 bytes per IQ pair for Int8 format)
    const maxSamples = deviceMemInfo.totalBufferSize / 2;
    const currentSamples = deviceMemInfo.usedBufferSize / 2;

    return {
      totalBufferSize: deviceMemInfo.totalBufferSize,
      usedBufferSize: deviceMemInfo.usedBufferSize,
      activeBuffers: deviceMemInfo.activeBuffers,
      maxSamples,
      currentSamples,
    };
  }

  clearBuffers(): void {
    this.device.clearBuffers();
  }

  // Expose the underlying HackRFOne instance for advanced use
  getUnderlyingDevice(): HackRFOne {
    return this.device;
  }
}

/**
 * Create a HackRF One adapter from a USB device
 * @param usbDevice - WebUSB device instance
 * @returns HackRF One adapter implementing ISDRDevice
 */
export function createHackRFAdapter(usbDevice: USBDevice): ISDRDevice {
  return new HackRFOneAdapter(usbDevice);
}
