/**
 * RTL-SDR USB Device Implementation
 * 
 * Supports RTL2832U-based devices with R820T/R820T2/E4000 tuners
 * Frequency range: 24 MHz - 1766 MHz (typical for R820T2)
 * Sample rates: 225 kHz - 3.2 MHz
 * 
 * References:
 * - librtlsdr: https://github.com/librtlsdr/librtlsdr
 * - RTL2832U datasheet
 */

import { IQSample } from './SDRDevice';

/**
 * RTL-SDR control commands (vendor requests)
 */
enum RTLSDRCommand {
  DEMOD_READ_REG = 0x00,
  DEMOD_WRITE_REG = 0x01,
  USB_READ_REG = 0x02,
  USB_WRITE_REG = 0x03,
  I2C_READ_REG = 0x04,
  I2C_WRITE_REG = 0x05,
  GET_TUNER_TYPE = 0x06,
  GET_TUNER_GAINS = 0x07,
}

/**
 * RTL-SDR register blocks
 */
enum _RTLSDRBlock {
  USB = 0,
  SYS = 1,
  DEMOD = 2,
  TUNER = 3,
}

/**
 * Supported tuner types
 */
enum RTLSDRTunerType {
  UNKNOWN = 0,
  E4000 = 1,
  FC0012 = 2,
  FC0013 = 3,
  FC2580 = 4,
  R820T = 5,
  R828D = 6,
}

export class RTLSDRDevice {
  private device: USBDevice;
  private streaming = false;
  private closing = false;
  
  // Device state
  private frequency = 100e6;  // 100 MHz default
  private sampleRate = 2.048e6;  // 2.048 MSPS default
  private gain = 0;
  private tunerType: RTLSDRTunerType = RTLSDRTunerType.UNKNOWN;
  
  // USB configuration
  private readonly CONFIG_NUM = 1;
  private readonly INTERFACE_NUM = 0;
  private readonly ENDPOINT_IN = 1;  // Bulk IN endpoint for I/Q data
  
  // Device capabilities (R820T2 typical)
  private readonly MIN_FREQUENCY = 24e6;    // 24 MHz
  private readonly MAX_FREQUENCY = 1766e6;  // 1766 MHz
  private readonly MIN_SAMPLE_RATE = 225e3; // 225 kHz
  private readonly MAX_SAMPLE_RATE = 3.2e6; // 3.2 MHz
  
  constructor(usbDevice: USBDevice) {
    this.device = usbDevice;
  }
  
  async open(): Promise<void> {
    if (!this.device.opened) {
      await this.device.open();
    }
    
    await this.device.selectConfiguration(this.CONFIG_NUM);
    await this.device.claimInterface(this.INTERFACE_NUM);
    
    // Initialize device
    await this.initialize();
    
    console.debug('RTL-SDR opened successfully');
  }
  
  private async initialize(): Promise<void> {
    // Get tuner type
    const result = await this.device.controlTransferIn({
      requestType: 'vendor',
      recipient: 'device',
      request: RTLSDRCommand.GET_TUNER_TYPE,
      value: 0,
      index: 0,
    }, 1);
    
    if (result.data) {
      this.tunerType = result.data.getUint8(0);
      console.debug('RTL-SDR tuner type:', this.tunerType);
    }
    
    // Reset demod
    await this.writeDemodReg(0x01, 0x14, 1);
    await this.writeDemodReg(0x01, 0x10, 1);
    
    // Disable spectrum inversion
    await this.writeDemodReg(0x01, 0x15, 0);
    
    // Set FIR coefficients
    await this.writeDemodReg(0x01, 0x1c, 0xca);
    await this.writeDemodReg(0x01, 0x1d, 0xdc);
    await this.writeDemodReg(0x01, 0x1e, 0xd7);
    await this.writeDemodReg(0x01, 0x1f, 0xd8);
    await this.writeDemodReg(0x01, 0x20, 0xe0);
    await this.writeDemodReg(0x01, 0x21, 0xf2);
    await this.writeDemodReg(0x01, 0x22, 0x0e);
    await this.writeDemodReg(0x01, 0x23, 0x35);
    
    // Set default configuration
    await this.setSampleRate(this.sampleRate);
    await this.setFrequency(this.frequency);
    
    // Set manual gain mode
    await this.writeDemodReg(0x01, 0x05, 0);
    
    console.debug('RTL-SDR initialized');
  }
  
  async close(): Promise<void> {
    if (this.closing) { return; }
    this.closing = true;
    
    try {
      await this.stopRx();
      await this.device.releaseInterface(this.INTERFACE_NUM);
      await this.device.close();
      console.debug('RTL-SDR closed successfully');
    } catch (err) {
      console.error('RTL-SDR close error:', err);
    } finally {
      this.closing = false;
    }
  }
  
  isOpen(): boolean {
    return this.device.opened;
  }
  
  async setFrequency(frequencyHz: number): Promise<void> {
    if (frequencyHz < this.MIN_FREQUENCY || frequencyHz > this.MAX_FREQUENCY) {
      throw new Error(
        `Frequency ${frequencyHz / 1e6} MHz out of range ` +
        `(${this.MIN_FREQUENCY / 1e6}-${this.MAX_FREQUENCY / 1e6} MHz)`
      );
    }
    
    // For R820T/R820T2, we need to set frequency via I2C
    // This is simplified - real implementation would configure tuner properly
    const freqKHz = Math.floor(frequencyHz / 1000);
    
    // Write to tuner via I2C
    await this.writeTunerI2C(0x10, (freqKHz >> 24) & 0xff);
    await this.writeTunerI2C(0x11, (freqKHz >> 16) & 0xff);
    await this.writeTunerI2C(0x12, (freqKHz >> 8) & 0xff);
    await this.writeTunerI2C(0x13, freqKHz & 0xff);
    
    this.frequency = frequencyHz;
    console.debug('RTL-SDR frequency set:', frequencyHz / 1e6, 'MHz');
  }
  
  async getFrequency(): Promise<number> {
    return this.frequency;
  }
  
  async setSampleRate(sampleRateHz: number): Promise<void> {
    if (sampleRateHz < this.MIN_SAMPLE_RATE || sampleRateHz > this.MAX_SAMPLE_RATE) {
      throw new Error(
        `Sample rate ${sampleRateHz / 1e6} MSPS out of range ` +
        `(${this.MIN_SAMPLE_RATE / 1e6}-${this.MAX_SAMPLE_RATE / 1e6} MSPS)`
      );
    }
    
    // Calculate resampler ratio
    const ratio = Math.floor((28800000 * 2) / sampleRateHz);
    const realRate = (28800000 * 2) / ratio;
    
    // Set resampler
    await this.writeDemodReg(0x01, 0x9f, (ratio >> 16) & 0xff);
    await this.writeDemodReg(0x01, 0xa0, (ratio >> 8) & 0xff);
    await this.writeDemodReg(0x01, 0xa1, ratio & 0xff);
    
    // Reset demod
    await this.writeDemodReg(0x01, 0x14, 1);
    await this.writeDemodReg(0x01, 0x10, 1);
    
    this.sampleRate = realRate;
    console.debug('RTL-SDR sample rate set:', realRate / 1e6, 'MSPS');
  }
  
  async getSampleRate(): Promise<number> {
    return this.sampleRate;
  }
  
  async setGain(gainDb: number): Promise<void> {
    // RTL-SDR uses tenths of dB (e.g., 10 = 1.0 dB)
    const gainTenthsDb = Math.floor(gainDb * 10);
    
    // Set manual gain mode (disable AGC)
    await this.writeDemodReg(0x01, 0x05, 0);
    
    // Set tuner gain via I2C
    await this.writeTunerI2C(0x05, (gainTenthsDb >> 8) & 0xff);
    await this.writeTunerI2C(0x06, gainTenthsDb & 0xff);
    
    this.gain = gainDb;
    console.debug('RTL-SDR gain set:', gainDb, 'dB');
  }
  
  async setAGC(enabled: boolean): Promise<void> {
    // Enable/disable automatic gain control
    await this.writeDemodReg(0x01, 0x05, enabled ? 1 : 0);
    console.debug('RTL-SDR AGC:', enabled ? 'enabled' : 'disabled');
  }
  
  async receive(callback: (samples: IQSample[]) => void): Promise<void> {
    if (this.streaming) {
      throw new Error('Already streaming');
    }
    
    this.streaming = true;
    const BUFFER_SIZE = 16384;  // 16KB buffer
    
    try {
      let consecutiveErrors = 0;
      
      while (this.streaming && !this.closing) {
        try {
          const result = await this.device.transferIn(this.ENDPOINT_IN, BUFFER_SIZE);
          
          if (result.data && result.data.byteLength > 0) {
            const samples = this.parseSamples(new DataView(result.data.buffer));
            callback(samples);
            consecutiveErrors = 0;
          }
        } catch (err) {
          consecutiveErrors++;
          if (consecutiveErrors > 10) {
            throw new Error('Too many consecutive transfer errors');
          }
          console.warn('RTL-SDR transfer error, retrying:', err);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (err) {
      console.error('RTL-SDR streaming error:', err);
      this.streaming = false;
      throw err;
    }
  }
  
  async stopRx(): Promise<void> {
    this.streaming = false;
    console.debug('RTL-SDR streaming stopped');
  }
  
  isReceiving(): boolean {
    return this.streaming;
  }
  
  parseSamples(data: DataView): IQSample[] {
    // RTL-SDR uses unsigned 8-bit samples with 127 offset
    // Format: [I, Q, I, Q, ...] where values are 0-255
    const samples: IQSample[] = [];
    
    for (let i = 0; i < data.byteLength; i += 2) {
      const I = (data.getUint8(i) - 127) / 128.0;
      const Q = (data.getUint8(i + 1) - 127) / 128.0;
      samples.push({ I, Q });
    }
    
    return samples;
  }
  
  getTunerType(): RTLSDRTunerType {
    return this.tunerType;
  }
  
  // Helper methods for register access
  
  private async writeDemodReg(page: number, addr: number, value: number): Promise<void> {
    const index = (page << 8) | addr;
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: RTLSDRCommand.DEMOD_WRITE_REG,
      value,
      index,
    });
  }
  
  private async readDemodReg(page: number, addr: number): Promise<number> {
    const index = (page << 8) | addr;
    const result = await this.device.controlTransferIn({
      requestType: 'vendor',
      recipient: 'device',
      request: RTLSDRCommand.DEMOD_READ_REG,
      value: 0,
      index,
    }, 1);
    
    return result.data ? result.data.getUint8(0) : 0;
  }
  
  private async writeTunerI2C(reg: number, value: number): Promise<void> {
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: RTLSDRCommand.I2C_WRITE_REG,
      value,
      index: reg,
    });
  }
  
  private async readTunerI2C(reg: number): Promise<number> {
    const result = await this.device.controlTransferIn({
      requestType: 'vendor',
      recipient: 'device',
      request: RTLSDRCommand.I2C_READ_REG,
      value: 0,
      index: reg,
    }, 1);
    
    return result.data ? result.data.getUint8(0) : 0;
  }
}

