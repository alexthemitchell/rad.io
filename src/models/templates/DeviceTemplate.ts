/**
 * SDR Device Implementation Template
 * 
 * This template provides a starting point for implementing new SDR device support.
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to src/models/YourDeviceName.ts
 * 2. Replace all [DEVICE_NAME] placeholders with your device name (e.g., RTLSDRDevice)
 * 3. Update USB configuration constants (vendor ID, product ID, endpoints)
 * 4. Implement all methods according to your device's USB protocol
 * 5. Create an adapter class implementing ISDRDevice (see HackRFOneAdapter.ts for example)
 * 6. Add device USB filter to SDR_USB_DEVICES in SDRDevice.ts
 * 7. Create a device hook in src/hooks/useYourDevice.ts
 * 8. Write comprehensive tests in src/models/__tests__/YourDevice.test.ts
 * 
 * For detailed instructions, see docs/DEVICE_INTEGRATION.md
 */

import { IQSample } from '../SDRDevice';

/**
 * [DEVICE_NAME] USB Device Implementation
 * 
 * TODO: Add device description
 * Frequency range: TODO MHz - TODO MHz
 * Sample rates: TODO
 */
export class [DEVICE_NAME] {
  private device: USBDevice;
  private streaming = false;
  private closing = false;
  
  // Device state
  private frequency = 100e6;  // Default frequency (100 MHz)
  private sampleRate = 2e6;   // Default sample rate (2 MSPS)
  private lnaGain = 0;
  private vgaGain = 0;
  private ampEnabled = false;
  
  // USB configuration - UPDATE THESE FOR YOUR DEVICE
  private readonly VENDOR_ID = 0x0000;  // TODO: Update with your device's vendor ID
  private readonly PRODUCT_ID = 0x0000; // TODO: Update with your device's product ID
  private readonly CONFIG_NUM = 1;      // Usually 1, check device documentation
  private readonly INTERFACE_NUM = 0;   // Usually 0, check device documentation
  private readonly ENDPOINT_IN = 1;     // Bulk IN endpoint for I/Q data, check device docs
  
  // Control commands - UPDATE THESE FOR YOUR DEVICE
  // These are vendor-specific USB control transfer request codes
  private readonly CMD_SET_FREQ = 0x00;        // TODO: Update
  private readonly CMD_SET_SAMPLE_RATE = 0x00; // TODO: Update
  private readonly CMD_SET_LNA_GAIN = 0x00;    // TODO: Update
  private readonly CMD_SET_VGA_GAIN = 0x00;    // TODO: Update (if applicable)
  private readonly CMD_SET_AMP = 0x00;         // TODO: Update (if applicable)
  private readonly CMD_START_RX = 0x00;        // TODO: Update (if applicable)
  private readonly CMD_STOP_RX = 0x00;         // TODO: Update (if applicable)
  
  // Device capabilities - UPDATE THESE FOR YOUR DEVICE
  private readonly MIN_FREQUENCY = 24e6;    // TODO: Update (Hz)
  private readonly MAX_FREQUENCY = 1766e6;  // TODO: Update (Hz)
  private readonly MIN_SAMPLE_RATE = 225e3; // TODO: Update (Hz)
  private readonly MAX_SAMPLE_RATE = 3.2e6; // TODO: Update (Hz)
  
  constructor(usbDevice: USBDevice) {
    this.device = usbDevice;
  }
  
  /**
   * Open and initialize the device
   * 
   * Steps:
   * 1. Open USB device
   * 2. Select configuration
   * 3. Claim interface
   * 4. Initialize device (send any required setup commands)
   */
  async open(): Promise<void> {
    // Open USB device
    if (!this.device.opened) {
      await this.device.open();
    }
    
    // Select configuration
    await this.device.selectConfiguration(this.CONFIG_NUM);
    
    // Claim interface for exclusive access
    await this.device.claimInterface(this.INTERFACE_NUM);
    
    // TODO: Add device-specific initialization
    // Examples:
    // - Reset device
    // - Set default configuration
    // - Enable features
    await this.initialize();
    
    console.log('[DEVICE_NAME] opened successfully');
  }
  
  /**
   * Device-specific initialization
   * Override this method to add custom initialization logic
   */
  private async initialize(): Promise<void> {
    // TODO: Implement device initialization
    // Example: Set default sample rate and frequency
    // await this.setSampleRate(this.sampleRate);
    // await this.setFrequency(this.frequency);
  }
  
  /**
   * Close and cleanup the device
   * 
   * Steps:
   * 1. Stop streaming if active
   * 2. Send any required shutdown commands
   * 3. Release USB interface
   * 4. Close USB device
   */
  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    
    try {
      // Stop streaming
      if (this.streaming) {
        await this.stopRx();
      }
      
      // TODO: Add device-specific cleanup
      // Example: Set device to idle state
      
      // Release interface
      await this.device.releaseInterface(this.INTERFACE_NUM);
      
      // Close device
      await this.device.close();
      
      console.log('[DEVICE_NAME] closed successfully');
    } catch (err) {
      console.error('[DEVICE_NAME] close error:', err);
    } finally {
      this.closing = false;
    }
  }
  
  /**
   * Check if device is open
   */
  isOpen(): boolean {
    return this.device.opened;
  }
  
  /**
   * Set center frequency in Hz
   * 
   * @param frequencyHz - Center frequency in Hertz
   * @throws Error if frequency is out of range
   */
  async setFrequency(frequencyHz: number): Promise<void> {
    // Validate frequency range
    if (frequencyHz < this.MIN_FREQUENCY || frequencyHz > this.MAX_FREQUENCY) {
      throw new Error(
        `Frequency ${frequencyHz / 1e6} MHz out of range ` +
        `(${this.MIN_FREQUENCY / 1e6}-${this.MAX_FREQUENCY / 1e6} MHz)`
      );
    }
    
    // TODO: Format frequency for device
    // Common formats:
    // - 32-bit integer in Hz (little-endian or big-endian)
    // - Split into MHz and Hz components
    // - Logarithmic encoding
    
    // Example for 32-bit little-endian:
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, Math.floor(frequencyHz), true); // true = little-endian
    
    // TODO: Send control transfer
    await this.device.controlTransferOut({
      requestType: 'vendor',  // or 'class' or 'standard'
      recipient: 'device',     // or 'interface' or 'endpoint'
      request: this.CMD_SET_FREQ,
      value: 0,  // Update if needed
      index: 0,  // Update if needed
    }, buffer);
    
    this.frequency = frequencyHz;
    console.debug('[DEVICE_NAME] frequency set:', frequencyHz / 1e6, 'MHz');
  }
  
  /**
   * Get current frequency in Hz
   */
  async getFrequency(): Promise<number> {
    return this.frequency;
  }
  
  /**
   * Set sample rate in Hz
   * 
   * @param sampleRateHz - Sample rate in Hertz (samples per second)
   * @throws Error if sample rate is out of range or not supported
   */
  async setSampleRate(sampleRateHz: number): Promise<void> {
    // Validate sample rate
    if (sampleRateHz < this.MIN_SAMPLE_RATE || sampleRateHz > this.MAX_SAMPLE_RATE) {
      throw new Error(
        `Sample rate ${sampleRateHz / 1e6} MSPS out of range ` +
        `(${this.MIN_SAMPLE_RATE / 1e6}-${this.MAX_SAMPLE_RATE / 1e6} MSPS)`
      );
    }
    
    // TODO: Format sample rate for device
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, Math.floor(sampleRateHz), true);
    
    // TODO: Send control transfer
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_SAMPLE_RATE,
      value: 0,
      index: 0,
    }, buffer);
    
    this.sampleRate = sampleRateHz;
    console.debug('[DEVICE_NAME] sample rate set:', sampleRateHz / 1e6, 'MSPS');
  }
  
  /**
   * Get current sample rate in Hz
   */
  async getSampleRate(): Promise<number> {
    return this.sampleRate;
  }
  
  /**
   * Set LNA (Low Noise Amplifier) gain
   * 
   * @param gainDb - Gain value in dB
   */
  async setLNAGain(gainDb: number): Promise<void> {
    // TODO: Validate gain range for your device
    
    // TODO: Format gain for device
    // Common formats:
    // - Direct dB value
    // - Tenths of dB (multiply by 10)
    // - Index into gain table
    
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_LNA_GAIN,
      value: Math.floor(gainDb),
      index: 0,
    });
    
    this.lnaGain = gainDb;
    console.debug('[DEVICE_NAME] LNA gain set:', gainDb, 'dB');
  }
  
  /**
   * Set VGA (Variable Gain Amplifier) gain
   * Optional - implement if your device has VGA control
   * 
   * @param gainDb - Gain value in dB
   */
  async setVGAGain(gainDb: number): Promise<void> {
    // TODO: Implement if device has VGA
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_VGA_GAIN,
      value: Math.floor(gainDb),
      index: 0,
    });
    
    this.vgaGain = gainDb;
    console.debug('[DEVICE_NAME] VGA gain set:', gainDb, 'dB');
  }
  
  /**
   * Enable or disable RF amplifier
   * 
   * @param enabled - True to enable, false to disable
   */
  async setAmpEnable(enabled: boolean): Promise<void> {
    // TODO: Implement amplifier control
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_AMP,
      value: enabled ? 1 : 0,
      index: 0,
    });
    
    this.ampEnabled = enabled;
    console.debug('[DEVICE_NAME] amp', enabled ? 'enabled' : 'disabled');
  }
  
  /**
   * Start receiving IQ samples
   * 
   * Continuously reads samples from the device and calls the callback
   * with parsed IQ sample data.
   * 
   * @param callback - Function to call with each batch of samples
   */
  async receive(callback: (samples: IQSample[]) => void): Promise<void> {
    if (this.streaming) {
      throw new Error('Already streaming');
    }
    
    this.streaming = true;
    const BUFFER_SIZE = 16384;  // TODO: Adjust for your device
    
    // TODO: Send start RX command if required
    // Some devices need explicit command to start streaming
    // await this.device.controlTransferOut({...});
    
    try {
      let consecutiveErrors = 0;
      
      while (this.streaming && !this.closing) {
        try {
          // Read data from device
          const result = await this.device.transferIn(this.ENDPOINT_IN, BUFFER_SIZE);
          
          if (result.data && result.data.byteLength > 0) {
            // Parse samples and call callback
            const samples = this.parseSamples(new DataView(result.data.buffer));
            callback(samples);
            consecutiveErrors = 0;
          }
        } catch (err) {
          consecutiveErrors++;
          if (consecutiveErrors > 10) {
            throw new Error('Too many consecutive transfer errors');
          }
          console.warn('[DEVICE_NAME] transfer error, retrying:', err);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (err) {
      console.error('[DEVICE_NAME] streaming error:', err);
      this.streaming = false;
      throw err;
    }
  }
  
  /**
   * Stop receiving samples
   */
  async stopRx(): Promise<void> {
    this.streaming = false;
    
    // TODO: Send stop RX command if required
    // await this.device.controlTransferOut({...});
    
    console.debug('[DEVICE_NAME] streaming stopped');
  }
  
  /**
   * Check if device is currently streaming
   */
  isReceiving(): boolean {
    return this.streaming;
  }
  
  /**
   * Parse raw sample data into IQ samples
   * 
   * This method must convert device-specific sample format to normalized
   * IQ samples with I and Q components in the range ±1.0
   * 
   * @param data - Raw sample data from device
   * @returns Array of normalized IQ samples
   */
  parseSamples(data: DataView): IQSample[] {
    // TODO: Implement sample parsing for your device's format
    
    /*
     * Common formats:
     * 
     * 1. Int8 interleaved I/Q (e.g., HackRF):
     *    [I, Q, I, Q, ...] where each value is -128 to 127
     *    Normalize by dividing by 128.0
     * 
     * 2. Uint8 interleaved I/Q with offset (e.g., RTL-SDR):
     *    [I, Q, I, Q, ...] where each value is 0 to 255 with 127 as center
     *    Normalize by (value - 127) / 128.0
     * 
     * 3. Int16 interleaved I/Q (e.g., some SDRs):
     *    [I_low, I_high, Q_low, Q_high, ...] or use DataView.getInt16()
     *    Normalize by dividing by 32768.0
     * 
     * 4. Float32 interleaved I/Q:
     *    Already normalized, just read as float values
     */
    
    // Example: Int8 format (like HackRF)
    const samples: IQSample[] = [];
    for (let i = 0; i < data.byteLength; i += 2) {
      samples.push({
        I: data.getInt8(i) / 128.0,
        Q: data.getInt8(i + 1) / 128.0,
      });
    }
    return samples;
    
    /* Example: Uint8 with offset format (like RTL-SDR)
    const samples: IQSample[] = [];
    for (let i = 0; i < data.byteLength; i += 2) {
      samples.push({
        I: (data.getUint8(i) - 127) / 128.0,
        Q: (data.getUint8(i + 1) - 127) / 128.0,
      });
    }
    return samples;
    */
    
    /* Example: Int16 format
    const samples: IQSample[] = [];
    for (let i = 0; i < data.byteLength; i += 4) {
      samples.push({
        I: data.getInt16(i, true) / 32768.0,      // true = little-endian
        Q: data.getInt16(i + 2, true) / 32768.0,
      });
    }
    return samples;
    */
  }
}

