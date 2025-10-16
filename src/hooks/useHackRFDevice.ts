import { useCallback, useEffect, useState } from "react";
import { useUSBDevice } from "./useUSBDevice";
import { HackRFOne } from "../models/HackRFOne";

/**
 * React hook for managing HackRF One device lifecycle
 *
 * Provides automatic device initialization, cleanup, and state management
 * for HackRF One SDR devices via WebUSB API.
 *
 * @returns Object containing:
 *   - device: HackRFOne instance or undefined
 *   - initialize: Function to request device access from user
 *   - cleanup: Function to properly close and cleanup device
 *
 * @example
 * ```tsx
 * const { device, initialize } = useHackRFDevice();
 *
 * // Request device access
 * await initialize();
 *
 * // Use device for operations
 * if (device) {
 *   await device.setFrequency(100e6);
 *   await device.receive(callback);
 * }
 * ```
 */
export function useHackRFDevice(): {
  device: HackRFOne | undefined;
  initialize: () => Promise<void>;
  cleanup: () => void;
} {
  const [device, setDevice] = useState<HackRFOne>();
  const { device: usbDevice, requestDevice } = useUSBDevice([
    {
      // HackRF devices
      vendorId: 0x1d50,
    },
  ]);

  const cleanup = useCallback((): void => {
    device?.close().catch(console.error);
  }, [device]);

  useEffect(() => {
    if (!usbDevice) {
      return;
    }
    if (!usbDevice.opened) {
      const hackRF = new HackRFOne(usbDevice);
      hackRF.open().then(() => setDevice(hackRF));
    }
  }, [usbDevice]);
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    device,
    initialize: requestDevice,
    cleanup,
  };
}
