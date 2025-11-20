/**
 * HackRF One SDR Device Adapter
 *
 * This adapter wraps the existing HackRFOne implementation to conform
 * to the universal ISDRDevice interface, providing plug-and-play
 * compatibility with the visualization and control components.
 */

import { DeviceErrorHandler } from "../../models/DeviceError";
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
} from "../../models/SDRDevice";
import { useStore } from "../../store";
import {
  hackRfCalibrationService,
  type HackRFCalibrationPort,
} from "./calibration";
import { HackRFOne } from "./HackRFOne";

export class HackRFOneAdapter implements ISDRDevice {
  private device: HackRFOne;
  private usbDevice: USBDevice;
  private calibration: HackRFCalibrationPort;
  private deviceId: string; // Per-device identifier derived from USB properties

  constructor(
    usbDevice: USBDevice,
    calibrationService: HackRFCalibrationPort = hackRfCalibrationService,
  ) {
    this.usbDevice = usbDevice;
    this.device = new HackRFOne(usbDevice);
    this.calibration = calibrationService;
    // Build a stable per-device identifier (vendorId:productId:serial)
    // If serialNumber is missing, leave it empty to avoid undefined in the key
    this.deviceId = `${usbDevice.vendorId}:${usbDevice.productId}:${usbDevice.serialNumber ?? ""}`;
  }

  private trackError(
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    error: Error | unknown,
    context?: Record<string, unknown>,
  ): void {
    try {
      const errorState = DeviceErrorHandler.mapError(error, {
        ...context,
        deviceId: this.deviceId,
        deviceType: "HackRF One",
      });
      const store = useStore.getState();
      store.addDeviceError(errorState);
    } catch (err) {
      // Ignore errors during error tracking to prevent infinite loops
      console.warn("HackRFOneAdapter: Failed to track device error", err);
    }
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
    try {
      await this.device.open();
    } catch (error) {
      this.trackError(error, { operation: "open" });
      throw error;
    }
  }

  async close(): Promise<void> {
    // Ensure we abort any pending transfer immediately before closing
    try {
      await this.device.stopRx();
    } catch {
      // ignore
    }
    try {
      await this.device.close();
    } catch (error) {
      this.trackError(error, { operation: "close" });
      throw error;
    }
  }

  isOpen(): boolean {
    return this.device.getConfigurationStatus().isOpen;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    const plan = this.calibration.buildPlan(this.deviceId, {
      centerFrequencyHz: frequencyHz,
    });

    // Program hardware using the corrected RF frequency while keeping the logical
    // frequency (requestedHz) available for higher-level state machines.
    await this.device.setFrequency(plan.frequency.correctedHz);
  }

  async getFrequency(): Promise<number> {
    return Promise.resolve(this.device.getFrequency() ?? 100e6);
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    await this.device.setSampleRate(sampleRateHz);
  }

  async getSampleRate(): Promise<number> {
    return Promise.resolve(this.device.getSampleRate() ?? 20e6);
  }

  async getUsableBandwidth(): Promise<number> {
    // HackRF has ~80% usable bandwidth due to anti-aliasing filter rolloff
    // For conservative estimate, return 80% of sample rate
    // This ensures we don't try to detect signals at the very edges
    const sampleRate = this.device.getSampleRate() ?? 20e6;
    return Promise.resolve(sampleRate * 0.8);
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
        "HackRFOneAdapter: Failed to set LNA gain; continuing without setting gain",
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

    await this.device.setBandwidth(adjustedBandwidth);
  }

  async getBandwidth(): Promise<number> {
    return Promise.resolve(this.device.getBandwidth() ?? 20e6);
  }

  /**
   * HackRF REQUIRES sample rate to be set before streaming can begin.
   */
  private validateInitialization(): void {
    if (!this.device.getConfigurationStatus().isConfigured) {
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
    try {
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

      // Wrap the callback to convert DataView to IQ samples
      await this.device.receive((data: DataView) => {
        callback(data);
      });
    } catch (error) {
      this.trackError(error, {
        operation: "receive",
        sampleRate: this.device.getSampleRate(),
        frequency: this.device.getFrequency(),
      });
      throw error;
    }
  }

  async stopRx(): Promise<void> {
    await this.device.stopRx();
  }

  isReceiving(): boolean {
    return this.device.getConfigurationStatus().isStreaming;
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
   * Note: After reset, device must be reconfigured (setSampleRate, etc.) before streaming
   */
  async reset(): Promise<void> {
    try {
      await this.device.reset();
    } catch (error) {
      this.trackError(error, { operation: "reset" });
      throw error;
    }
  }

  /**
   * Performs device reset and restores all configuration automatically.
   * Unlike reset(), this maintains the initialized state since configuration is restored.
   */
  async fastRecovery(): Promise<void> {
    try {
      await this.device.fastRecovery();
    } catch (error) {
      // In some call paths (e.g., direct ATSC scanner usage), the error tracker
      // may not be wired up. Guard the tracking call so that recovery failures
      // do not cascade into additional TypeErrors.
      try {
        this.trackError(error, { operation: "fastRecovery" });
      } catch {
        // Best-effort tracking only; propagate the original error.
      }
      throw error;
    }
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
