/**
 * RTL-SDR Device Adapter
 *
 * This adapter wraps the RTLSDRDevice implementation to conform
 * to the universal ISDRDevice interface, providing plug-and-play
 * compatibility with the visualization and control components.
 */

import { RTLSDRDevice } from './RTLSDRDevice';
import {
  ISDRDevice,
  IQSample,
  IQSampleCallback,
  SDRDeviceInfo,
  SDRCapabilities,
  SDRStreamConfig,
  DeviceMemoryInfo,
  SDRDeviceType,
  convertUint8ToIQ,
} from './SDRDevice';

export class RTLSDRDeviceAdapter implements ISDRDevice {
  private device: RTLSDRDevice;
  private activeBuffers: DataView[] = [];
  private totalBufferSize = 0;
  private maxSamples = 0;
  private currentSamples = 0;
  
  constructor(usbDevice: USBDevice) {
    this.device = new RTLSDRDevice(usbDevice);
  }
  
  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    const tunerType = this.device.getTunerType();
    let tunerName = 'Unknown';
    
    switch (tunerType) {
      case 1: tunerName = 'E4000'; break;
      case 2: tunerName = 'FC0012'; break;
      case 3: tunerName = 'FC0013'; break;
      case 4: tunerName = 'FC2580'; break;
      case 5: tunerName = 'R820T'; break;
      case 6: tunerName = 'R828D'; break;
    }
    
    return {
      type: SDRDeviceType.RTLSDR,
      vendorId: 0x0bda,
      productId: 0x2838,
      serialNumber: undefined,  // RTL-SDR doesn't easily expose serial via WebUSB
      firmwareVersion: undefined,
      hardwareRevision: `RTL2832U + ${tunerName}`,
    };
  }
  
  getCapabilities(): SDRCapabilities {
    return {
      minFrequency: 24e6,
      maxFrequency: 1766e6,
      supportedSampleRates: [
        225e3,    // 225 kHz
        900e3,    // 900 kHz
        1.024e6,  // 1.024 MHz
        1.4e6,    // 1.4 MHz
        1.8e6,    // 1.8 MHz
        1.92e6,   // 1.92 MHz
        2.048e6,  // 2.048 MHz (default)
        2.4e6,    // 2.4 MHz
        2.56e6,   // 2.56 MHz
        2.88e6,   // 2.88 MHz
        3.2e6,    // 3.2 MHz (max)
      ],
      maxLNAGain: 49.6,
      // RTL-SDR doesn't have separate VGA gain control
      supportsAmpControl: false,  // RTL-SDR uses AGC instead
      supportsAntennaControl: false,
      maxBandwidth: 3.2e6,
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
    return this.device.getFrequency();
  }
  
  async setSampleRate(sampleRateHz: number): Promise<void> {
    return this.device.setSampleRate(sampleRateHz);
  }
  
  async getSampleRate(): Promise<number> {
    return this.device.getSampleRate();
  }
  
  async getUsableBandwidth(): Promise<number> {
    // RTL-SDR usable bandwidth is approximately 80% of sample rate
    // due to anti-aliasing filter rolloff
    const sampleRate = await this.device.getSampleRate();
    return sampleRate * 0.8;
  }
  
  async setLNAGain(gainDb: number): Promise<void> {
    return this.device.setGain(gainDb);
  }
  
  // RTL-SDR doesn't have separate VGA gain control
  async setVGAGain?(gainDb: number): Promise<void> {
    // No-op for RTL-SDR
    console.debug('RTL-SDR does not support separate VGA gain control');
  }
  
  async setAmpEnable(enabled: boolean): Promise<void> {
    // RTL-SDR uses AGC instead of separate amp control
    // When "amp" is enabled, we enable AGC; when disabled, we use manual gain
    return this.device.setAGC(enabled);
  }
  
  // RTL-SDR doesn't have configurable bandwidth filter
  async setBandwidth?(bandwidthHz: number): Promise<void> {
    // No-op for RTL-SDR - bandwidth is determined by sample rate
    console.debug('RTL-SDR bandwidth is determined by sample rate');
  }
  
  async receive(
    callback: IQSampleCallback,
    config?: Partial<SDRStreamConfig>
  ): Promise<void> {
    return this.device.receive((samples) => {
      // Convert IQSample[] to DataView for callback
      const buffer = new ArrayBuffer(samples.length * 2);
      const view = new DataView(buffer);
      
      for (let i = 0; i < samples.length; i++) {
        // Convert ±1.0 float back to uint8 with 127 offset
        const I = Math.floor((samples[i]!.I * 128.0 + 127));
        const Q = Math.floor((samples[i]!.Q * 128.0 + 127));
        view.setUint8(i * 2, Math.max(0, Math.min(255, I)));
        view.setUint8(i * 2 + 1, Math.max(0, Math.min(255, Q)));
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
        const removedBytes = removed.reduce((sum, buf) => sum + buf.byteLength, 0);
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
    return convertUint8ToIQ(data);
  }
  
  getMemoryInfo(): DeviceMemoryInfo {
    const usedBufferSize = this.activeBuffers.reduce(
      (sum, buf) => sum + buf.byteLength,
      0
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
    console.debug('RTL-SDR buffers cleared');
  }
  
  async reset(): Promise<void> {
    // Reset by closing and reopening the device
    await this.device.close();
    await this.device.open();
    console.debug('RTL-SDR reset complete');
  }
}

