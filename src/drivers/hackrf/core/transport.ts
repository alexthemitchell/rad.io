import { VendorRequest } from "../constants";
import { runWithRetry, isTransientError } from "../usbRetry";
import {
  DeviceState,
  type DeviceStateProvider,
  type ControlTransferOutProps,
} from "./types";

export class Transport {
  public usbDevice: USBDevice;
  public interfaceNumber: number | null = null;
  public inEndpointNumber = 1;
  public streamingAltSetting: number | null = null;
  public streamInEndpointNumber: number | null = null;
  public interfaceClaimed = false;

  private stateProvider: DeviceStateProvider;

  public consecutiveControlTransferFailures = 0;
  private static readonly MAX_CONSECUTIVE_FAILURES_BEFORE_RESET = 3;

  constructor(usbDevice: USBDevice, stateProvider: DeviceStateProvider) {
    this.usbDevice = usbDevice;
    this.stateProvider = stateProvider;
  }

  get closing(): boolean {
    return this.stateProvider.state === DeviceState.CLOSING;
  }

  set closing(value: boolean) {
    if (value) {
      this.stateProvider.state = DeviceState.CLOSING;
    } else if (this.stateProvider.state === DeviceState.CLOSING) {
      this.stateProvider.state = DeviceState.IDLE;
    }
  }

  public delay = async (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  public async rebindUSBDevice(): Promise<boolean> {
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

  async open(wasCleanClosed: boolean): Promise<void> {
    this.closing = false;

    if (this.usbDevice.opened && this.interfaceNumber !== null) {
      return;
    }

    const needsRecovery = !wasCleanClosed;

    const ensureOpen = async (): Promise<void> => {
      if (!this.usbDevice.opened) {
        await runWithRetry(
          async () => {
            await this.usbDevice.open();
          },
          {
            attempts: 2,
            classify: (err) => {
              const e = err as Error & { name?: string; message?: string };
              const msg = typeof e.message === "string" ? e.message : "";
              return (
                e.name === "NotFoundError" ||
                /disconnected|No device selected/i.test(msg)
              );
            },
            onRetry: async () => {
              const rebound = await this.rebindUSBDevice();
              if (!rebound) {
                throw new Error("Device disconnected and rebind failed");
              }
            },
          },
        );
      }
    };

    if (needsRecovery) {
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
      this.interfaceNumber = null;
      this.inEndpointNumber = 1;
      await this.delay(300);
    }

    try {
      await ensureOpen();
    } catch (err) {
      if (needsRecovery || this.consecutiveControlTransferFailures > 3) {
        console.warn(
          "Transport.open: gentle recovery failed, attempting USB reset",
          {
            needsRecovery,
            consecutiveFailures: this.consecutiveControlTransferFailures,
            error: err instanceof Error ? err.message : String(err),
          },
        );
        try {
          if (!this.usbDevice.opened) {
            await this.usbDevice.open();
          }
          await this.usbDevice.reset();
          await this.delay(500);
          await this.usbDevice.open();
          this.consecutiveControlTransferFailures = 0;
        } catch (resetErr) {
          console.warn(
            "Transport.open: USB reset failed, proceeding anyway",
            resetErr,
          );
        }
      } else {
        throw err;
      }
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
    let currentInterfaceNumber = selectedInterface.interfaceNumber;
    let currentAlternate = selectedAlternate;

    try {
      await runWithRetry(
        async () => {
          this.interfaceNumber = currentInterfaceNumber;
          await this.usbDevice.claimInterface(this.interfaceNumber);
          this.interfaceClaimed = true;
          await this.usbDevice.selectAlternateInterface(
            this.interfaceNumber,
            currentAlternate.alternateSetting,
          );
        },
        {
          attempts: 2,
          classify: () => true,
          onRetry: async (_attempt, err) => {
            console.warn(
              `Transport.open: claimInterface failed, attempting USB reset + retry`,
              err,
            );
            try {
              if (!this.usbDevice.opened) {
                await this.usbDevice.open();
              }
            } catch {}
            try {
              await this.usbDevice.reset();
            } catch {}
            await this.delay(500);
            try {
              if (!this.usbDevice.opened) {
                await this.usbDevice.open();
              }
            } catch {}

            if (!this.usbDevice.configuration) {
              const cfgVal =
                this.usbDevice.configurations[0]?.configurationValue ?? 1;
              await this.usbDevice.selectConfiguration(cfgVal);
            }
            const cfg = this.usbDevice.configuration;
            if (!cfg || cfg.interfaces.length === 0) {
              throw new Error(
                "No interface found on USB device configuration (post-reset)",
              );
            }
            let retryInterface: USBInterface | undefined;
            let retryAlternate: USBAlternateInterface | undefined;
            for (const iface of cfg.interfaces) {
              for (const alt of iface.alternates) {
                const hasBulkIn = alt.endpoints.some(
                  (ep) => ep.type === "bulk" && ep.direction === "in",
                );
                if (hasBulkIn) {
                  retryInterface = iface;
                  retryAlternate = alt;
                  break;
                }
              }
              if (retryInterface && retryAlternate) break;
            }
            if (!retryInterface || !retryAlternate) {
              throw new Error(
                "No suitable streaming interface found on HackRF device (post-reset)",
              );
            }

            currentInterfaceNumber = retryInterface.interfaceNumber;
            currentAlternate = retryAlternate;

            const retryInEndpoint = retryAlternate.endpoints.find(
              (ep) => ep.type === "bulk" && ep.direction === "in",
            );
            if (retryInEndpoint) {
              this.streamingAltSetting = retryAlternate.alternateSetting;
              this.streamInEndpointNumber = retryInEndpoint.endpointNumber;
            }
          },
        },
      );
    } catch (err) {
      throw new Error(
        `Failed to claim HackRF interface ${this.interfaceNumber}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (this.streamingAltSetting === null) {
      this.streamingAltSetting = selectedAlternate.alternateSetting;
      this.streamInEndpointNumber = inEndpoint.endpointNumber;
    }

    await this.delay(300);
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }
    this.closing = true;
    try {
      if (this.usbDevice.opened && this.interfaceNumber !== null) {
        try {
          await this.usbDevice.releaseInterface(this.interfaceNumber);
        } catch {
          // ignore
        }
      }

      if (this.usbDevice.opened) {
        try {
          await this.usbDevice.close();
        } catch {
          // ignore
        }
      }
    } finally {
      this.interfaceNumber = null;
      this.interfaceClaimed = false;
      this.closing = false;
    }
  }

  async controlTransferOut(
    { command, value = 0, data, index = 0 }: ControlTransferOutProps,
    options: {
      isSetFreq?: boolean;
      isSampleRate?: boolean;
      wasStreaming?: boolean;
      onFailure?: (err: unknown) => void;
      performReset?: () => Promise<boolean>;
    } = {},
  ): Promise<void> {
    try {
      if (this.closing) {
        throw new Error(
          "Device is closing or closed. Aborting controlTransferOut.",
        );
      }
      if (!this.usbDevice.opened) {
        try {
          await this.usbDevice.open();
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          throw new Error(
            `Device is closing or closed. Aborting controlTransferOut. ${message}`,
          );
        }
      }

      const buildVariants = (): USBControlTransferParameters[] => {
        const v: USBControlTransferParameters[] = [];
        v.push({
          requestType: "vendor",
          recipient: "device",
          request: command,
          value,
          index,
        });
        if (this.interfaceClaimed && this.interfaceNumber !== null) {
          v.push({
            requestType: "vendor",
            recipient: "interface",
            request: command,
            value,
            index: this.interfaceNumber,
          });
        }
        return v;
      };

      const isSetFreq = options.isSetFreq ?? command === VendorRequest.SET_FREQ;
      const isSampleRate =
        options.isSampleRate ?? command === VendorRequest.SAMPLE_RATE_SET;

      const maxAttempts = isSetFreq ? 12 : 6;
      const baseDelay = isSetFreq ? 150 : 100;

      await runWithRetry(
        async () => {
          if (isSetFreq) {
            await this.delay(15);
          }
          const variants = buildVariants();
          let lastTransferError: unknown = null;

          for (const params of variants) {
            try {
              const result = await this.usbDevice.controlTransferOut(
                params,
                data,
              );
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (result?.status === undefined || result.status === "ok") {
                this.consecutiveControlTransferFailures = 0;
                return;
              }

              lastTransferError = new Error(
                `controlTransferOut failed with status ${result.status} (command=${command}, value=${value}, index=${params.index})`,
              );
            } catch (err) {
              lastTransferError = err;
            }
          }

          if (lastTransferError) {
            throw lastTransferError instanceof Error
              ? lastTransferError
              : new Error(String(lastTransferError)); // eslint-disable-line @typescript-eslint/no-base-to-string
          }
        },
        {
          attempts: maxAttempts,
          baseDelay,
          classify: isTransientError,
          onRetry: async (_attempt, err) => {
            if (options.onFailure) {
              options.onFailure(err);
            }

            this.consecutiveControlTransferFailures++;

            if (
              this.consecutiveControlTransferFailures >=
                Transport.MAX_CONSECUTIVE_FAILURES_BEFORE_RESET &&
              (options.wasStreaming || isSetFreq || isSampleRate)
            ) {
              if (options.performReset) {
                const resetSucceeded = await options.performReset();
                if (resetSucceeded) {
                  this.consecutiveControlTransferFailures = 0;
                  return;
                }
              }

              throw new Error(
                "HackRF firmware corruption detected. Please use the HackRF driver reset method (not the WebUSB reset).",
              );
            }
          },
        },
      );
    } finally {
      // No-op
    }
  }
}
