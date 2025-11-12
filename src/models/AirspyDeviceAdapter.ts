/**
 * Airspy Device Adapter
 *
 * This adapter wraps the AirspyDevice implementation to conform
 * to the universal ISDRDevice interface, providing plug-and-play
 * compatibility with the visualization and control components.
 */

import { AirspyDevice } from "./AirspyDevice";
import {
  type ISDRDevice,
  type IQSample,
  type IQSampleCallback,
  type SDRDeviceInfo,
  type SDRCapabilities,
  type DeviceMemoryInfo,
  SDRDeviceType,
  convertInt16ToIQ,
} from "./SDRDevice";

export class AirspyDeviceAdapter implements ISDRDevice {
  private device: AirspyDevice;
  private activeBuffers: DataView[] = [];
  private totalBufferSize = 0;
  private maxSamples = 0;
  private currentSamples = 0;

  constructor(usbDevice: USBDevice) {
    this.device = new AirspyDevice(usbDevice);
  }

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return Promise.resolve({
      type: SDRDeviceType.AIRSPY,
      vendorId: 0x1d50,
      productId: 0x60a1,
      serialNumber: undefined,
      firmwareVersion: undefined,
      hardwareRevision: "Airspy R2/Mini",
    });
  }

  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 24e6, // 24 MHz
      maxFrequency: 1800e6, // 1.8 GHz
      supportedSampleRates: [
        2.5e6, // 2.5 MS/s
        10e6, // 10 MS/s
      ],
      maxLNAGain: 45, // 15 steps × 3 dB = 45 dB
      supportsAmpControl: false, // Uses AGC instead
      supportsAntennaControl: false,
      maxBandwidth: 10e6, // Maximum 10 MHz
    };
  }

  async open(): Promise<void> {
    return this.device.open();
  }

  async close(): Promise<void> {
    this.clearBuffers();
    return this.device.close();
  }

  isOpen(): boolean {
    return this.device.isOpen();
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    return this.device.setFrequency(frequencyHz);
  }

  async getFrequency(): Promise<number> {
    return Promise.resolve(this.device.getFrequency());
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    return this.device.setSampleRate(sampleRateHz);
  }

  async getSampleRate(): Promise<number> {
    return Promise.resolve(this.device.getSampleRate());
  }

  async getUsableBandwidth(): Promise<number> {
    // Airspy usable bandwidth is approximately 90% of sample rate
    const sampleRate = this.device.getSampleRate();
    return Promise.resolve(sampleRate * 0.9);
  }

  async setLNAGain(gainDb: number): Promise<void> {
    // Convert dB to gain index (0-15)
    // LNA gain: 0-45 dB in 3 dB steps
    const gainIndex = Math.round(gainDb / 3);
    return this.device.setLNAGain(gainIndex);
  }

  async setVGAGain(gainDb: number): Promise<void> {
    // VGA gain: 0-15 dB in 1 dB steps
    const gainIndex = Math.round(gainDb);
    return this.device.setVGAGain(gainIndex);
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    // Enable/disable AGC for both LNA and Mixer
    await this.device.setLNAAGC(enabled);
    await this.device.setMixerAGC(enabled);
  }

  async setBandwidth(): Promise<void> {
    // Airspy bandwidth is determined by sample rate
    return Promise.resolve();
  }

  async receive(callback: IQSampleCallback): Promise<void> {
    return this.device.receive((samples) => {
      // Convert IQSample[] to DataView for callback
      const buffer = new ArrayBuffer(samples.length * 4); // 4 bytes per sample (2 bytes I + 2 bytes Q)
      const view = new DataView(buffer);

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        if (sample === undefined) {
          continue;
        }
        // Convert ±1.0 float to int16
        const I = Math.round(sample.I * 32768.0);
        const Q = Math.round(sample.Q * 32768.0);
        const offset = i * 4;
        view.setInt16(offset, Math.max(-32768, Math.min(32767, I)), true);
        view.setInt16(offset + 2, Math.max(-32768, Math.min(32767, Q)), true);
      }

      // Track memory usage
      this.activeBuffers.push(view);
      this.totalBufferSize += view.byteLength;
      this.currentSamples += samples.length;
      if (samples.length > this.maxSamples) {
        this.maxSamples = samples.length;
      }

      // Periodically clean old buffers to prevent memory leak
      if (this.activeBuffers.length > 100) {
        const removed = this.activeBuffers.splice(0, 50);
        const removedBytes = removed.reduce(
          (sum, buf) => sum + buf.byteLength,
          0,
        );
        this.totalBufferSize -= removedBytes;
      }

      callback(view);
    });
  }

  async stopRx(): Promise<void> {
    return this.device.stopRx();
  }

  isReceiving(): boolean {
    return this.device.isReceiving();
  }

  parseSamples(data: DataView): IQSample[] {
    return convertInt16ToIQ(data);
  }

  getMemoryInfo(): DeviceMemoryInfo {
    const usedBufferSize = this.activeBuffers.reduce(
      (sum, buf) => sum + buf.byteLength,
      0,
    );

    return {
      totalBufferSize: this.totalBufferSize,
      usedBufferSize,
      activeBuffers: this.activeBuffers.length,
      maxSamples: this.maxSamples,
      currentSamples: this.currentSamples,
    };
  }

  clearBuffers(): void {
    this.activeBuffers = [];
    this.totalBufferSize = 0;
    this.currentSamples = 0;
    console.debug("Airspy buffers cleared");
  }

  async reset(): Promise<void> {
    // Reset by closing and reopening the device
    await this.device.close();
    await this.device.open();
    console.debug("Airspy reset complete");
  }
}
