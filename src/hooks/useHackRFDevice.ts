import { useCallback, useEffect, useState } from "react";
import { HackRFOneAdapter } from "../models/HackRFOneAdapter";
import { type ISDRDevice } from "../models/SDRDevice";
import { useUSBDevice } from "./useUSBDevice";

/**
 * React hook for managing HackRF One device lifecycle
 *
 * Provides automatic device initialization, cleanup, and state management
 * for HackRF One SDR devices via WebUSB API. Automatically connects to
 * previously paired devices without requiring user approval.
 *
 * @returns Object containing:
 *   - device: ISDRDevice instance or undefined
 *   - initialize: Function to request device access from user (for first-time pairing)
 *   - cleanup: Function to properly close and cleanup device
 *   - isCheckingPaired: Boolean indicating if checking for paired devices
 *
 * @example
 * ```tsx
 * const { device, initialize, isCheckingPaired } = useHackRFDevice();
 *
 * // Device will automatically connect if previously paired
 * // Otherwise, call initialize() to show device picker
 * if (!device && !isCheckingPaired) {
 *   await initialize();
 * }
 *
 * // Use device for operations
 * if (device) {
 *   await device.setFrequency(100e6);
 *   await device.receive(callback);
 * }
 * ```
 */
export function useHackRFDevice(): {
  device: ISDRDevice | undefined;
  initialize: () => Promise<void>;
  cleanup: () => void;
  isCheckingPaired: boolean;
} {
  const [device, setDevice] = useState<ISDRDevice>();
  const {
    device: usbDevice,
    requestDevice,
    isCheckingPaired,
  } = useUSBDevice([
    {
      // HackRF devices
      vendorId: 0x1d50,
    },
  ]);

  const cleanup = useCallback((): void => {
    device?.close().catch((error: unknown) => {
      console.error(
        "useHackRFDevice: Failed to close device during cleanup",
        error,
      );
    });
  }, [device]);

  useEffect(() => {
    if (!usbDevice) {
      return;
    }
    const hackRF = new HackRFOneAdapter(usbDevice);
    const setup = async (): Promise<void> => {
      try {
        if (!usbDevice.opened) {
          await hackRF.open();
        }
        // Always set the device so upstream can configure and begin streaming
        setDevice(hackRF);
      } catch (err) {
        // Handle race condition: if device is already being opened by another component instance,
        // just use the device once it's opened. This is a workaround until we implement
        // a shared device context at the App level (see ADR-0018 for proper state management).
        if (
          err instanceof DOMException &&
          err.name === "InvalidStateError" &&
          err.message.includes("operation that changes the device state")
        ) {
          console.warn(
            "useHackRFDevice: Device is being opened by another component, waiting for it to complete",
            {
              productId: usbDevice.productId,
              vendorId: usbDevice.vendorId,
            },
          );
          // Set device anyway - it will be usable once the other open() completes
          setDevice(hackRF);
        } else {
          console.error(
            "useHackRFDevice: Failed to initialize HackRF adapter",
            err,
            {
              wasOpened: usbDevice.opened,
              productId: usbDevice.productId,
              vendorId: usbDevice.vendorId,
            },
          );
        }
      }
    };
    void setup();
  }, [usbDevice]);
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    device,
    initialize: requestDevice,
    cleanup,
    isCheckingPaired,
  };
}
