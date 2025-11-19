import { TransceiverMode, VendorRequest } from "../constants";
import { type Config } from "./config";
import { type MemoryManager } from "./memory";
import { type Recovery } from "./recovery";
import { StreamController } from "./StreamController";
import { type Transport } from "./transport";
import {
  DeviceState,
  type DeviceStateProvider,
  type HackRFStreamValidation,
} from "./types";

export class Stream {
  private transport: Transport;
  private config: Config;
  private memory: MemoryManager;
  private recovery: Recovery;
  private streamController = new StreamController();
  private stateProvider: DeviceStateProvider;

  constructor(
    transport: Transport,
    config: Config,
    memory: MemoryManager,
    recovery: Recovery,
    stateProvider: DeviceStateProvider,
  ) {
    this.transport = transport;
    this.config = config;
    this.memory = memory;
    this.recovery = recovery;
    this.stateProvider = stateProvider;
  }

  get streaming(): boolean {
    return this.stateProvider.state === DeviceState.STREAMING;
  }

  set streaming(value: boolean) {
    if (value) {
      this.stateProvider.state = DeviceState.STREAMING;
    } else if (this.stateProvider.state === DeviceState.STREAMING) {
      this.stateProvider.state = DeviceState.IDLE;
    }
  }

  private async createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  validateDeviceHealth(): void {
    if (!this.transport.usbDevice.opened) {
      throw new Error("Device is not open");
    }
    if (this.transport.closing) {
      throw new Error("Device is closing");
    }
    if (this.config.lastSampleRate === null || !this.config.configuredOnce) {
      throw new Error(
        "Sample rate not configured. HackRF requires setSampleRate() to be called before receive(). " +
          "Without sample rate, the device will not stream data and transferIn() will hang.",
      );
    }
  }

  validateReadyForStreaming(): HackRFStreamValidation {
    const issues: string[] = [];

    if (!this.transport.usbDevice.opened) {
      issues.push("Device is not open");
    }

    if (this.transport.closing) {
      issues.push("Device is closing");
    }

    if (this.config.lastSampleRate === null || !this.config.configuredOnce) {
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

  async stopRx(): Promise<void> {
    this.streaming = false;
    this.streamController.stop();
    await Promise.resolve();
  }

  async receive(callback?: (data: DataView) => void): Promise<void> {
    this.validateDeviceHealth();

    this.streaming = true;
    const signal = this.streamController.start();

    try {
      await this.transport.controlTransferOut({
        command: VendorRequest.UI_ENABLE,
        value: 0,
      });
    } catch {
      // Non-fatal
    }

    try {
      await this.config.setTransceiverMode(TransceiverMode.RECEIVE);
    } catch (error) {
      try {
        this.streaming = false;
        await this.transport.usbDevice.reset();
        await this.transport.delay(1000);
        await this.transport.open(true);
        await this.config.setTransceiverMode(TransceiverMode.RECEIVE);
        this.streaming = true;
      } catch (resetError) {
        this.streamController.stop();
        throw new Error(
          `Failed to start RX mode and automatic USB reset recovery failed. ` +
            `Please reload the page or physically reconnect the device. ` +
            `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
            `Reset error: ${resetError instanceof Error ? resetError.message : String(resetError)}`,
        );
      }
    }

    await this.transport.delay(50);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (signal.aborted || !this.streaming) {
      this.streamController.stop();
      this.streaming = false;
      return;
    }

    let iterationCount = 0;
    const TIMEOUT_MS = 1000;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (!signal.aborted && this.streaming) {
      try {
        iterationCount++;

        const transferPromise = this.transport.usbDevice.transferIn(
          this.transport.inEndpointNumber,
          4096,
        );

        const abortPromise = new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new Error("AbortError"));
          } else {
            signal.addEventListener(
              "abort",
              () => reject(new Error("AbortError")),
              {
                once: true,
              },
            );
          }
        });

        const result = await Promise.race([
          transferPromise,
          this.createTimeout(
            TIMEOUT_MS,
            `transferIn timeout after ${TIMEOUT_MS}ms - device may need reset`,
          ),
          abortPromise,
        ]);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (signal.aborted || !this.streaming) {
          break;
        }

        this.streamController.resetTimeouts();

        if (result.data) {
          this.memory.trackBuffer(result.data);
          if (callback) {
            callback(result.data);
          }
        }
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (signal.aborted || !this.streaming) {
          break;
        }

        const error = err as Error & { name?: string };
        if (error.name === "AbortError" || error.message === "AbortError") {
          break;
        } else if (error.message.includes("timeout")) {
          const maxReached = this.streamController.handleTimeout();
          console.warn("Stream.receive: USB transfer timeout", {
            consecutiveCount: this.streamController.getConsecutiveTimeouts(),
            iteration: iterationCount,
            willRetry: !maxReached,
          });

          if (maxReached) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (signal.aborted || !this.streaming) {
              break;
            }
            if (this.transport.closing) {
              break;
            }

            try {
              console.warn(
                "Stream.receive: Max timeouts reached, initiating automatic recovery",
              );
              this.stateProvider.state = DeviceState.RECOVERING;
              await this.recovery.fastRecovery();
              this.stateProvider.state = DeviceState.STREAMING;
              console.warn(
                "Stream.receive: Automatic recovery successful, resuming stream",
              );
              this.streamController.resetTimeouts();
              continue;
            } catch (recoveryError) {
              this.recovery.trackError(recoveryError, {
                operation: "fastRecovery",
                iteration: iterationCount,
                sampleRate: this.config.lastSampleRate,
                frequency: this.config.lastFrequency,
              });

              console.error(
                "Stream.receive: Automatic recovery failed",
                recoveryError,
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
        } else {
          this.recovery.trackError(err, {
            operation: "receive_loop",
            iteration: iterationCount,
            streaming: this.streaming,
            opened: this.transport.usbDevice.opened,
          });

          console.error(
            "Stream.receive: Unexpected error during USB transfer",
            err,
          );
          throw err;
        }
      }
    }

    this.streamController.stop();
    if (!this.transport.closing) {
      try {
        await this.config.setTransceiverMode(TransceiverMode.OFF);
        await this.transport.controlTransferOut({
          command: VendorRequest.UI_ENABLE,
          value: 1,
        });
      } catch (_e) {
        // ignore
      }
    }
  }
}
