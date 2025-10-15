//// filepath: c:\Users\Owner\dev\rad.io\src\models\HackRFOne.ts
import { TransceiverMode } from "./HackRFDevice/constants";

export enum RequestCommand {
  SET_TRANSCEIVER_MODE = 1,
  MAX2837_WRITE = 2,
  MAX2837_READ = 3,
  SI5351C_WRITE = 4,
  SI5351C_READ = 5,
  SAMPLE_RATE_SET = 6,
  BASEBAND_FILTER_BANDWIDTH_SET = 7,
  RFFC5071_WRITE = 8,
  RFFC5071_READ = 9,
  SPIFLASH_ERASE = 10,
  SPIFLASH_WRITE = 11,
  SPIFLASH_READ = 12,
  BOARD_ID_READ = 14,
  VERSION_STRING_READ = 15,
  SET_FREQ = 16,
  AMP_ENABLE = 17,
  BOARD_PARTID_SERIALNO_READ = 18,
  SET_LNA_GAIN = 19,
  SET_VGA_GAIN = 20,
  SET_TXVGA_GAIN = 21,
  ANTENNA_ENABLE = 23,
  SET_FREQ_EXPLICIT = 24,
  USB_WCID_VENDOR_REQ = 25,
  INIT_SWEEP = 26,
  OPERACAKE_GET_BOARDS = 27,
  OPERACAKE_SET_PORTS = 28,
  SET_HW_SYNC_MODE = 29,
  RESET = 30,
  OPERACAKE_SET_RANGES = 31,
  CLKOUT_ENABLE = 32,
  SPIFLASH_STATUS = 33,
  SPIFLASH_CLEAR_STATUS = 34,
  OPERACAKE_GPIO_TEST = 35,
  CPLD_CHECKSUM = 36,
  UI_ENABLE = 37,
}
type ControlTransferInProps = {
  command: RequestCommand;
  value?: number;
  data?: BufferSource;
  length: number;
  index?: number;
};

type ControlTransferOutProps = {
  command: RequestCommand;
  value?: number;
  data?: BufferSource;
  index?: number;
};

export class HackRFOne {
  private usbDevice: USBDevice;
  private interfaceNumber: number;

  // Added property to control streaming state
  private streaming: boolean = false;
  // New flag to indicate that shutdown has begun
  private closing: boolean = false;

  // Add a simple mutex to prevent concurrent USB state changes
  private transferMutex: Promise<void> = Promise.resolve();

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
    const { configuration } = this.usbDevice;
    if (!configuration) {
      throw new Error("No configurations available on USB device");
    }
    const [iface] = configuration.interfaces;
    if (!iface) {
      throw new Error("No interface found on USB device configuration");
    }
    this.interfaceNumber = iface.interfaceNumber;
  }

  async open() {
    await this.usbDevice.open();
    console.debug("Opened USB Device");

    await this.usbDevice.claimInterface(this.interfaceNumber);
    console.debug("Claimed Interface", {
      interfaceNumber: this.interfaceNumber,
    });
  }

  async close() {
    // Signal shutdown: stop streaming and prevent new transfers
    this.streaming = false;
    this.closing = true;
    await this.usbDevice.releaseInterface(this.interfaceNumber);
    console.debug("Released Interface", {
      interfaceNumber: this.interfaceNumber,
    });
    await this.usbDevice.close();
    console.debug("Closed USB Device");
  }

  private async controlTransferIn({
    command,
    value = 0,
    index = 0,
    length,
  }: ControlTransferInProps) {
    if (this.closing || !this.usbDevice.opened) {
      throw new Error(
        "Device is closing or closed. Aborting controlTransferIn.",
      );
    }
    const options: USBControlTransferParameters = {
      requestType: "vendor",
      recipient: "device",
      request: command,
      value,
      index,
    };
    console.debug("Starting controlTransferIn", options, length);
    const result = await this.usbDevice.controlTransferIn(options, length);
    console.debug("Completed controlTransferIn");
    return result;
  }

  private async acquireLock(): Promise<() => void> {
    let release: () => void;
    const previousLock = this.transferMutex;
    this.transferMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previousLock;
    return release!;
  }

  // New helper function to introduce a delay
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async controlTransferOut({
    command,
    value = 0,
    data,
    index = 0,
  }: ControlTransferOutProps) {
    const release = await this.acquireLock();
    try {
      if (this.closing || !this.usbDevice.opened) {
        throw new Error(
          "Device is closing or closed. Aborting controlTransferOut.",
        );
      }
      const options: USBControlTransferParameters = {
        requestType: "vendor",
        recipient: "device",
        request: command,
        value,
        index,
      };
      let attempts = 3;
      let lastError: Error | unknown;
      while (attempts > 0) {
        if (this.closing || !this.usbDevice.opened) {
          throw new Error(
            "Device is closing or closed during retry. Aborting controlTransferOut.",
          );
        }
        try {
          console.debug("Starting controlTransferOut", options, data);
          const result = await this.usbDevice.controlTransferOut(options, data);
          // Allow device state to settle
          await this.delay(50);
          console.debug("Completed controlTransferOut");
          return result;
        } catch (err: unknown) {
          const error = err as Error & { name?: string };
          if (error.name === "InvalidStateError") {
            console.warn(
              `controlTransferOut attempt failed with InvalidStateError, ${
                attempts - 1
              } attempts remaining.`,
            );
            lastError = err;
            await this.delay(100);
            attempts--;
          } else {
            throw err;
          }
        }
      }
      throw lastError;
    } finally {
      release();
    }
  }

  /**
   *
   * @param frequency Center Frequency, in Hertz
   */
  async setFrequency(frequency: number) {
    // TODO: Verify frequency is valid
    // Convert frequency(64bit) to Mhz(32bit) + Hz(32bit)
    const mhzPart = frequency / 1e6;
    const hzPart = frequency % 1e6;
    const data = new Uint32Array([mhzPart, hzPart]);
    await this.controlTransferOut({ command: RequestCommand.SET_FREQ, data });
    console.debug("Set Frequency", { frequency });
  }

  async setAmpEnable(enabled: boolean) {
    const value = Number(enabled);
    await this.controlTransferOut({
      command: RequestCommand.AMP_ENABLE,
      value,
    });
    console.debug("Set Amp Enabled", { enabled, value });
  }

  /**
   * Set RX LNA (IF) gain, 0-40dB in 8dB steps
   * @param gain RX IF gain value in dB
   */
  async setLNAGain(gain: number) {
    const { data } = await this.controlTransferIn({
      command: RequestCommand.SET_LNA_GAIN,
      index: gain,
      length: 1,
    });

    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    console.log("Got Data", {
      length: data.byteLength,
      offset: data.byteOffset,
    });
    if (data.byteLength != 1 || !data.getUint8(data.byteOffset)) {
      throw new Error("Invalid Param");
    }

    console.log(data);
    const result = data.getUint8(0);
    console.log("Result from setting gain", { result });
  }

  private async setTransceiverMode(value: TransceiverMode) {
    await this.controlTransferOut({
      command: RequestCommand.SET_TRANSCEIVER_MODE,
      value,
    });
    console.debug("Set transceiver mode", { value });
  }

  // New method to set the sample rate (in Hz)
  async setSampleRate(sampleRate: number) {
    const data = new Uint32Array([sampleRate]);
    await this.controlTransferOut({
      command: RequestCommand.SAMPLE_RATE_SET,
      data,
    });
    console.debug("Set Sample Rate", { sampleRate });
  }

  // New method to start reception with an optional data callback
  async receive(callback?: (data: DataView) => void) {
    await this.setTransceiverMode(TransceiverMode.RECEIVE);
    this.streaming = true;
    console.debug("Started RX stream");
    while (this.streaming) {
      try {
        const result = await this.usbDevice.transferIn(1, 4096);
        if (result.data) {
          if (callback) {
            callback(result.data);
          } else {
            console.debug("Received data", result.data);
          }
        }
      } catch (err: unknown) {
        const error = err as Error & { name?: string };
        if (error.name === "AbortError") {
          console.debug("transferIn aborted as expected during shutdown.");
          break;
        } else {
          console.error("Unexpected error during transferIn:", err);
          break;
        }
      }
    }
    console.debug("Exiting RX stream loop.");
    await this.setTransceiverMode(TransceiverMode.OFF);
    await this.controlTransferOut({
      command: RequestCommand.UI_ENABLE,
      value: 1,
    });
    console.debug("Set device to OFF and UI enabled");
  }

  // New method to stop reception
  async stopRx() {
    this.streaming = false;
    console.debug("Stopped RX stream");
  }
}
