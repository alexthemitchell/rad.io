/**
 * Airspy Device Implementation
 *
 * Implements WebUSB communication for Airspy R2 SDR devices.
 * Note: While Airspy Mini shares the same USB VID/PID (0x1d50:0x60a1),
 * this implementation currently only supports R2 sample rates (2.5 MS/s, 10 MS/s).
 * Mini-specific sample rates (3 MS/s, 6 MS/s) are not yet supported due to lack
 * of device variant detection. This limitation will be addressed in a future update.
 *
 * USB Configuration:
 * - Vendor ID: 0x1d50 (OpenMoko)
 * - Product ID: 0x60a1 (Airspy R2/Mini)
 * - Interface: 0
 * - Bulk IN Endpoint: 0x81
 *
 * Key Features (Airspy R2):
 * - Frequency range: 24 MHz - 1.8 GHz
 * - Sample rates: 2.5 MS/s, 10 MS/s (R2 only)
 * - 12-bit samples (transmitted as 16-bit)
 * - Configurable gains: LNA, Mixer, IF (VGA)
 * - Low noise amplifier control
 */

import type { IQSample } from "../../models/SDRDevice";

// Airspy USB command codes
enum AirspyCommand {
  INVALID = 0,
  RECEIVER_MODE = 1,
  SET_FREQ = 2,
  SET_SAMPLE_RATE = 3,
  SET_LNA_GAIN = 5,
  SET_MIXER_GAIN = 6,
  SET_VGA_GAIN = 7,
  SET_LNA_AGC = 8,
  SET_MIXER_AGC = 9,
  GET_SAMPLERATES = 27,
}

// Receiver modes
enum ReceiverMode {
  OFF = 0,
  RECEIVER = 1,
}

// Sample types (for future extensibility)
// enum SampleType {
//   FLOAT32_IQ = 0,
//   FLOAT32_REAL = 1,
//   INT16_IQ = 2,
//   INT16_REAL = 3,
//   UINT16_REAL = 4,
//   RAW = 5,
// }

export class AirspyDevice {
  private device: USBDevice;
  private streaming = false;
  private closing = false;

  // Current configuration
  private frequency = 100e6; // 100 MHz default
  private sampleRate = 2.5e6; // 2.5 MS/s default

  // USB configuration constants
  private readonly CONFIG_NUM = 1;
  private readonly INTERFACE_NUM = 0;
  private readonly ENDPOINT_IN = 0x81; // Bulk IN endpoint

  // Device limits
  private readonly MIN_FREQUENCY = 24e6; // 24 MHz
  private readonly MAX_FREQUENCY = 1800e6; // 1.8 GHz
  // Airspy R2 sample rates only. Mini rates (3 MS/s, 6 MS/s) not yet supported.
  private readonly SUPPORTED_SAMPLE_RATES = [2.5e6, 10e6]; // 2.5 MS/s, 10 MS/s (R2)

  // Transfer parameters
  private readonly TRANSFER_SIZE = 262144; // 256 KB buffer

  constructor(usbDevice: USBDevice) {
    this.device = usbDevice;
  }

  async open(): Promise<void> {
    if (!this.device.opened) {
      await this.device.open();
    }

    await this.device.selectConfiguration(this.CONFIG_NUM);
    await this.device.claimInterface(this.INTERFACE_NUM);

    // Initialize device - set to receiver mode OFF to ensure known state.
    // The Airspy protocol does not provide a command to query the current receiver mode,
    // so this explicit initialization ensures predictable operation and device safety
    // before further configuration.
    await this.setReceiverMode(ReceiverMode.OFF);

    console.debug("Airspy device opened successfully");
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }

    this.closing = true;

    try {
      if (this.streaming) {
        await this.stopRx();
      }

      // Turn off receiver
      await this.setReceiverMode(ReceiverMode.OFF);

      if (this.device.opened) {
        await this.device.releaseInterface(this.INTERFACE_NUM);
        await this.device.close();
      }
    } finally {
      this.closing = false;
    }

    console.debug("Airspy device closed successfully");
  }

  isOpen(): boolean {
    return this.device.opened;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    if (frequencyHz < this.MIN_FREQUENCY || frequencyHz > this.MAX_FREQUENCY) {
      throw new Error(
        `Frequency ${frequencyHz} Hz is out of range (${this.MIN_FREQUENCY}-${this.MAX_FREQUENCY} Hz)`,
      );
    }

    // Pack frequency as 32-bit unsigned integer (floor to ensure integer)
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, Math.floor(frequencyHz), true); // little-endian

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_FREQ,
        value: 0,
        index: 0,
      },
      buffer,
    );

    this.frequency = frequencyHz;
    console.debug(`Airspy frequency set to ${frequencyHz / 1e6} MHz`);
  }

  getFrequency(): number {
    return this.frequency;
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    if (!this.SUPPORTED_SAMPLE_RATES.includes(sampleRateHz)) {
      throw new Error(
        `Sample rate ${sampleRateHz} Hz is not supported. Supported rates: ${this.SUPPORTED_SAMPLE_RATES.join(", ")} Hz`,
      );
    }

    // Airspy uses sample rate index - explicit mapping for clarity and maintainability
    const SAMPLE_RATE_INDEX_MAP: Record<number, number> = {
      [10e6]: 0, // 10 MS/s
      [2.5e6]: 1, // 2.5 MS/s
    };
    const rateIndex = SAMPLE_RATE_INDEX_MAP[sampleRateHz];
    if (rateIndex === undefined) {
      throw new Error(
        `Internal error: No index mapping for sample rate ${sampleRateHz} Hz.`,
      );
    }

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, rateIndex, true);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_SAMPLE_RATE,
        value: 0,
        index: 0,
      },
      buffer,
    );

    this.sampleRate = sampleRateHz;
    console.debug(`Airspy sample rate set to ${sampleRateHz / 1e6} MS/s`);
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  async setLNAGain(gain: number): Promise<void> {
    // LNA gain: 0-15 (0 dB to 45 dB in 3 dB steps)
    const clampedGain = Math.max(0, Math.min(15, Math.floor(gain)));

    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, clampedGain);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_LNA_GAIN,
        value: 0,
        index: 0,
      },
      buffer,
    );

    console.debug(
      `Airspy LNA gain set to ${clampedGain} (${clampedGain * 3} dB)`,
    );
  }

  async setMixerGain(gain: number): Promise<void> {
    // Mixer gain: 0-15 (0 dB to 15 dB in 1 dB steps)
    const clampedGain = Math.max(0, Math.min(15, Math.floor(gain)));

    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, clampedGain);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_MIXER_GAIN,
        value: 0,
        index: 0,
      },
      buffer,
    );

    console.debug(`Airspy Mixer gain set to ${clampedGain} dB`);
  }

  async setVGAGain(gain: number): Promise<void> {
    // VGA (IF) gain: 0-15 (0 dB to 15 dB in 1 dB steps)
    const clampedGain = Math.max(0, Math.min(15, Math.floor(gain)));

    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, clampedGain);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_VGA_GAIN,
        value: 0,
        index: 0,
      },
      buffer,
    );

    console.debug(`Airspy VGA gain set to ${clampedGain} dB`);
  }

  async setLNAAGC(enabled: boolean): Promise<void> {
    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, enabled ? 1 : 0);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_LNA_AGC,
        value: 0,
        index: 0,
      },
      buffer,
    );

    console.debug(`Airspy LNA AGC ${enabled ? "enabled" : "disabled"}`);
  }

  async setMixerAGC(enabled: boolean): Promise<void> {
    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, enabled ? 1 : 0);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.SET_MIXER_AGC,
        value: 0,
        index: 0,
      },
      buffer,
    );

    console.debug(`Airspy Mixer AGC ${enabled ? "enabled" : "disabled"}`);
  }

  private async setReceiverMode(mode: ReceiverMode): Promise<void> {
    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, mode);

    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: AirspyCommand.RECEIVER_MODE,
        value: 0,
        index: 0,
      },
      buffer,
    );

    console.debug(
      `Airspy receiver mode set to ${mode === ReceiverMode.RECEIVER ? "RECEIVER" : "OFF"}`,
    );
  }

  async receive(callback: (samples: IQSample[]) => void): Promise<void> {
    if (this.streaming) {
      console.warn("Airspy already streaming");
      return;
    }

    this.streaming = true;

    // Start receiver
    await this.setReceiverMode(ReceiverMode.RECEIVER);

    // Streaming loop
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (this.streaming && !this.closing) {
      try {
        const result = await this.device.transferIn(
          this.ENDPOINT_IN,
          this.TRANSFER_SIZE,
        );

        if (result.status === "ok") {
          if (result.data && result.data.byteLength > 0) {
            const samples = this.parseSamples(new DataView(result.data.buffer));
            if (samples.length > 0) {
              callback(samples);
            }
          }
        } else if (result.status === "stall") {
          console.warn("Airspy transfer stalled, attempting to clear");
          await this.device.clearHalt("in", this.ENDPOINT_IN);
        }
      } catch (error) {
        console.error("Airspy transfer error:", error);
        // Short delay before retry if not closing
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.streaming && !this.closing) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }
  }

  async stopRx(): Promise<void> {
    this.streaming = false;
    await this.setReceiverMode(ReceiverMode.OFF);
    console.debug("Airspy streaming stopped");
  }

  isReceiving(): boolean {
    return this.streaming;
  }

  parseSamples(data: DataView): IQSample[] {
    // Airspy transmits 12-bit samples as 16-bit integers (Int16)
    // Data format: interleaved I/Q pairs
    const sampleCount = data.byteLength / 4; // 2 bytes per I, 2 bytes per Q
    const samples: IQSample[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const offset = i * 4;
      const I = data.getInt16(offset, true); // little-endian
      const Q = data.getInt16(offset + 2, true);

      // Normalize 16-bit signed integer to ±1.0
      // Int16 range: -32768 to 32767
      samples.push({
        I: I / 32768.0,
        Q: Q / 32768.0,
      });
    }

    return samples;
  }
}
