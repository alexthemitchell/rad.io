import { useState, useEffect } from "react";

/**
 * React hook for managing WebUSB device access
 *
 * Automatically attempts to connect to previously paired devices without
 * requiring user approval. Falls back to requesting device access if no
 * paired device is found.
 *
 * @param filters - USB device filters to match against
 * @returns Object containing:
 *   - device: Connected USBDevice or undefined
 *   - requestDevice: Function to manually request device access
 *   - isCheckingPaired: Whether the hook is checking for paired devices
 *
 * @example
 * ```tsx
 * const { device, requestDevice, isCheckingPaired } = useUSBDevice([
 *   { vendorId: 0x1d50 }
 * ]);
 *
 * // Device will automatically connect if previously paired
 * // Otherwise, call requestDevice() to show device picker
 * ```
 */
export const useUSBDevice = (
  filters: USBDeviceFilter[],
): {
  device: USBDevice | undefined;
  requestDevice: () => Promise<void>;
  isCheckingPaired: boolean;
} => {
  const [device, setDevice] = useState<USBDevice>();
  const [isCheckingPaired, setIsCheckingPaired] = useState<boolean>(true);

  /**
   * Manually request device access with user gesture
   * Required for first-time device pairing
   */
  const requestDevice = async (): Promise<void> => {
    const device = await navigator.usb.requestDevice({
      filters,
    });
    setDevice(device);
  };

  /**
   * Check for previously paired devices that match filters
   */
  const checkPairedDevices = async (): Promise<void> => {
    try {
      const devices = await navigator.usb.getDevices();

      // Collect all devices matching our filters
      const matchedDevices = devices.filter((dev) =>
        filters.some((filter) => {
          const vendorMatch =
            !filter.vendorId || dev.vendorId === filter.vendorId;
          const productMatch =
            !filter.productId || dev.productId === filter.productId;
          const classMatch =
            !filter.classCode || dev.deviceClass === filter.classCode;
          return vendorMatch && productMatch && classMatch;
        }),
      );

      // If exactly one matched device, auto-select it for seamless reconnect
      // If multiple matched devices are present, defer selection to the UI
      if (matchedDevices.length === 1) {
        setDevice(matchedDevices[0]);
      }
    } catch (error) {
      console.error("Error checking for paired devices:", error);
    } finally {
      setIsCheckingPaired(false);
    }
  };

  /**
   * Listen for USB device connect/disconnect events
   */
  useEffect(() => {
    // Check for paired devices on mount
    void checkPairedDevices();

    const handleConnect = (event: USBConnectionEvent): void => {
      const connectedDevice = event.device;

      // Check if this device matches our filters
      const matches = filters.some((filter) => {
        const vendorMatch =
          !filter.vendorId || connectedDevice.vendorId === filter.vendorId;
        const productMatch =
          !filter.productId || connectedDevice.productId === filter.productId;
        const classMatch =
          !filter.classCode || connectedDevice.deviceClass === filter.classCode;
        return vendorMatch && productMatch && classMatch;
      });

      if (matches) {
        setDevice(connectedDevice);
      }
    };

    const handleDisconnect = (event: USBConnectionEvent): void => {
      if (device && event.device === device) {
        setDevice(undefined);
      }
    };

    navigator.usb.addEventListener("connect", handleConnect);
    navigator.usb.addEventListener("disconnect", handleDisconnect);

    return (): void => {
      navigator.usb.removeEventListener("connect", handleConnect);
      navigator.usb.removeEventListener("disconnect", handleDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, device]);

  return {
    requestDevice,
    device,
    isCheckingPaired,
  };
};
