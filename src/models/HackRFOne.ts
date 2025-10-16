//// filepath: c:\Users\Owner\dev\rad.io\src\models\HackRFOne.ts
import { TransceiverMode } from "./HackRFDevice/constants";

const UINT32_MAX = 0xffffffff;
const MHZ_IN_HZ = 1_000_000;
const MAX_SAMPLE_RATE_DIVIDER = 32;

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

function splitFrequencyComponents(
  frequencyHz: number,
): { mhz: number; hz: number } {
  assertFiniteNonNegative(frequencyHz, "Frequency");
  const rounded = Math.round(frequencyHz);
  const mhz = Math.floor(rounded / MHZ_IN_HZ);
  const hz = rounded - mhz * MHZ_IN_HZ;
  if (mhz > UINT32_MAX || hz > UINT32_MAX) {
    throw new Error("Frequency components exceed uint32 range");
  }
  return { mhz, hz };
}

function createUint32LEBuffer(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((value, index) => {
    assertFiniteNonNegative(value, "Control value");
    const rounded = Math.round(value);
    if (rounded > UINT32_MAX) {
      throw new Error("Control value exceeds uint32 range");
    }
    view.setUint32(index * 4, rounded >>> 0, true);
  });
  return buffer;
}

function computeSampleRateParams(
  sampleRate: number,
): { freqHz: number; divider: number } {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Sample rate must be a positive finite number");
  }

  const target = sampleRate;
  const initialFreq = Math.round(target);
  if (!Number.isFinite(initialFreq) || initialFreq <= 0) {
    throw new Error("Sample rate cannot be rounded to uint32");
  }
  if (initialFreq > UINT32_MAX) {
    throw new Error("Sample rate exceeds uint32 range");
  }

  let bestFreq = initialFreq;
  let bestDivider = 1;
  let smallestError = Math.abs(initialFreq - target);

  for (let divider = 1; divider <= MAX_SAMPLE_RATE_DIVIDER; divider++) {
    const candidate = Math.round(target * divider);
    if (!Number.isFinite(candidate) || candidate <= 0 || candidate > UINT32_MAX) {
      continue;
    }
    const achieved = candidate / divider;
    const error = Math.abs(achieved - target);
    if (error < smallestError) {
      bestFreq = candidate;
      bestDivider = divider;
      smallestError = error;
      if (error === 0) {
        break;
      }
    }
  }

  return { freqHz: bestFreq, divider: bestDivider };
}

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
  private interfaceNumber: number | null = null;

  // Added property to control streaming state
  private streaming: boolean = false;
  // New flag to indicate that shutdown has begun
  private closing: boolean = false;

  // Add a simple mutex to prevent concurrent USB state changes
  private transferMutex: Promise<void> = Promise.resolve();

  // Memory management for buffers
  private sampleBuffers: DataView[] = [];
  private totalBufferSize: number = 0;
  private readonly maxBufferSize: number = 16 * 1024 * 1024; // 16 MB max
  private inEndpointNumber: number = 1;

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
  }

  async open(): Promise<void> {
    this.closing = false;

    if (this.usbDevice.opened && this.interfaceNumber !== null) {
      return;
    }

    if (!this.usbDevice.opened) {
      await this.usbDevice.open();
    }

    if (!this.usbDevice.configuration) {
      const configValue =
        this.usbDevice.configurations?.[0]?.configurationValue ?? 1;
      await this.usbDevice.selectConfiguration(configValue);
    }

    const configuration = this.usbDevice.configuration;
    if (!configuration || configuration.interfaces.length === 0) {
      throw new Error("No interface found on USB device configuration");
    }

    let selectedInterface: USBInterface | undefined;
    let selectedAlternate: USBAlternateInterface | undefined;

    for (const iface of configuration.interfaces) {
      for (const alternate of iface.alternates) {
        const hasBulkInEndpoint = alternate.endpoints.some(
          (endpoint) => endpoint.type === "bulk" && endpoint.direction === "in",
        );
        if (hasBulkInEndpoint) {
          selectedInterface = iface;
          selectedAlternate = alternate;
          break;
        }
      }
      if (selectedInterface && selectedAlternate) {
        break;
      }
    }

    if (!selectedInterface || !selectedAlternate) {
      throw new Error("No suitable streaming interface found on HackRF device");
    }

    const inEndpoint = selectedAlternate.endpoints.find(
      (endpoint) => endpoint.type === "bulk" && endpoint.direction === "in",
    );

    if (!inEndpoint) {
      throw new Error(
        "No bulk IN endpoint available on selected HackRF interface",
      );
    }

    this.interfaceNumber = selectedInterface.interfaceNumber;
    this.inEndpointNumber = inEndpoint.endpointNumber;
    await this.usbDevice.claimInterface(this.interfaceNumber);
    await this.usbDevice.selectAlternateInterface(
      this.interfaceNumber,
      selectedAlternate.alternateSetting,
    );
  }

  async close(): Promise<void> {
    // Signal shutdown: stop streaming and prevent new transfers
    this.streaming = false;
    this.closing = true;
    if (this.usbDevice.opened) {
      if (this.interfaceNumber !== null) {
        try {
          await this.usbDevice.releaseInterface(this.interfaceNumber);
        } catch (err) {
          console.warn("Failed to release HackRF interface", err);
        }
      }
      await this.usbDevice.close();
    }
    this.interfaceNumber = null;
  }

  private async controlTransferIn({
    command,
    value = 0,
    index = 0,
    length,
  }: ControlTransferInProps): Promise<USBInTransferResult> {
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
    const result = await this.usbDevice.controlTransferIn(options, length);
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
  }: ControlTransferOutProps): Promise<USBOutTransferResult> {
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
          const result = await this.usbDevice.controlTransferOut(options, data);
          // Allow device state to settle
          await this.delay(50);
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
  async setFrequency(frequency: number): Promise<void> {
    const { mhz, hz } = splitFrequencyComponents(frequency);
    const payload = createUint32LEBuffer([mhz, hz]);
    await this.controlTransferOut({
      command: RequestCommand.SET_FREQ,
      data: payload,
    });
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    const value = Number(enabled);
    await this.controlTransferOut({
      command: RequestCommand.AMP_ENABLE,
      value,
    });
  }

  /**
   * Set RX LNA (IF) gain, 0-40dB in 8dB steps
   * @param gain RX IF gain value in dB
   */
  async setLNAGain(gain: number): Promise<void> {
    const { data } = await this.controlTransferIn({
      command: RequestCommand.SET_LNA_GAIN,
      index: gain,
      length: 1,
    });

    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    if (data.byteLength !== 1 || !data.getUint8(data.byteOffset)) {
      throw new Error("Invalid Param");
    }
  }

  private async setTransceiverMode(value: TransceiverMode): Promise<void> {
    await this.controlTransferOut({
      command: RequestCommand.SET_TRANSCEIVER_MODE,
      value,
    });
  }

  // New method to set the sample rate (in Hz)
  async setSampleRate(sampleRate: number): Promise<void> {
    const { freqHz, divider } = computeSampleRateParams(sampleRate);
    const payload = createUint32LEBuffer([freqHz, divider]);
    await this.controlTransferOut({
      command: RequestCommand.SAMPLE_RATE_SET,
      data: payload,
    });
  }

  /**
   * Set baseband filter bandwidth
   * @param bandwidthHz Bandwidth in Hz (1.75 MHz to 28 MHz)
   */
  async setBandwidth(bandwidthHz: number): Promise<void> {
    assertFiniteNonNegative(bandwidthHz, "Bandwidth");
    const rounded = Math.round(bandwidthHz);
    if (rounded > UINT32_MAX) {
      throw new Error("Bandwidth exceeds uint32 range");
    }
    const value = rounded & 0xffff;
    const index = (rounded >>> 16) & 0xffff;
    await this.controlTransferOut({
      command: RequestCommand.BASEBAND_FILTER_BANDWIDTH_SET,
      value,
      index,
    });
  }

  // New method to start reception with an optional data callback
  async receive(callback?: (data: DataView) => void): Promise<void> {
    await this.setTransceiverMode(TransceiverMode.RECEIVE);
    this.streaming = true;
    while (this.streaming) {
      try {
        const result = await this.usbDevice.transferIn(
          this.inEndpointNumber,
          4096,
        );
        if (result.data) {
          // Track buffer for memory management
          this.trackBuffer(result.data);

          if (callback) {
            callback(result.data);
          }
        }
      } catch (err: unknown) {
        const error = err as Error & { name?: string };
        if (error.name === "AbortError") {
          // transferIn aborted as expected during shutdown
          break;
        } else {
          console.error("Unexpected error during transferIn:", err);
          break;
        }
      }
    }
    await this.setTransceiverMode(TransceiverMode.OFF);
    await this.controlTransferOut({
      command: RequestCommand.UI_ENABLE,
      value: 1,
    });
  }

  // New method to stop reception
  async stopRx(): Promise<void> {
    this.streaming = false;
  }

  /**
   * Track incoming buffer for memory management
   */
  private trackBuffer(data: DataView): void {
    this.sampleBuffers.push(data);
    this.totalBufferSize += data.byteLength;

    // Auto-cleanup if buffer size exceeds limit
    if (this.totalBufferSize > this.maxBufferSize) {
      this.clearOldBuffers();
    }
  }

  /**
   * Clear old buffers to prevent memory overflow
   */
  private clearOldBuffers(): void {
    const targetSize = this.maxBufferSize / 2;
    while (this.totalBufferSize > targetSize && this.sampleBuffers.length > 0) {
      const buffer = this.sampleBuffers.shift();
      if (buffer) {
        this.totalBufferSize -= buffer.byteLength;
      }
    }
  }

  /**
   * Get current memory usage information
   */
  getMemoryInfo(): {
    totalBufferSize: number;
    usedBufferSize: number;
    activeBuffers: number;
  } {
    return {
      totalBufferSize: this.maxBufferSize,
      usedBufferSize: this.totalBufferSize,
      activeBuffers: this.sampleBuffers.length,
    };
  }

  /**
   * Clear all internal buffers and release memory
   */
  clearBuffers(): void {
    this.sampleBuffers = [];
    this.totalBufferSize = 0;
  }
}
