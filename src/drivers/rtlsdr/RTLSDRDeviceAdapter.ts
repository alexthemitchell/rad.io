/**
 * RTL-SDR Device Adapter
 *
 * Provides a TypeScript-first implementation of the ISDRDevice contract for
 * RTL2832U-based receivers using the shared driver abstraction in src/drivers.
 * The adapter wraps the low-level RTLSDRDevice implementation and exposes a
 * uniform API for the visualization pipeline, mirroring the HackRF adapter.
 */

import { DeviceErrorHandler } from "../../models/DeviceError";
import {
  type DeviceMemoryInfo,
  type ISDRDevice,
  type IQSample,
  type IQSampleCallback,
  type SDRCapabilities,
  type SDRDeviceInfo,
  SDRDeviceType,
  type SDRStreamConfig,
  convertUint8ToIQ,
} from "../../models/SDRDevice";
import { RTLSDRDevice, RTLSDRTunerType } from "../../models/RTLSDRDevice";
import { useStore } from "../../store";

const DEFAULT_CENTER_FREQUENCY_HZ = 100e6; // 100 MHz
const DEFAULT_SAMPLE_RATE_HZ = 2.048e6; // 2.048 MS/s
const BUFFER_GC_THRESHOLD = 120;
const BUFFER_GC_BATCH = 60;

type BufferRecord = {
  view: DataView;
  sampleCount: number;
};

export class RTLSDRDeviceAdapter implements ISDRDevice {
  private readonly usbDevice: USBDevice;
  private readonly device: RTLSDRDevice;
  private readonly deviceId: string;

  private isReceivingFlag = false;
  private currentFrequency = DEFAULT_CENTER_FREQUENCY_HZ;
  private currentSampleRate = DEFAULT_SAMPLE_RATE_HZ;
  private tunerName = "Unknown";

  private activeBuffers: BufferRecord[] = [];
  private totalBufferSize = 0;
  private maxSamples = 0;
  private currentSamples = 0;

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
    this.device = new RTLSDRDevice(usbDevice);
    this.deviceId = `${usbDevice.vendorId}:${usbDevice.productId}:${usbDevice.serialNumber ?? ""}`;
  }

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    this.tunerName = this.resolveTunerName(this.device.getTunerType());

    return {
      type: SDRDeviceType.RTLSDR,
      vendorId: this.usbDevice.vendorId,
      productId: this.usbDevice.productId,
      serialNumber: this.usbDevice.serialNumber ?? undefined,
      firmwareVersion: undefined,
      hardwareRevision: `RTL2832U + ${this.tunerName}`,
    };
  }

  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 24e6,
      maxFrequency: 1766e6,
      supportedSampleRates: [
        225e3,
        300e3,
        900e3,
        1.024e6,
        1.4e6,
        1.8e6,
        1.92e6,
        2.048e6,
        2.4e6,
        2.56e6,
        2.88e6,
        3.2e6,
      ],
      maxLNAGain: 49.6,
      supportsAmpControl: false,
      supportsAntennaControl: false,
      maxBandwidth: 3.2e6,
    };
  }

  async open(): Promise<void> {
    try {
      await this.device.open();
      await this.refreshDeviceStateFromHardware();
    } catch (error) {
      this.trackError(error, { operation: "open" });
      throw error;
    }
  }

  async close(): Promise<void> {
    this.isReceivingFlag = false;
    try {
      await this.device.stopRx().catch(() => undefined);
      await this.device.close();
    } catch (error) {
      this.trackError(error, { operation: "close" });
      throw error;
    } finally {
      this.clearBuffers();
    }
  }

  isOpen(): boolean {
    return this.usbDevice.opened ?? false;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    try {
      await this.device.setFrequency(frequencyHz);
      this.currentFrequency = frequencyHz;
    } catch (error) {
      this.trackError(error, {
        operation: "setFrequency",
        frequencyHz,
      });
      throw error;
    }
  }

  async getFrequency(): Promise<number> {
    return this.currentFrequency;
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    try {
      await this.device.setSampleRate(sampleRateHz);
      this.currentSampleRate = await this.device.getSampleRate();
    } catch (error) {
      this.trackError(error, {
        operation: "setSampleRate",
        sampleRateHz,
      });
      throw error;
    }
  }

  async getSampleRate(): Promise<number> {
    return this.currentSampleRate;
  }

  async getUsableBandwidth(): Promise<number> {
    return this.currentSampleRate * 0.8;
  }

  async setLNAGain(gainDb: number): Promise<void> {
    const caps = this.getCapabilities();
    const maxGain = caps.maxLNAGain ?? 0;
    const clamped = Math.min(Math.max(gainDb, 0), maxGain);

    try {
      await this.device.setGain(clamped);
    } catch (error) {
      this.trackError(error, {
        operation: "setLNAGain",
        gainDb: clamped,
      });
      throw error;
    }
  }

  async setVGAGain(_gainDb: number): Promise<void> {
    // RTL-SDR devices expose only a single gain stage; VGA gain is not supported.
    return Promise.resolve();
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    try {
      await this.device.setAGC(enabled);
    } catch (error) {
      this.trackError(error, {
        operation: "setAmpEnable",
        enabled,
      });
      throw error;
    }
  }

  async setBandwidth(_bandwidthHz: number): Promise<void> {
    // Bandwidth is derived from the configured sample rate on RTL-SDR devices.
    return Promise.resolve();
  }

  async receive(
    callback: IQSampleCallback,
    config?: Partial<SDRStreamConfig>,
  ): Promise<void> {
    try {
      if (config) {
        await this.applyStreamConfig(config);
      }

      this.isReceivingFlag = true;

      await this.device.receive((samples: IQSample[]) => {
        if (!samples.length) {
          return;
        }

        const view = this.encodeSamples(samples);
        this.trackBufferUsage({ view, sampleCount: samples.length });
        callback(view);
      });
    } catch (error) {
      this.trackError(error, {
        operation: "receive",
        sampleRate: this.currentSampleRate,
        frequency: this.currentFrequency,
      });
      throw error;
    } finally {
      this.isReceivingFlag = false;
    }
  }

  async stopRx(): Promise<void> {
    this.isReceivingFlag = false;
    return this.device.stopRx();
  }

  isReceiving(): boolean {
    return this.isReceivingFlag;
  }

  parseSamples(data: DataView): IQSample[] {
    return convertUint8ToIQ(data);
  }

  getMemoryInfo(): DeviceMemoryInfo {
    return {
      totalBufferSize: this.totalBufferSize,
      usedBufferSize: this.totalBufferSize,
      activeBuffers: this.activeBuffers.length,
      maxSamples: this.maxSamples,
      currentSamples: this.currentSamples,
    };
  }

  clearBuffers(): void {
    this.activeBuffers = [];
    this.totalBufferSize = 0;
    this.currentSamples = 0;
    this.maxSamples = 0;
  }

  async reset(): Promise<void> {
    try {
      await this.device.stopRx().catch(() => undefined);
      await this.device.close();
      await this.reapplyCachedConfiguration();
    } catch (error) {
      this.trackError(error, { operation: "reset" });
      throw error;
    }
  }

  async fastRecovery(): Promise<void> {
    try {
      await this.device.stopRx().catch(() => undefined);
      await this.reapplyCachedConfiguration();
    } catch (error) {
      this.trackError(error, { operation: "fastRecovery" });
      throw error;
    }
  }

  private async refreshDeviceStateFromHardware(): Promise<void> {
    this.currentFrequency = await this.device.getFrequency();
    this.currentSampleRate = await this.device.getSampleRate();
    this.tunerName = this.resolveTunerName(this.device.getTunerType());
  }

  private async reapplyCachedConfiguration(): Promise<void> {
    await this.device.open();
    await this.device.setSampleRate(this.currentSampleRate);
    await this.device.setFrequency(this.currentFrequency);
    await this.refreshDeviceStateFromHardware();
  }

  private async applyStreamConfig(
    config: Partial<SDRStreamConfig>,
  ): Promise<void> {
    if (config.sampleRate !== undefined) {
      await this.setSampleRate(config.sampleRate);
    }
    if (config.centerFrequency !== undefined) {
      await this.setFrequency(config.centerFrequency);
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

  private encodeSamples(samples: IQSample[]): DataView {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) {
        continue;
      }

      view.setUint8(i * 2, this.floatToUint8(sample.I));
      view.setUint8(i * 2 + 1, this.floatToUint8(sample.Q));
    }

    return view;
  }

  private floatToUint8(value: number): number {
    const scaled = Math.round(value * 127.5 + 127.5);
    if (Number.isNaN(scaled)) {
      return 127;
    }
    return Math.min(255, Math.max(0, scaled));
  }

  private trackBufferUsage(record: BufferRecord): void {
    this.activeBuffers.push(record);
    this.totalBufferSize += record.view.byteLength;
    this.currentSamples += record.sampleCount;
    this.maxSamples = Math.max(this.maxSamples, record.sampleCount);

    if (this.activeBuffers.length > BUFFER_GC_THRESHOLD) {
      const removed = this.activeBuffers.splice(0, BUFFER_GC_BATCH);
      const reclaimedBytes = removed.reduce(
        (sum, item) => sum + item.view.byteLength,
        0,
      );
      const reclaimedSamples = removed.reduce(
        (sum, item) => sum + item.sampleCount,
        0,
      );
      this.totalBufferSize = Math.max(0, this.totalBufferSize - reclaimedBytes);
      this.currentSamples = Math.max(0, this.currentSamples - reclaimedSamples);
    }
  }

  private resolveTunerName(tunerType: RTLSDRTunerType): string {
    switch (tunerType) {
      case RTLSDRTunerType.E4000:
        return "E4000";
      case RTLSDRTunerType.FC0012:
        return "FC0012";
      case RTLSDRTunerType.FC0013:
        return "FC0013";
      case RTLSDRTunerType.FC2580:
        return "FC2580";
      case RTLSDRTunerType.R820T:
        return "R820T";
      case RTLSDRTunerType.R828D:
        return "R828D";
      case RTLSDRTunerType.UNKNOWN:
      default:
        return "Unknown";
    }
  }

  private trackError(
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    error: Error | unknown,
    context?: Record<string, unknown>,
  ): void {
    try {
      const mapped = DeviceErrorHandler.mapError(error, {
        ...context,
        deviceId: this.deviceId,
        deviceType: "RTL-SDR",
      });
      const store = useStore.getState();
      store.addDeviceError(mapped);
    } catch (trackingError) {
      console.warn("RTLSDRDeviceAdapter: failed to record device error", {
        originalError: error,
        trackingError,
      });
    }
  }
}
