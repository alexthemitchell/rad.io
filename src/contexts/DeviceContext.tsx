/**
 * DeviceContext - Shared SDR device state management
 *
 * Provides a centralized context for managing SDR device instances across the application.
 * This solves the race condition where multiple components tried to open the same USB device
 * simultaneously by maintaining a single source of truth for device state.
 *
 * Design considerations:
 * - Supports multiple devices (keyed by unique identifier) for future extensibility
 * - Maintains device lifecycle (initialization, configuration, cleanup)
 * - Provides device state to all components via React Context
 * - Handles USB device discovery and pairing
 *
 * @see ADR-0018 for page architecture and state management patterns
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useUSBDevice } from "../hooks/useUSBDevice";
import { HackRFOneAdapter } from "../models/HackRFOneAdapter";
import type { ISDRDevice } from "../models/SDRDevice";

/**
 * Unique identifier for a device (vendorId:productId:serialNumber)
 */
type DeviceId = string;

/**
 * Device entry in the context
 */
interface DeviceEntry {
  device: ISDRDevice;
  usbDevice: USBDevice;
}

/**
 * Context value shape
 */
interface DeviceContextValue {
  /**
   * Map of device instances keyed by device ID
   */
  devices: Map<DeviceId, DeviceEntry>;

  /**
   * Primary device (first connected device, for convenience)
   */
  primaryDevice: ISDRDevice | undefined;

  /**
   * Whether we're currently checking for paired devices
   */
  isCheckingPaired: boolean;

  /**
   * Request connection to a new USB device
   */
  requestDevice: () => Promise<void>;

  /**
   * Close and remove a device by ID
   */
  closeDevice: (deviceId: DeviceId) => Promise<void>;

  /**
   * Close all devices
   */
  closeAllDevices: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextValue | undefined>(undefined);

/**
 * Generate unique identifier for a USB device
 */
function getDeviceId(usbDevice: USBDevice): DeviceId {
  // Use vendorId:productId:serialNumber as unique key
  // If no serial number, use empty string (may not be truly unique in multi-device scenarios)
  return `${usbDevice.vendorId}:${usbDevice.productId}:${usbDevice.serialNumber ?? ""}`;
}

/**
 * Provider component that manages device state
 */
export function DeviceProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [devices, setDevices] = useState<Map<DeviceId, DeviceEntry>>(new Map());

  // Use the existing useUSBDevice hook for device discovery
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

  /**
   * Initialize a USB device when it's connected
   */
  const initializeDevice = useCallback(
    async (usb: USBDevice): Promise<void> => {
      const deviceId = getDeviceId(usb);

      try {
        // Create adapter based on device type (currently only HackRF)
        const adapter = new HackRFOneAdapter(usb);

        // Open device if not already opened
        if (!usb.opened) {
          await adapter.open();
        }

        // Add to devices map (functional update checks for duplicates)
        setDevices((prev) => {
          // Skip if already initialized
          if (prev.has(deviceId)) {
            console.debug("DeviceContext: Device already initialized", {
              deviceId,
            });
            return prev;
          }

          const next = new Map(prev);
          next.set(deviceId, { device: adapter, usbDevice: usb });
          return next;
        });

        console.debug("DeviceContext: Device initialized", {
          deviceId,
          deviceInfo: await adapter.getDeviceInfo(),
        });
      } catch (err) {
        console.error("DeviceContext: Failed to initialize device", err, {
          deviceId,
          productId: usb.productId,
          vendorId: usb.vendorId,
          wasOpened: usb.opened,
        });
        throw err;
      }
    },
    [], // Remove devices dependency to prevent infinite loops
  );

  /**
   * Close and remove a device
   */
  const closeDevice = useCallback(
    async (deviceId: DeviceId): Promise<void> => {
      // Use functional state update to get entry without depending on devices
      let entry: DeviceEntry | undefined;
      setDevices((prev) => {
        entry = prev.get(deviceId);
        return prev; // Return unchanged, we'll update below after async work
      });

      if (!entry) {
        console.warn("DeviceContext: Attempted to close unknown device", {
          deviceId,
        });
        return;
      }

      try {
        await entry.device.close();
        setDevices((prev) => {
          const next = new Map(prev);
          next.delete(deviceId);
          return next;
        });
        console.debug("DeviceContext: Device closed", { deviceId });
      } catch (err) {
        console.error("DeviceContext: Failed to close device", err, {
          deviceId,
        });
        throw err;
      }
    },
    [], // Remove devices dependency
  );

  /**
   * Close all devices
   */
  const closeAllDevices = useCallback(async (): Promise<void> => {
    // Capture current devices and clear immediately to prevent concurrent closes
    const devicesToClose: Array<[DeviceId, DeviceEntry]> = [];

    setDevices((prev) => {
      devicesToClose.push(...prev.entries());
      return new Map(); // Clear devices immediately
    });

    if (devicesToClose.length === 0) {
      return;
    }

    const closePromises = devicesToClose.map(async ([deviceId, entry]) => {
      try {
        await entry.device.close();
      } catch (err) {
        console.error(
          "DeviceContext: Failed to close device during cleanup",
          err,
          { deviceId },
        );
      }
    });

    await Promise.allSettled(closePromises);
    console.debug("DeviceContext: All devices closed");
  }, []); // Remove devices dependency

  /**
   * Initialize USB device when it becomes available
   */
  useEffect(() => {
    if (!usbDevice) {
      return;
    }

    void initializeDevice(usbDevice);
  }, [usbDevice, initializeDevice]);

  /**
   * Cleanup all devices on unmount only
   */
  useEffect(() => {
    return (): void => {
      void closeAllDevices();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount/unmount

  // Get primary device (first in map, or undefined if none)
  const primaryDevice =
    devices.size > 0 ? devices.values().next().value?.device : undefined;

  const contextValue: DeviceContextValue = {
    devices,
    primaryDevice,
    isCheckingPaired,
    requestDevice,
    closeDevice,
    closeAllDevices,
  };

  return (
    <DeviceContext.Provider value={contextValue}>
      {children}
    </DeviceContext.Provider>
  );
}

/**
 * Hook to access device context
 *
 * @throws Error if used outside DeviceProvider
 */
export function useDeviceContext(): DeviceContextValue {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDeviceContext must be used within DeviceProvider");
  }
  return context;
}

/**
 * Convenience hook to get the primary device
 *
 * This is a drop-in replacement for useHackRFDevice() for components
 * that only need to work with a single device.
 */
export function useDevice(): {
  device: ISDRDevice | undefined;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
  isCheckingPaired: boolean;
} {
  const { primaryDevice, requestDevice, closeAllDevices, isCheckingPaired } =
    useDeviceContext();

  return {
    device: primaryDevice,
    initialize: requestDevice,
    cleanup: closeAllDevices,
    isCheckingPaired,
  };
}
