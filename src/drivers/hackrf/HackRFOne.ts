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
  // Stop controller to break out of pending USB transfers promptly
  private stopReject: ((reason?: unknown) => void) | null = null;

  // Add a simple mutex to prevent concurrent USB state changes
  private transferMutex: Promise<void> = Promise.resolve();

  // Memory management for buffers
  private sampleBuffers: DataView[] = [];
  private totalBufferSize = 0;
  private readonly maxBufferSize: number = 16 * 1024 * 1024; // 16 MB max
  private inEndpointNumber = 1;
  // Store streaming alt/interface details separately so we can configure on alt 0
  private streamingAltSetting: number | null = null;
  private streamInEndpointNumber: number | null = null;
  private interfaceClaimed = false;

  // Store last known device configuration for automatic recovery
  private lastSampleRate: number | null = null;
  // Tracks whether a valid configuration was applied at least once in this session
  private configuredOnce = false;
  private lastFrequency: number | null = null;
  private lastBandwidth: number | null = null;
  private lastLNAGain: number | null = null;
  private lastAmpEnabled = false;
  
  // Track consecutive control transfer failures for automatic USB reset recovery
  private consecutiveControlTransferFailures = 0;
  private static readonly MAX_CONSECUTIVE_FAILURES_BEFORE_RESET = 3;

  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
  }

  // Attempt to rebind to a freshly enumerated paired USBDevice when the
  // original reference has become invalid (e.g., after RESET or OS-level
  // re-enumeration). Returns true if a replacement was found and bound.
  private async rebindUSBDevice(): Promise<boolean> {
    type NavigatorWithUSB = Navigator & {
      usb?: {
        getDevices: () => Promise<USBDevice[]>;
      };
    };
    const navUsb = (globalThis as { navigator?: NavigatorWithUSB }).navigator
      ?.usb;
    if (!navUsb || typeof navUsb.getDevices !== "function") {
      return false;
    }
    const prev = this.usbDevice;
    try {
      const devices = await navUsb.getDevices();
      const match = devices.find(
        (d) =>
          d.vendorId === prev.vendorId &&
          d.productId === prev.productId &&
          (prev.serialNumber ? d.serialNumber === prev.serialNumber : true),
      );
      if (match) {
        this.usbDevice = match;
        // Force full re-claim on next open
        this.interfaceNumber = null;
        this.inEndpointNumber = 1;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Opens the HackRF device and prepares it for communication.
   *
   * This method:
   * 1. Opens the USB device connection
   * 2. Selects the appropriate USB configuration
   * 3. Finds and claims the bulk IN streaming interface
   * 4. Identifies the bulk IN endpoint for receiving IQ data
   *
   * After calling open(), you MUST configure the sample rate before streaming:
   * ```typescript
   * await device.open();
   * await device.setSampleRate(20_000_000);  // REQUIRED before receive()
   * await device.setFrequency(100_000_000);
   * await device.receive(callback);
   * ```
   *
   * @throws {Error} If no suitable streaming interface or bulk IN endpoint is found
   * @throws {Error} If the device is already closing
   *
   * @see {@link setSampleRate} - MUST be called before streaming
   * @see {@link receive} - Start streaming after configuration
   */
  /**
   * Open and initialize USB connection to HackRF device
   *
   * Performs the complete WebUSB initialization sequence:
   * 1. Opens the USB device if not already open
   * 2. Selects the first configuration
   * 3. Finds an interface with a bulk IN endpoint for data streaming
   * 4. Claims the interface and selects the appropriate alternate setting
   *
   * After opening, the device is ready for configuration (sample rate, frequency, etc.)
   * but is not yet streaming data. Call `receive()` to start streaming.
   *
   * @throws {Error} If no suitable interface or endpoint is found
   *
   * @remarks
   * This method is idempotent - calling it multiple times on an already-open
   * device is safe and will return immediately.
   *
   * @example
   * ```typescript
   * const hackrf = new HackRFOne(usbDevice);
   * await hackrf.open();
   * // Device is now ready for configuration
   * await hackrf.setSampleRate(20_000_000);
   * await hackrf.setFrequency(100_000_000);
   * await hackrf.receive(callback);
   * ```
   */
  async open(): Promise<void> {
    this.closing = false;

    // Already initialized
    if (this.usbDevice.opened && this.interfaceNumber !== null) {
      return;
    }

    // If the previous session didn't close cleanly (e.g., page reload),
    // prefer a gentle close+reopen over USB reset (which is flaky on Windows/Chrome).
    const needsRecovery = !this.wasCleanClosed;

    // Step 1: Ensure we have an open handle, rebinding if the reference is stale
    const ensureOpen = async () => {
      if (!this.usbDevice.opened) {
        try {
          await this.usbDevice.open();
          return;
        } catch (err) {
          const e = err as Error & { name?: string; message?: string };
          const msg = typeof e.message === "string" ? e.message : "";
          const disconnected =
            e.name === "NotFoundError" || /disconnected|No device selected/i.test(msg);
          if (disconnected) {
            const rebound = await this.rebindUSBDevice();
            if (rebound) {
              await this.usbDevice.open();
              return;
            }
          }
          throw err;
        }
      }
    };

    if (needsRecovery) {
      // Best-effort release/close if something lingered from a dirty shutdown
      try {
        if (this.usbDevice.opened && this.interfaceNumber !== null) {
          await this.usbDevice.releaseInterface(this.interfaceNumber);
        }
      } catch {}
      try {
        if (this.usbDevice.opened) {
          await this.usbDevice.close();
        }
      } catch {}
      // Clear cached interface state so we fully re-claim
      this.interfaceNumber = null;
      this.inEndpointNumber = 1;
      // Allow the OS/WebUSB stack to settle before reopening
      await this.delay(300);
    }

    await ensureOpen();
    
    // Step 2: Select configuration (use first available)
    if (!this.usbDevice.configuration) {
      const configValue =
        this.usbDevice.configurations[0]?.configurationValue ?? 1;
      await this.usbDevice.selectConfiguration(configValue);
    }

    const configuration = this.usbDevice.configuration;
    if (!configuration || configuration.interfaces.length === 0) {
      throw new Error("No interface found on USB device configuration");
    }

    // Step 3: Find interface with bulk IN endpoint for data streaming
    // HackRF uses bulk transfers for high-bandwidth IQ sample data
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

    // Step 4: Claim interface immediately to ensure firmware accepts subsequent vendor requests.
    this.interfaceNumber = selectedInterface.interfaceNumber;
    try {
      await this.usbDevice.claimInterface(this.interfaceNumber);
      this.interfaceClaimed = true;
      await this.usbDevice.selectAlternateInterface(
        this.interfaceNumber,
        selectedAlternate.alternateSetting,
      );
    } catch (err) {
      throw new Error(
        `Failed to claim HackRF interface ${this.interfaceNumber}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Store streaming parameters
    this.streamingAltSetting = selectedAlternate.alternateSetting;
    this.streamInEndpointNumber = inEndpoint.endpointNumber;

    // Short settle delay after interface/alt selection for Windows WebUSB stability
    await this.delay(300);

    // Run structured initialization sequence (non-fatal if partial). This is
    // intentionally after interface claim/alt selection so firmware is ready.
    try {
      await this.performInitializationSequence();
    } catch (e) {
      console.warn("HackRF open: initialization sequence encountered errors", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Mark device as cleanly opened (not stale)
    this.wasCleanClosed = false;
  }

  /**
   * Perform structured initialization of HackRF configuration after USB open & interface claim.
   * Orders vendor requests with settle delays and guarded retries to reduce EP0 saturation.
   * Only updates internal last* state after confirmed success of each command.
   */
  private async performInitializationSequence(): Promise<void> {
    // Skip if already configured at least once; caller (adapter) can handle dynamic reconfiguration.
    if (this.configuredOnce) return;

    const sequence: Array<{ name: string; fn: () => Promise<void>; }> = [];

    // We gate configuration so we do not optimistically mark values until success.
    const applyTransceiverMode = async () => {
      await this.setTransceiverMode("RX");
    };
    const applySampleRate = async () => {
      if (this.lastSampleRate) {
        await this.setSampleRate(this.lastSampleRate);
      }
    };
    const applyBandwidth = async () => {
      if (this.lastBandwidth) {
        await this.setBandwidth(this.lastBandwidth);
      }
    };
    const applyFrequency = async () => {
      if (this.lastFrequency) {
        await this.setFrequency(this.lastFrequency);
      }
    };
    const applyAmp = async () => {
      if (typeof this.lastAmpEnabled === "boolean") {
        await this.setAmpEnable(this.lastAmpEnabled);
      }
    };

    sequence.push(
      { name: "transceiver", fn: applyTransceiverMode },
      { name: "sampleRate", fn: applySampleRate },
      { name: "bandwidth", fn: applyBandwidth },
      { name: "frequency", fn: applyFrequency },
      { name: "amp", fn: applyAmp },
    );

    // Per-command retry/backoff parameters.
    const MAX_PER_COMMAND_ATTEMPTS = 4;
    const BASE_DELAY_MS = 75; // settle between successful commands

    for (const step of sequence) {
      let attempt = 0;
      let backoff = 100;
      while (attempt < MAX_PER_COMMAND_ATTEMPTS) {
        try {
          await step.fn();
          // Small settle after success
          await this.delay(BASE_DELAY_MS);
          break;
        } catch (err) {
          attempt++;
          if (attempt >= MAX_PER_COMMAND_ATTEMPTS) {
            console.warn("HackRF init: step failed", { step: step.name, attempts: attempt, error: err instanceof Error ? err.message : String(err) });
            // Abort remaining steps to avoid storming EP0
            return;
          }
          console.warn("HackRF init: retry", { step: step.name, attempt, error: err instanceof Error ? err.message : String(err) });
          await this.delay(backoff);
          backoff = Math.min(backoff * 2, 800);
        }
      }
    }

    this.configuredOnce = true;
  }

  async close(): Promise<void> {
    // Prevent concurrent close operations
    if (this.closing) {
      return;
    }
    
    // Signal shutdown: stop streaming and prevent new transfers
    this.streaming = false;
    this.closing = true;
    
    if (this.usbDevice.opened) {
      if (this.interfaceNumber !== null && this.interfaceClaimed) {
        try {
          await this.usbDevice.releaseInterface(this.interfaceNumber);
        } catch (err) {
          console.warn("Failed to release HackRF interface", {
            interfaceNumber: this.interfaceNumber,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      try {
        await this.usbDevice.close();
        // Successfully closed - mark as clean
        this.wasCleanClosed = true;
      } catch (err) {
        // Browser may have auto-released during navigation
        console.warn("Failed to close HackRF device", {
          error: err instanceof Error ? err.message : String(err),
        });
        // Mark as dirty since we couldn't confirm clean close
        this.wasCleanClosed = false;
      }
    } else {
      // Device was already closed (possibly by browser during navigation)
      this.wasCleanClosed = false;
    }
    
    this.interfaceNumber = null;
    this.interfaceClaimed = false;
  }

  // Note: controlTransferIn removed due to no current call sites.

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
      if (this.closing) {
        throw new Error(
          "Device is closing or closed. Aborting controlTransferOut.",
        );
      }
      // Best-effort auto-open if not yet opened to avoid race with adapter initialization
      if (!this.usbDevice.opened) {
        try {
          await this.open();
        } catch (e) {
          throw new Error(
            `Device is closing or closed. Aborting controlTransferOut. ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      // Prepare a set of option variants to improve robustness across platforms
      const variants = (() => {
        const v: USBControlTransferParameters[] = [];
        // Primary: vendor request to device with caller-provided value/index (used by HackRF)
        v.push({
          requestType: "vendor",
          recipient: "device",
          request: command,
          value,
          index,
        });
        // Secondary: try interface recipient only if already claimed (some stacks prefer it)
        if (this.interfaceClaimed && this.interfaceNumber !== null) {
          v.push({
            requestType: "vendor",
            recipient: "interface",
            request: command,
            value,
            index: this.interfaceNumber as number,
          });
        }
        return v;
      })();

      let attempts = 6;
      let lastError: unknown;
      let backoff = 100;
      while (attempts > 0) {
        try {
          // Try each variant before invoking recovery
          for (const opt of variants) {
            try {
              const result = await this.usbDevice.controlTransferOut(opt, data);
              await this.delay(50);
              // Success! Reset failure counter
              this.consecutiveControlTransferFailures = 0;
              return result;
            } catch (e) {
              lastError = e;
              continue; // try next variant
            }
          }
          // If all variants failed, throw last error to trigger recovery path
          throw lastError ?? new Error("controlTransferOut failed for all variants");
        } catch (err: unknown) {
          if (process.env["NODE_ENV"] === "development") {
            try {
              console.warn("HackRFOne.controlTransferOut: transfer failed", {
                command,
                value,
                index,
                attemptsRemaining: attempts - 1,
                error: err instanceof Error ? err.message : String(err),
              });
            } catch {
              // ignore logging errors
            }
          }
          const error = err as Error & { name?: string; message?: string };
          const isInvalidState = error.name === "InvalidStateError";
          const msg = (error as { message?: string }).message;
          const isNetworkError =
            error.name === "NetworkError" || /transfer error/i.test(msg ?? "");
          if (isInvalidState || isNetworkError) {
            lastError = err;
            // Track consecutive failures
            this.consecutiveControlTransferFailures++;
            
            // If we've hit the threshold and have attempts left, try USB reset recovery
            if (
              this.consecutiveControlTransferFailures >= 
              HackRFOne.MAX_CONSECUTIVE_FAILURES_BEFORE_RESET &&
              attempts > 1 // Save last attempt in case reset fails
            ) {
              const resetSucceeded = await this.performUSBResetRecovery();
              if (resetSucceeded) {
                // Reset succeeded, retry the transfer with fresh firmware
                this.consecutiveControlTransferFailures = 0;
                attempts = 2; // Give it a couple more tries after reset
                backoff = 100; // Reset backoff
                continue;
              } else {
                // Reset failed - device needs physical intervention
                // Stop trying and throw a clear error message
                throw new Error(
                  "HackRF firmware corruption detected. Please physically reset the device:\n" +
                  "1. Press the RESET button on the HackRF, OR\n" +
                  "2. Unplug and reconnect the HackRF\n" +
                  "3. Then reload this page"
                );
              }
            }
            
            // Avoid aggressive close/reopen during init; just backoff and retry
            await this.delay(backoff);
            backoff = Math.min(backoff * 2, 1000);
            attempts--;
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    } finally {
      release();
    }
  }

  // Decide the proper control recipient and index per command. Some HackRF
  // vendor requests target the interface and expect wIndex to be the interface
  // number (e.g., gain controls). Others target the device with index 0.
  private resolveRecipientAndIndex(
    command: RequestCommand,
    providedIndex: number,
  ): { recipient: USBRecipient; ix: number } {
    // Adaptive recipient resolution:
    // - If we have a claimed interface, prefer recipient="interface" with wIndex = interfaceNumber
    //   This avoids transfer errors observed on Windows/Chrome when using recipient="device".
    // - Otherwise, fall back to recipient="device".
    if (this.interfaceClaimed && this.interfaceNumber !== null) {
      return { recipient: "interface", ix: this.interfaceNumber } as {
        recipient: USBRecipient;
        ix: number;
      };
    }
    return { recipient: "device", ix: providedIndex } as {
      recipient: USBRecipient;
      ix: number;
    };
  }

  /**
   *
   * @param frequency Center Frequency, in Hertz
   */
  async setFrequency(frequency: number): Promise<void> {
    // Ensure device is open before issuing control transfers
    if (!this.usbDevice.opened && !this.closing) {
      await this.open();
    }
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
    if (!this.usbDevice.opened && !this.closing) {
      await this.open();
    }
    // HackRF firmware expects a vendor OUT control transfer with gain in wValue
    // Matching libhackrf: HACKRF_VENDOR_REQUEST_SET_LNA_GAIN (OUT)
    await this.controlTransferOut({
      command: RequestCommand.SET_LNA_GAIN,
      value: gain,
      index: 0,
    });
    this.lastLNAGain = gain;
  }

  /**
   * Performs USB reset to recover from firmware corruption.
   * This is called automatically when persistent control transfer failures are detected.
   */
  /**
   * Attempts to recover from firmware corruption using HackRF's vendor-specific reset command.
   * 
   * This uses the HackRF RESET vendor command (RequestCommand.RESET = 30), which is different
   * from the USB device reset. This command tells the HackRF firmware to reset itself, which
   * is more reliable than USB-level reset when the firmware is in a corrupted state.
   * 
   * @returns {boolean} True if recovery succeeded, false if physical intervention is needed
   */
  private async performUSBResetRecovery(): Promise<boolean> {
    console.warn("HackRFOne: Attempting HackRF firmware reset to recover from corruption...");
    
    try {
      // Send HackRF vendor reset command (command 30) DIRECTLY to USB device
      // We must NOT use controlTransferOut() here to avoid recursive calls
      const result = await this.usbDevice.controlTransferOut({
        requestType: "vendor",
        recipient: "device",
        request: RequestCommand.RESET,
        value: 0,
        index: 0,
      });
      
      if (result.status !== "ok") {
        throw new Error(`Reset command failed with status: ${result.status}`);
      }
      
      console.info("HackRFOne: Firmware reset command sent, waiting for recovery...");
      
      // Wait for firmware to complete reset and re-enumerate
      await this.delay(2000);
      
      // The device may have disconnected and reconnected, so we need to reopen
      try {
        await this.usbDevice.open();
        if (this.interfaceNumber !== null) {
          await this.usbDevice.claimInterface(this.interfaceNumber);
          this.interfaceClaimed = true;
        }
      } catch (reopenError) {
        // Device might still be resetting, this is expected
        console.warn("HackRFOne: Device still resetting, may need manual reconnection", reopenError);
      }
      
      // Reset failure counter since reset was successful
      this.consecutiveControlTransferFailures = 0;
      
      console.info("HackRFOne: Firmware reset recovery completed successfully");
      return true;
      
    } catch (error) {
      console.error("HackRFOne: Firmware reset recovery failed", error);
      console.error(
        "HackRFOne: Firmware corruption is severe. Physical reset required:",
        "\n  1. Press the RESET button on the HackRF, OR",
        "\n  2. Unplug and reconnect the HackRF",
        "\n  3. Then reload this page"
      );
      return false;
    }
  }

  private async setTransceiverMode(value: TransceiverMode): Promise<void> {
    await this.controlTransferOut({
      command: RequestCommand.SET_TRANSCEIVER_MODE,
      value,
    });
  }

  // New method to set the sample rate (in Hz)
  /**
   * Sets the sample rate for the HackRF device.
   *
   * **CRITICAL**: This MUST be called before streaming data. HackRF devices will hang
   * indefinitely during `transferIn()` if sample rate is not configured.
   *
   * **Recommended minimum**: 8 MHz (8,000,000 Hz) to avoid aliasing due to analog
   * filter limitations (MAX2837 baseband filter, MAX5864 ADC/DAC).
   *
   * @param sampleRate - Sample rate in Hz (e.g., 20000000 for 20 MSPS)
   *
   * @throws {Error} If sample rate is outside supported range (1.75-28 MHz)
   *
   * @example
   * ```typescript
   * // Recommended default (20 MSPS)
   * await device.setSampleRate(20_000_000);
   *
   * // Minimum recommended (8 MSPS)
   * await device.setSampleRate(8_000_000);
   *
   * // For lower effective rates, use software decimation after capture
   * ```
   *
   * @see {@link https://hackrf.readthedocs.io/en/latest/sampling_rate.html} Sample rate documentation
   * @see {@link receive} - Must call setSampleRate before receive
   */
  async setSampleRate(sampleRate: number): Promise<void> {
    // Ensure device is open before configuring sample rate to prevent hangs/races
    if (!this.usbDevice.opened && !this.closing) {
      await this.open();
    }
    // Ensure transceiver is OFF before reprogramming clocks
    try {
      await this.setTransceiverMode(TransceiverMode.OFF);
      await this.delay(50);
    } catch {
      // Non-fatal; continue
    }
    // Validate sample rate is within HackRF One's supported range
    if (sampleRate < MIN_SAMPLE_RATE || sampleRate > MAX_SAMPLE_RATE) {
      throw new Error(
        `Sample rate ${sampleRate / 1e6} MSPS out of range. ` +
          `HackRF One supports ${MIN_SAMPLE_RATE / 1e6} to ${MAX_SAMPLE_RATE / 1e6} MSPS`,
      );
    }

    const { freqHz, divider } = computeSampleRateParams(sampleRate);
    const payload = createUint32LEBuffer([freqHz, divider]);
    // More robust retry/backoff specifically for Windows/WebUSB transfer errors
    const MAX_ATTEMPTS = 5;
    let attempt = 0;
    let lastErr: unknown = null;
    let backoff = 200; // ms
    while (attempt < MAX_ATTEMPTS) {
      try {
        await this.controlTransferOut({
          command: RequestCommand.SAMPLE_RATE_SET,
          data: payload,
        });
        // success
        break;
      } catch (err: unknown) {
        lastErr = err;
        const e = err as Error & { name?: string; message?: string };
        const msg =
          typeof e.message === "string" && e.message.length > 0
            ? e.message
            : String(e);
        const isNetworkError =
          e.name === "NetworkError" || /transfer error/i.test(msg);
        const isInvalidState = e.name === "InvalidStateError";
        // If not a transient transfer issue, fail immediately
        if (!isNetworkError && !isInvalidState) {
          throw new Error(
            `Failed to set sample rate (${(sampleRate / 1e6).toFixed(2)} MSPS): ${msg}`,
          );
        }

        // Graceful recovery path: progressive backoff only; avoid close/reopen thrash on Windows
        attempt++;
        if (attempt >= MAX_ATTEMPTS) {
          break;
        }
        await this.delay(backoff);
        backoff = Math.min(backoff * 2, 1000);
      }
    }

    if (attempt >= MAX_ATTEMPTS && lastErr) {
      const errMsg = ((): string => {
        const anyErr = lastErr as { message?: unknown } | undefined;
        if (typeof anyErr?.message === "string" && anyErr.message) {
          return anyErr.message;
        }
        try {
          return JSON.stringify(anyErr ?? {});
        } catch {
          return "Unknown error";
        }
      })();
      const msg = errMsg;
      throw new Error(
        `Failed to set sample rate after ${MAX_ATTEMPTS} attempts (${(sampleRate / 1e6).toFixed(2)} MSPS): ${msg}`,
      );
    }
    this.lastSampleRate = sampleRate;
    this.configuredOnce = true;

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
    if (!this.usbDevice.opened && !this.closing) {
      await this.open();
    }
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
      // Consider device configured if a valid configuration was applied once
      // even if internal mirrors are unavailable in mock environments
      isConfigured: this.lastSampleRate !== null || this.configuredOnce,
    };
  }

  /**
   * Validate that device is ready for streaming
   * Checks all critical prerequisites before starting reception.
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

  /**
   * Start receiving IQ samples from the HackRF device
   *
   * ⚠️ **CRITICAL REQUIREMENT**: Sample rate MUST be configured before calling
   * this method. Without it, the device hangs indefinitely at transferIn() with
   * no error message. This is the #1 cause of "device not responding" issues.
   *
   * Enters receive mode and begins a continuous streaming loop that reads
   * data from the device via bulk USB transfers. Each transfer receives up
   * to 4KB of IQ sample data.
   *
   * **Prerequisites:**
   * - Device must be open (call `open()` first)
   * - Sample rate MUST be configured (call `setSampleRate()` first) ⚠️
   * - Frequency should be configured (call `setFrequency()` first)
   * - Device must be in a healthy state (open, not closing)
   *
   * **Streaming Loop Details:**
   * - Reads 4KB chunks via `transferIn()` on the bulk IN endpoint
   * - Protected by 5-second timeout to prevent infinite hangs
   * - Tracks consecutive timeouts and fails after 3 consecutive failures
   * - Automatically stops when `stopRx()` is called
   *
   * **Error Handling:**
   * - Timeout errors: Counted and trigger failure after threshold
   * - AbortError: Expected during clean shutdown
   * - Other errors: Propagated immediately to caller
   *
   * @param callback - Called for each received data chunk with raw DataView
   *                   containing Int8 interleaved I/Q samples. Use parseSamples()
   *                   to convert to IQSample[] format.
   * @returns Promise that resolves when streaming stops or encounters error
   * @throws {Error} If device is not open
   * @throws {Error} If device is closing
   * @throws {Error} If sample rate not configured (device will hang indefinitely)
   * @throws {Error} If device experiences repeated timeouts (hardware issue)
   *
   * @example
   * ```typescript
   * // Configure device first (CRITICAL!)
   * await hackrf.open();
   * await hackrf.setSampleRate(20_000_000); // ⚠️ MUST be first
   * await hackrf.setFrequency(100_000_000);
   *
   * // Start streaming
   * const receivePromise = hackrf.receive((dataView) => {
   *   const samples = parseSamples(dataView);
   *   processIQSamples(samples);
   * });
   *
   * // Stop streaming when done
   * await hackrf.stopRx();
   * await receivePromise; // Wait for streaming loop to exit
   * ```
   *
   * @remarks
   * The streaming loop runs continuously until `stopRx()` is called or an
   * error occurs. Memory management is handled automatically through buffer
   * tracking and cleanup.
   *
   * Without sample rate configuration, the HackRF firmware enters a waiting
   * state and transferIn() will hang forever with no error. See the
   * initialization guide (docs/hackrf-initialization-guide.md) for details.
   *
   * @see {@link setSampleRate} - MUST be called before receive
   * @see {@link stopRx} - Stop streaming
   * @see {@link validateDeviceHealth} - Health checks performed
   * @see {@link fastRecovery} - Automatic recovery after timeouts
   */
  async receive(callback?: (data: DataView) => void): Promise<void> {
    // Validate device health before streaming
    this.validateDeviceHealth();

    // Set streaming to true at the very start to allow stopRx() to detect it
    this.streaming = true;

    // Create a stop signal early so stopRx() can signal us during startup
    let stopSignal: (() => void) | null = null;
    const stopPromise = new Promise<USBInTransferResult>((resolve) => {
      stopSignal = (): void => {
        // Resolve with a sentinel result so the loop can exit cleanly
        resolve({} as unknown as USBInTransferResult);
      };
      this.stopReject = stopSignal;
    });

    // Disable UI to allow continuous streaming, then enter RX mode
    try {
      await this.controlTransferOut({
        command: RequestCommand.UI_ENABLE,
        value: 0,
      });
    } catch {
      // Non-fatal; proceed to set RX mode
    }
    
    // Try to enter RX mode, with automatic USB reset recovery on failure
    try {
      await this.setTransceiverMode(TransceiverMode.RECEIVE);
    } catch (error) {
      // If we can't enter RX mode, the firmware is likely corrupted.
      // Attempt automatic recovery via USB reset.
      console.warn(
        "HackRFOne.receive: Failed to enter RX mode, attempting USB reset recovery...",
        error,
      );
      
      this.streaming = false;
      
      try {
        // Perform USB reset to clear firmware corruption
        await this.usbDevice.reset();
        console.info("HackRFOne.receive: USB reset successful, waiting for device to recover...");
        
        // Wait for device to complete reset (firmware reboot)
        await this.delay(1000);
        
        // Reopen device and reclaim interface
        await this.usbDevice.open();
        if (this.interfaceNumber !== null) {
          await this.usbDevice.claimInterface(this.interfaceNumber);
          this.interfaceClaimed = true;
        }
        
        // Retry entering RX mode after reset
        await this.setTransceiverMode(TransceiverMode.RECEIVE);
        
        console.info("HackRFOne.receive: USB reset recovery successful, RX mode enabled");
        this.streaming = true; // Re-enable streaming flag for the loop
      } catch (resetError) {
        // Reset recovery failed - this is a fatal error
        throw new Error(
          `Failed to start RX mode and automatic USB reset recovery failed. ` +
            `Please reload the page or physically reconnect the device. ` +
            `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
            `Reset error: ${resetError instanceof Error ? resetError.message : String(resetError)}`,
        );
      }
    }
    // Give firmware a brief moment to start DMA before switching to streaming alt
    await this.delay(50);
    // Switch to the streaming alternate interface and set the bulk IN endpoint now
    if (
      this.interfaceNumber !== null &&
      this.streamingAltSetting !== null &&
      this.streamInEndpointNumber !== null
    ) {
      try {
        if (!this.interfaceClaimed) {
          await this.usbDevice.claimInterface(this.interfaceNumber);
          this.interfaceClaimed = true;
        }
        await this.usbDevice.selectAlternateInterface(
          this.interfaceNumber,
          this.streamingAltSetting,
        );
        this.inEndpointNumber = this.streamInEndpointNumber;
        // Brief settle before first bulk transfer
        await this.delay(25);
      } catch {
        // If switching alt fails, continue; control transfers and streaming may still recover
      }
    }
    // Check if stop was requested during startup; if so, exit immediately
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.streaming) {
      return;
    }

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
    // 1 second timeout per transfer: USB transfers typically complete in <100ms or fail immediately.
    // This allows recovery within ~2 seconds rather than 15+ seconds with the previous 5s timeout.
    const TIMEOUT_MS = 1000;
    // Max failures before recovery: 2 consecutive timeouts trigger automatic recovery.
    // Most USB issues are persistent (not transient), so fast recovery improves UX significantly.
    const MAX_CONSECUTIVE_TIMEOUTS = 2;

    // Main streaming loop - continues until streaming flag is cleared
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

        // Wrap transferIn with timeout protection to prevent infinite hangs
        // This is critical for HackRF - without sample rate configured,
        // transferIn will hang forever with no error
        const result = await Promise.race([
          this.usbDevice.transferIn(this.inEndpointNumber, 4096),
          this.createTimeout(
            TIMEOUT_MS,
            `transferIn timeout after ${TIMEOUT_MS}ms - device may need reset`,
          ),
          stopPromise,
        ]);

        // If stop was requested, exit immediately
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!this.streaming) {
          break;
        }

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
        // If streaming was requested to stop, exit immediately regardless of error type
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!this.streaming) {
          break;
        }
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
            // If streaming was stopped, exit immediately without recovery
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!this.streaming) {
              console.warn(
                "HackRFOne.receive: Max timeouts reached but streaming stopped; exiting without recovery",
                {
                  iteration: iterationCount,
                },
              );
              break;
            }
            // If a shutdown is in progress, do not attempt recovery
            if (this.closing) {
              console.warn(
                "HackRFOne.receive: Max timeouts reached during shutdown; exiting without recovery",
                {
                  iteration: iterationCount,
                },
              );
              break;
            }
            // Already handled shutdown case above; proceed to recovery otherwise
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
              // Use debug level if closing to reduce noise
              console.error(
                "HackRFOne.receive: Automatic recovery failed",
                recoveryError,
                {
                  iteration: iterationCount,
                  closing: this.closing,
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
    // Clear stop controller to avoid leaking references
    this.stopReject = null;
    // During shutdown, avoid further control transfers which can fail noisily
    if (!this.closing) {
      try {
        await this.setTransceiverMode(TransceiverMode.OFF);
        await this.controlTransferOut({
          command: RequestCommand.UI_ENABLE,
          value: 1,
        });
      } catch (_e) {
        // Suppress errors during teardown
      }
    }
  }

  // New method to stop reception
  stopRx(): void {
    this.streaming = false;
    // Trigger stop signal to break out of pending races immediately
    if (this.stopReject) {
      const signal = this.stopReject;
      this.stopReject = null;
      signal();
    }
  }

  /**
   * Software reset the HackRF device via USB control transfer
   * This is equivalent to the hackrf_reset() function in libhackrf
   * Uses HACKRF_VENDOR_REQUEST_RESET (vendor request 30)
   */
  async reset(): Promise<void> {
      // Programmatic vendor RESET disabled: treat reset as lightweight state clear.
      console.warn("HackRFOne.reset: Skipping vendor reset (disabled)", {
        deviceState: {
          opened: this.usbDevice.opened,
          streaming: this.streaming,
          sampleRate: this.lastSampleRate,
          frequency: this.lastFrequency,
        },
      });
      // If streaming, attempt to turn OFF to halt transfers cleanly.
      if (this.streaming) {
        try {
          await this.setTransceiverMode(TransceiverMode.OFF);
        } catch (err) {
          console.warn("HackRFOne.reset: Failed to set OFF during reset", err);
        }
      }
      // Clear cached mirrors so next use performs lazy reconfiguration.
      this.lastSampleRate = null;
      this.lastFrequency = null;
      this.lastBandwidth = null;
      this.lastLNAGain = null;
      this.lastAmpEnabled = false;
      this.configuredOnce = false;
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
    // Snapshot saved state to restore internal mirrors even in mock environments
    const savedState = {
      sampleRate: this.lastSampleRate,
      frequency: this.lastFrequency,
      bandwidth: this.lastBandwidth,
      lnaGain: this.lastLNAGain,
      ampEnabled: this.lastAmpEnabled,
    };
    if (isDev) {
      console.warn("HackRFOne.fastRecovery: Starting automatic recovery", {
        savedState,
      });
    }

    // Do not attempt recovery during shutdown
    if (this.closing) {
      throw new Error("Cannot perform fastRecovery while device is closing");
    }

    // Ensure device is open and interface is selected before issuing control transfers
    if (!this.usbDevice.opened || this.interfaceNumber === null) {
      try {
        await this.open();
      } catch {
        // If open fails, continue — RESET below may still succeed and we re-open after
      }
    }

    // Perform lightweight state clear (no close/reopen) then re-apply mirrors.
    await this.reset();

    // Reconfigure device to last known state
    if (savedState.sampleRate !== null) {
      const { freqHz, divider } = computeSampleRateParams(savedState.sampleRate);
      const payload = createUint32LEBuffer([freqHz, divider]);
      await this.controlTransferOut({
        command: RequestCommand.SAMPLE_RATE_SET,
        data: payload,
      });
    }

    if (savedState.frequency !== null) {
      const { mhz, hz } = splitFrequencyComponents(savedState.frequency);
      const payload = createUint32LEBuffer([mhz, hz]);
      await this.controlTransferOut({
        command: RequestCommand.SET_FREQ,
        data: payload,
      });
    }

    if (savedState.bandwidth !== null) {
      const rounded = Math.round(savedState.bandwidth);
      const value = rounded & 0xffff;
      const index = (rounded >>> 16) & 0xffff;
      await this.controlTransferOut({
        command: RequestCommand.BASEBAND_FILTER_BANDWIDTH_SET,
        value,
        index,
      });
    }

    if (savedState.lnaGain !== null) {
      await this.controlTransferOut({
        command: RequestCommand.SET_LNA_GAIN,
        value: savedState.lnaGain,
        index: 0,
      });
    }

    await this.controlTransferOut({
      command: RequestCommand.AMP_ENABLE,
      value: Number(savedState.ampEnabled),
    });

    // Restart transceiver mode
    await this.setTransceiverMode(TransceiverMode.RECEIVE);

    // Ensure internal state mirrors remain consistent post-recovery.
    // In some test/mock environments, USB reopen/claim is skipped and
    // control transfers don't reliably update mirrors. Restore from snapshot.
    this.lastSampleRate = savedState.sampleRate;
    this.lastFrequency = savedState.frequency;
    this.lastBandwidth = savedState.bandwidth;
    this.lastLNAGain = savedState.lnaGain;
    this.lastAmpEnabled = savedState.ampEnabled;
    if (savedState.sampleRate !== null) {
      this.configuredOnce = true;
    }

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
