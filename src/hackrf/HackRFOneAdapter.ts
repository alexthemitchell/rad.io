/**
 * HackRF One SDR Device Adapter
 *
 * This adapter wraps the existing HackRFOne implementation to conform
 * to the universal ISDRDevice interface, providing plug-and-play
 * compatibility with the visualization and control components.
 */

import { CalibrationManager } from "../lib/measurement/calibration";
import {
  type ISDRDevice,
  type IQSample,
  type IQSampleCallback,
  type SDRDeviceInfo,
  type SDRCapabilities,
  SDRDeviceType,
  type SDRStreamConfig,
  type DeviceMemoryInfo,
  convertInt8ToIQ,
} from "../models/SDRDevice";
import { HackRFOne } from "./HackRFOne";

export class HackRFOneAdapter implements ISDRDevice {
  private device: HackRFOne;
  private usbDevice: USBDevice;
  private currentFrequency = 100e6; // 100 MHz default
  private currentSampleRate = 20e6; // 20 MS/s default
  private currentBandwidth = 20e6; // 20 MHz default
  private isReceivingFlag = false;
  private isInitialized = false; // Track if device has been properly configured
  // Ensure we program frequency to hardware at least once, even if equal to default
  private isFrequencyConfigured = false;
  private calibration = new CalibrationManager();
  private deviceId: string; // Per-device identifier derived from USB properties

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
    this.device = new HackRFOne(usbDevice);
    // Build a stable per-device identifier (vendorId:productId:serial)
    // If serialNumber is missing, leave it empty to avoid undefined in the key
    this.deviceId = `${usbDevice.vendorId}:${usbDevice.productId}:${usbDevice.serialNumber ?? ""}`;
  }

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return Promise.resolve({
      type: SDRDeviceType.HACKRF_ONE,
      vendorId: this.usbDevice.vendorId,
      productId: this.usbDevice.productId,
      serialNumber: this.usbDevice.serialNumber ?? undefined,
      firmwareVersion: "Unknown",
      hardwareRevision: "HackRF One",
    });
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
      maxBandwidth: 20e6, // 20 MHz maximum instantaneous bandwidth
    };
  }

  async open(): Promise<void> {
    await this.device.open();
  }

  async close(): Promise<void> {
    // Ensure we abort any pending transfer immediately before closing
    this.isReceivingFlag = false;
    try {
      this.device.stopRx();
    } catch {
      // ignore
    }
    this.isInitialized = false; // Reset initialization state on close
    this.isFrequencyConfigured = false; // Require re-programming frequency on next configuration
    await this.device.close();
  }

  isOpen(): boolean {
    // Access the private usbDevice through type assertion
    // This is safe because we control the HackRFOne implementation
    const opened = (this.device as unknown as { usbDevice?: USBDevice })
      .usbDevice?.opened;
    return opened ?? false;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    // Apply stored PPM calibration before programming hardware so that the RF lands at requested logical frequency
    const corrected = this.calibration.applyFrequencyCalibration(
      this.deviceId,
      frequencyHz,
    );
    // Only skip if we've already programmed frequency once and the value is unchanged
    if (this.isFrequencyConfigured && this.currentFrequency === corrected) {
      return;
    }
    await this.device.setFrequency(corrected);
    this.currentFrequency = corrected;
    this.isFrequencyConfigured = true;
  }

  async getFrequency(): Promise<number> {
    return Promise.resolve(this.currentFrequency);
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    // Always program hardware at least once on first configuration even if value matches default
    if (this.currentSampleRate === sampleRateHz && this.isInitialized) {
      return;
    }
    await this.device.setSampleRate(sampleRateHz);
    this.currentSampleRate = sampleRateHz;
    // Mark as initialized once sample rate is set (critical for HackRF)
    this.isInitialized = true;
  }

  async getSampleRate(): Promise<number> {
    return Promise.resolve(this.currentSampleRate);
  }

  async getUsableBandwidth(): Promise<number> {
    // HackRF has ~80% usable bandwidth due to anti-aliasing filter rolloff
    // For conservative estimate, return 80% of sample rate
    // This ensures we don't try to detect signals at the very edges
    return Promise.resolve(this.currentSampleRate * 0.8);
  }

  async setLNAGain(gainDb: number): Promise<void> {
    // Validate gain is in 8 dB steps (0, 8, 16, 24, 32, 40)
    const validGains = [0, 8, 16, 24, 32, 40];
    let adjustedGain = gainDb;
    if (!validGains.includes(gainDb)) {
      const nearest = validGains.reduce((prev, curr) =>
        Math.abs(curr - gainDb) < Math.abs(prev - gainDb) ? curr : prev,
      );
      console.warn("HackRFOneAdapter: Adjusting LNA gain to valid step", {
        requestedGain: gainDb,
        adjustedGain: nearest,
        validGains,
        reason: "HackRF requires 8 dB steps",
      });
      adjustedGain = nearest;
    }
    try {
      await this.device.setLNAGain(adjustedGain);
    } catch (err) {
      console.warn(
        "HackRFOneAdapter: Failed to set LNA gain; continuing with default",
        {
          requestedGain: gainDb,
          adjustedGain,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      // Do not rethrow; allow pipeline to continue so streaming can start
    }
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    await this.device.setAmpEnable(enabled);
  }

  async setBandwidth(bandwidthHz: number): Promise<void> {
    const capabilities = this.getCapabilities();
    const supportedBandwidths = capabilities.supportedBandwidths ?? [];

    // Validate bandwidth is supported
    let adjustedBandwidth = bandwidthHz;
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
        "HackRFOneAdapter: Adjusting bandwidth to nearest supported value",
        {
          requestedBandwidthMHz: (bandwidthHz / 1e6).toFixed(2),
          adjustedBandwidthMHz: (nearest / 1e6).toFixed(2),
          supportedBandwidthsMHz: supportedBandwidths.map((bw) =>
            (bw / 1e6).toFixed(2),
          ),
        },
      );
      adjustedBandwidth = nearest;
    }

    this.currentBandwidth = adjustedBandwidth;
    await this.device.setBandwidth(adjustedBandwidth);
  }

  async getBandwidth(): Promise<number> {
    return Promise.resolve(this.currentBandwidth);
  }

  /**
   * Validates that device is properly initialized before streaming.
   * HackRF REQUIRES sample rate to be set before streaming can begin.
   */
  private validateInitialization(): void {
    if (!this.isInitialized) {
      throw new Error(
        "HackRF device not initialized. Must call setSampleRate() before receive(). " +
          "Sample rate is mandatory for HackRF to stream data.",
      );
    }
  }

  async receive(
    callback: IQSampleCallback,
    config?: Partial<SDRStreamConfig>,
  ): Promise<void> {
    // Apply configuration if provided, in the CORRECT ORDER:
    // 1. Sample rate MUST be set first (HackRF requirement)
    // 2. Then frequency (uses sample rate for tuning)
    // 3. Then other settings (bandwidth, gains, amp)
    if (config) {
      // CRITICAL: Set sample rate FIRST before any other configuration
      if (config.sampleRate !== undefined) {
        await this.setSampleRate(config.sampleRate);
      }

      // Now set frequency (can depend on sample rate being configured)
      if (config.centerFrequency !== undefined) {
        await this.setFrequency(config.centerFrequency);
      }

      // Finally, set optional parameters
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

    // Validate that device has been initialized with mandatory settings
    this.validateInitialization();

    this.isReceivingFlag = true;

    // Wrap the callback to convert DataView to IQ samples
    await this.device.receive((data: DataView) => {
      callback(data);
    });

    this.isReceivingFlag = false;
  }

  async stopRx(): Promise<void> {
    this.isReceivingFlag = false;
    this.device.stopRx();
    return Promise.resolve();
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

  /**
   * Software reset the device via USB control transfer
   * Note: After reset, device must be reconfigured (setSampleRate, etc.) before streaming
   */
  async reset(): Promise<void> {
    this.isInitialized = false; // Reset will clear device configuration
    this.isFrequencyConfigured = false;
    await this.device.reset();
  }

  /**
   * Fast recovery with automatic reconfiguration
   * Performs device reset and restores all configuration automatically.
   * Unlike reset(), this maintains the initialized state since configuration is restored.
   */
  async fastRecovery(): Promise<void> {
    await this.device.fastRecovery();

    // Ensure underlying device reflects initialized configuration state.
    // Some mock environments may not persist state through reset; reapply
    // the adapter's known sample rate to keep getConfigurationStatus() accurate.
    if (this.currentSampleRate > 0) {
      try {
        await this.device.setSampleRate(this.currentSampleRate);
      } catch {
        // Best-effort; underlying device fastRecovery already attempted restore
      }
    }

    // Re-assert frequency if we had one configured previously to ensure mirrors and hardware match
    if (this.isFrequencyConfigured && this.currentFrequency > 0) {
      try {
        await this.device.setFrequency(this.currentFrequency);
      } catch {
        // Best-effort
      }
    }

    this.isInitialized = true; // Ensure initialized state after fastRecovery
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
