import { useCallback, useEffect, useState } from "react";
import { SDRDriverRegistry, registerBuiltinDrivers } from "../../drivers";
import { useUSBDevice } from "../../hooks/useUSBDevice";
import { type ISDRDevice } from "../../models/SDRDevice";

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
  const [driversRegistered, setDriversRegistered] = useState(false);
  
  // Register drivers on hook mount
  useEffect(() => {
    registerBuiltinDrivers();
    setDriversRegistered(true);
  }, []);

  // Get HackRF-specific USB filter from registry
  // Only access after drivers are registered to ensure metadata is available
  const hackrfMetadata = driversRegistered
    ? SDRDriverRegistry.getDriverMetadata("hackrf-one")
    : undefined;

  if (driversRegistered && !hackrfMetadata) {
    throw new Error(
      "HackRF One driver failed to register. This may indicate a registration error in registerBuiltinDrivers().",
    );
  }

  const filters = hackrfMetadata?.usbFilters ?? [];

  const {
    device: usbDevice,
    requestDevice,
    isCheckingPaired,
  } = useUSBDevice(filters);

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
    
    const setup = async (): Promise<void> => {
      try {
        // Use driver registry to create the appropriate device
        const sdrDevice = await SDRDriverRegistry.createDevice(usbDevice);
        
        if (!usbDevice.opened) {
          await sdrDevice.open();
        }
        // Always set the device so upstream can configure and begin streaming
        setDevice(sdrDevice);
      } catch (err) {
        // TODO(rad.io#123): This is a workaround for a race condition where multiple components
        // may try to open the device simultaneously. Once ADR-0018 (shared device context at the
        // App level) is fully implemented, remove this workaround and use the shared context.
        // See ADR-0018 for details.
        // Handle race condition: if device is already being opened by another component instance,
        // just use the device once it's opened.
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
          // Try to create device anyway - it will be usable once the other open() completes
          SDRDriverRegistry.createDevice(usbDevice)
            .then(setDevice)
            .catch((error: unknown) => {
              console.error(
                "useHackRFDevice: Failed to create device in fallback path:",
                error,
                {
                  wasOpened: usbDevice.opened,
                  productId: usbDevice.productId,
                  vendorId: usbDevice.vendorId,
                },
              );
            });
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
