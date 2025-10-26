import { TransceiverMode } from "./constants";

const UINT32_MAX = 0xffffffff;
const MHZ_IN_HZ = 1_000_000;
const MAX_SAMPLE_RATE_DIVIDER = 32;

// HackRF One frequency range (per specifications)
const MIN_FREQUENCY_HZ = 1_000_000; // 1 MHz
const MAX_FREQUENCY_HZ = 6_000_000_000; // 6 GHz

// HackRF One sample rate range
const MIN_SAMPLE_RATE = 2_000_000; // 2 MSPS
const MAX_SAMPLE_RATE = 20_000_000; // 20 MSPS

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

function splitFrequencyComponents(frequencyHz: number): {
  mhz: number;
  hz: number;
} {
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

function computeSampleRateParams(sampleRate: number): {
  freqHz: number;
  divider: number;
} {
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
    if (
      !Number.isFinite(candidate) ||
      candidate <= 0 ||
      candidate > UINT32_MAX
    ) {
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
  private streaming = false;
  // New flag to indicate that shutdown has begun
  private closing = false;

  // Add a simple mutex to prevent concurrent USB state changes
  private transferMutex: Promise<void> = Promise.resolve();

  // Memory management for buffers
  private sampleBuffers: DataView[] = [];
  private totalBufferSize = 0;
  private readonly maxBufferSize: number = 16 * 1024 * 1024; // 16 MB max
  private inEndpointNumber = 1;

  // Store last known device configuration for automatic recovery
  private lastSampleRate: number | null = null;
  private lastFrequency: number | null = null;
  private lastBandwidth: number | null = null;
  private lastLNAGain: number | null = null;
  private lastAmpEnabled = false;

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
        this.usbDevice.configurations[0]?.configurationValue ?? 1;
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
          console.warn("Failed to release HackRF interface", {
            interfaceNumber: this.interfaceNumber,
            error: err instanceof Error ? err.message : String(err),
          });
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
    let release: (() => void) | undefined;
    const previousLock = this.transferMutex;
    this.transferMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previousLock;
    if (release === undefined) {
      throw new Error("Failed to initialize release function");
    }
    return release;
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
      let lastError: unknown;
      while (attempts > 0) {
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
    // Validate frequency is within HackRF One's supported range
    if (frequency < MIN_FREQUENCY_HZ || frequency > MAX_FREQUENCY_HZ) {
      throw new Error(
        `Frequency ${frequency / 1e6} MHz out of range. ` +
          `HackRF One supports ${MIN_FREQUENCY_HZ / 1e6} MHz to ${MAX_FREQUENCY_HZ / 1e6} MHz`,
      );
    }

    const { mhz, hz } = splitFrequencyComponents(frequency);
    const payload = createUint32LEBuffer([mhz, hz]);
    await this.controlTransferOut({
      command: RequestCommand.SET_FREQ,
      data: payload,
    });
    this.lastFrequency = frequency;

    const isDev = process.env["NODE_ENV"] === "development";
    if (isDev) {
      console.debug("HackRFOne.setFrequency: Frequency configured", {
        frequency,
        frequencyMHz: (frequency / 1e6).toFixed(3),
        mhz,
        hz,
      });
    }
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    const value = Number(enabled);
    await this.controlTransferOut({
      command: RequestCommand.AMP_ENABLE,
      value,
    });
    this.lastAmpEnabled = enabled;
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
    this.lastLNAGain = gain;
  }

  private async setTransceiverMode(value: TransceiverMode): Promise<void> {
    await this.controlTransferOut({
      command: RequestCommand.SET_TRANSCEIVER_MODE,
      value,
    });
  }

  // New method to set the sample rate (in Hz)
  async setSampleRate(sampleRate: number): Promise<void> {
    // Validate sample rate is within HackRF One's supported range
    if (sampleRate < MIN_SAMPLE_RATE || sampleRate > MAX_SAMPLE_RATE) {
      throw new Error(
        `Sample rate ${sampleRate / 1e6} MSPS out of range. ` +
          `HackRF One supports ${MIN_SAMPLE_RATE / 1e6} to ${MAX_SAMPLE_RATE / 1e6} MSPS`,
      );
    }

    const { freqHz, divider } = computeSampleRateParams(sampleRate);
    const payload = createUint32LEBuffer([freqHz, divider]);
    await this.controlTransferOut({
      command: RequestCommand.SAMPLE_RATE_SET,
      data: payload,
    });
    this.lastSampleRate = sampleRate;

    const isDev = process.env["NODE_ENV"] === "development";
    if (isDev) {
      console.debug("HackRFOne.setSampleRate: Sample rate configured", {
        sampleRate,
        sampleRateMSPS: (sampleRate / 1e6).toFixed(3),
        freqHz,
        divider,
      });
    }
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
    this.lastBandwidth = bandwidthHz;
  }

  /**
   * Creates a timeout promise that rejects after the specified duration
   */
  private async createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Validates device is properly configured before streaming
   */
  private validateDeviceHealth(): void {
    if (!this.usbDevice.opened) {
      throw new Error("Device is not open");
    }
    if (this.closing) {
      throw new Error("Device is closing");
    }
    // CRITICAL: Validate that sample rate has been set before streaming
    // Without sample rate, transferIn() will hang indefinitely
    if (this.lastSampleRate === null) {
      throw new Error(
        "Sample rate not configured. HackRF requires setSampleRate() to be called before receive(). " +
          "Without sample rate, the device will not stream data and transferIn() will hang.",
      );
    }
    // Additional health checks can be added here
  }

  /**
   * Get current device configuration status
   * Useful for pre-streaming validation and diagnostics.
   * 
   * @returns Object containing current device configuration state
   */
  getConfigurationStatus(): {
    isOpen: boolean;
    isStreaming: boolean;
    isClosing: boolean;
    sampleRate: number | null;
    frequency: number | null;
    bandwidth: number | null;
    lnaGain: number | null;
    ampEnabled: boolean;
    isConfigured: boolean;
  } {
    return {
      isOpen: this.usbDevice.opened,
      isStreaming: this.streaming,
      isClosing: this.closing,
      sampleRate: this.lastSampleRate,
      frequency: this.lastFrequency,
      bandwidth: this.lastBandwidth,
      lnaGain: this.lastLNAGain,
      ampEnabled: this.lastAmpEnabled,
      isConfigured: this.lastSampleRate !== null, // Sample rate is critical
    };
  }

  /**
   * Validate that device is ready for streaming
   * Checks all critical prerequisites before starting reception
   * 
   * @returns Object with validation result and detailed issues if any
   */
  validateReadyForStreaming(): {
    ready: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!this.usbDevice.opened) {
      issues.push("Device is not open");
    }

    if (this.closing) {
      issues.push("Device is closing");
    }

    if (this.lastSampleRate === null) {
      issues.push(
        "Sample rate not configured - call setSampleRate() before streaming",
      );
    }

    if (this.streaming) {
      issues.push("Device is already streaming");
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }

  // New method to start reception with an optional data callback
  async receive(callback?: (data: DataView) => void): Promise<void> {
    // Validate device health before streaming
    this.validateDeviceHealth();

    await this.setTransceiverMode(TransceiverMode.RECEIVE);
    this.streaming = true;

    const isDev = process.env["NODE_ENV"] === "development";
    if (isDev) {
      console.warn("HackRFOne.receive: Starting streaming loop", {
        endpoint: this.inEndpointNumber,
        sampleRate: this.lastSampleRate,
        frequency: this.lastFrequency,
        bandwidth: this.lastBandwidth,
      });
    }

    let iterationCount = 0;
    let consecutiveTimeouts = 0;
    const TIMEOUT_MS = 5000; // 5 second timeout
    const MAX_CONSECUTIVE_TIMEOUTS = 3;

    while (this.streaming as boolean) {
      try {
        iterationCount++;
        if (isDev && iterationCount <= 5) {
          console.warn("HackRFOne.receive: Requesting USB transfer", {
            iteration: iterationCount,
            endpoint: this.inEndpointNumber,
            bufferSize: 4096,
          });
        }

        // Wrap transferIn with timeout protection
        const result = await Promise.race([
          this.usbDevice.transferIn(this.inEndpointNumber, 4096),
          this.createTimeout(
            TIMEOUT_MS,
            `transferIn timeout after ${TIMEOUT_MS}ms - device may need reset`,
          ),
        ]);

        // Reset timeout counter on successful transfer
        consecutiveTimeouts = 0;

        if (isDev && iterationCount <= 5) {
          console.warn("HackRFOne.receive: USB transfer completed", {
            iteration: iterationCount,
            status: result.status,
            byteLength: result.data?.byteLength ?? 0,
            hasData: Boolean(result.data),
          });
        }

        if (result.data) {
          // Track buffer for memory management
          this.trackBuffer(result.data);

          if (isDev && iterationCount <= 3) {
            console.warn(
              "HackRFOne.receive: Data received, invoking callback",
              {
                iteration: iterationCount,
                bytes: result.data.byteLength,
                hasCallback: Boolean(callback),
              },
            );
          }
          if (callback) {
            callback(result.data);
          }
        } else if (isDev && iterationCount <= 5) {
          console.warn("HackRFOne.receive: No data in transfer result", {
            iteration: iterationCount,
            status: result.status,
          });
        }
      } catch (err: unknown) {
        const error = err as Error & { name?: string };
        if (error.name === "AbortError") {
          // transferIn aborted as expected during shutdown
          if (isDev) {
            console.warn("HackRFOne.receive: Transfer aborted (shutdown)", {
              iteration: iterationCount,
            });
          }
          break;
        } else if (error.message.includes("timeout")) {
          consecutiveTimeouts++;
          console.warn("HackRFOne.receive: USB transfer timeout", {
            consecutiveCount: consecutiveTimeouts,
            maxAllowed: MAX_CONSECUTIVE_TIMEOUTS,
            iteration: iterationCount,
            willRetry: consecutiveTimeouts < MAX_CONSECUTIVE_TIMEOUTS,
          });

          if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
            // Attempt fast automatic recovery
            try {
              console.warn(
                "HackRFOne.receive: Max timeouts reached, initiating automatic recovery",
                {
                  timeoutCount: consecutiveTimeouts,
                  deviceState: {
                    sampleRate: this.lastSampleRate,
                    frequency: this.lastFrequency,
                    bandwidth: this.lastBandwidth,
                  },
                },
              );
              await this.fastRecovery();
              console.warn(
                "HackRFOne.receive: Automatic recovery successful, resuming stream",
                {
                  iteration: iterationCount,
                },
              );
              // Reset timeout counter and continue streaming
              consecutiveTimeouts = 0;
              continue;
            } catch (recoveryError) {
              // If fast recovery fails, throw error with manual instructions
              console.error(
                "HackRFOne.receive: Automatic recovery failed",
                recoveryError,
                {
                  iteration: iterationCount,
                  deviceState: {
                    sampleRate: this.lastSampleRate,
                    frequency: this.lastFrequency,
                    bandwidth: this.lastBandwidth,
                  },
                },
              );
              throw new Error(
                "Device not responding after automatic recovery attempt. Please:\n" +
                  "1. Unplug and replug the USB cable\n" +
                  "2. Press the reset button on the HackRF\n" +
                  "3. Try a different USB port\n" +
                  "4. Verify device works with hackrf_info command",
              );
            }
          }
          // Continue loop to retry (for timeouts < MAX_CONSECUTIVE_TIMEOUTS)
        } else {
          console.error(
            "HackRFOne.receive: Unexpected error during USB transfer",
            err,
            {
              iteration: iterationCount,
              errorName: error.name,
              deviceState: {
                streaming: this.streaming,
                opened: this.usbDevice.opened,
              },
            },
          );
          throw err;
        }
      }
    }

    if (isDev) {
      console.warn("HackRFOne.receive: Streaming loop ended", {
        totalIterations: iterationCount,
        finalState: {
          streaming: this.streaming,
          closing: this.closing,
        },
      });
    }
    await this.setTransceiverMode(TransceiverMode.OFF);
    await this.controlTransferOut({
      command: RequestCommand.UI_ENABLE,
      value: 1,
    });
  }

  // New method to stop reception
  stopRx(): void {
    this.streaming = false;
  }

  /**
   * Software reset the HackRF device via USB control transfer
   * This is equivalent to the hackrf_reset() function in libhackrf
   * Uses HACKRF_VENDOR_REQUEST_RESET (vendor request 30)
   */
  async reset(): Promise<void> {
    console.warn("HackRFOne.reset: Initiating software reset", {
      deviceState: {
        opened: this.usbDevice.opened,
        streaming: this.streaming,
        sampleRate: this.lastSampleRate,
        frequency: this.lastFrequency,
      },
    });

    try {
      await this.controlTransferOut({
        command: RequestCommand.RESET,
        value: 0,
        index: 0,
      });
      console.warn("HackRFOne.reset: Reset command sent successfully", {
        delayMs: 500,
      });

      // Give device time to reset (typically takes a few hundred ms)
      await this.delay(500);
    } catch (error) {
      console.error("HackRFOne.reset: Failed to reset device", error, {
        deviceOpened: this.usbDevice.opened,
        commandSent: RequestCommand.RESET,
      });
      throw new Error(
        `Failed to reset device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Fast recovery from timeout: reset and automatically reconfigure device
   * This makes recovery seamless for the user - no need to restart reception
   */
  /**
   * Fast recovery method that resets device and restores last configuration.
   * 
   * This method performs a quick device reset with minimal delay and automatically
   * restores all previously configured settings. Useful for recovering from USB
   * communication errors or device hangs without requiring physical intervention.
   * 
   * Recovery steps:
   * 1. Send USB reset command
   * 2. Wait 150ms for device stabilization
   * 3. Restore sample rate
   * 4. Restore frequency
   * 5. Restore bandwidth
   * 6. Restore LNA gain
   * 7. Restore amplifier state
   * 8. Set transceiver mode to RECEIVE
   * 
   * @throws Error if reset fails or device reconfiguration fails
   * @returns Promise that resolves when recovery and reconfiguration complete
   * 
   * @example
   * ```typescript
   * try {
   *   await device.fastRecovery();
   *   console.log('Device recovered successfully');
   * } catch (error) {
   *   console.error('Fast recovery failed:', error);
   *   // Fall back to physical reset
   * }
   * ```
   */
  async fastRecovery(): Promise<void> {
    const isDev = process.env["NODE_ENV"] === "development";
    if (isDev) {
      console.warn("HackRFOne.fastRecovery: Starting automatic recovery", {
        savedState: {
          sampleRate: this.lastSampleRate,
          frequency: this.lastFrequency,
          bandwidth: this.lastBandwidth,
          lnaGain: this.lastLNAGain,
          ampEnabled: this.lastAmpEnabled,
        },
      });
    }

    // Quick reset with minimal delay
    await this.controlTransferOut({
      command: RequestCommand.RESET,
      value: 0,
      index: 0,
    });

    // Minimal delay - just enough for device to stabilize
    await this.delay(150);

    // Reconfigure device to last known state
    if (this.lastSampleRate !== null) {
      const { freqHz, divider } = computeSampleRateParams(this.lastSampleRate);
      const payload = createUint32LEBuffer([freqHz, divider]);
      await this.controlTransferOut({
        command: RequestCommand.SAMPLE_RATE_SET,
        data: payload,
      });
    }

    if (this.lastFrequency !== null) {
      const { mhz, hz } = splitFrequencyComponents(this.lastFrequency);
      const payload = createUint32LEBuffer([mhz, hz]);
      await this.controlTransferOut({
        command: RequestCommand.SET_FREQ,
        data: payload,
      });
    }

    if (this.lastBandwidth !== null) {
      const rounded = Math.round(this.lastBandwidth);
      const value = rounded & 0xffff;
      const index = (rounded >>> 16) & 0xffff;
      await this.controlTransferOut({
        command: RequestCommand.BASEBAND_FILTER_BANDWIDTH_SET,
        value,
        index,
      });
    }

    if (this.lastLNAGain !== null) {
      await this.controlTransferIn({
        command: RequestCommand.SET_LNA_GAIN,
        index: this.lastLNAGain,
        length: 1,
      });
    }

    await this.controlTransferOut({
      command: RequestCommand.AMP_ENABLE,
      value: Number(this.lastAmpEnabled),
    });

    // Restart transceiver mode
    await this.setTransceiverMode(TransceiverMode.RECEIVE);

    if (isDev) {
      console.warn(
        "HackRFOne.fastRecovery: Device recovered and reconfigured successfully",
        {
          restoredState: {
            sampleRate: this.lastSampleRate,
            frequency: this.lastFrequency,
            bandwidth: this.lastBandwidth,
            lnaGain: this.lastLNAGain,
            ampEnabled: this.lastAmpEnabled,
            transceiverMode: "RECEIVE",
          },
        },
      );
    }
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
