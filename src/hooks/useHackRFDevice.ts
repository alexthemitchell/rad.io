import { useCallback, useEffect, useState } from "react";
import { useUSBDevice } from "./useUSBDevice";
import { HackRFOneAdapter } from "../models/HackRFOneAdapter";
import { ISDRDevice } from "../models/SDRDevice";

/**
 * React hook for managing HackRF One device lifecycle
 *
 * Provides automatic device initialization, cleanup, and state management
 * for HackRF One SDR devices via WebUSB API.
 *
 * @returns Object containing:
 *   - device: ISDRDevice instance or undefined
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
  device: ISDRDevice | undefined;
  initialize: () => Promise<void>;
  cleanup: () => void;
} {
  const [device, setDevice] = useState<ISDRDevice>();
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
      const hackRF = new HackRFOneAdapter(usbDevice);
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
