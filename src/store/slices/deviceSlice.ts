/**
 * Device Slice
 *
 * Manages SDR device state and connections.
 * Migrated from DeviceContext.tsx to use Zustand.
 *
 * Note: This slice manages device state, but device initialization logic
 * that depends on React hooks (like useUSBDevice) is handled in a separate
 * integration layer in App.tsx or similar.
 */

import { type StateCreator } from "zustand";
import { deviceLogger } from "../../utils/logger";
import type { ISDRDevice } from "../../models/SDRDevice";

/**
 * Unique identifier for a device (vendorId:productId:serialNumber)
 */
export type DeviceId = string;

/**
 * Device entry in the store
 */
export interface DeviceEntry {
  device: ISDRDevice;
  usbDevice?: USBDevice;
}

/**
 * Generate unique identifier for a USB device
 */
export function getDeviceId(usbDevice: USBDevice): DeviceId {
  // Use vendorId:productId:serialNumber as unique key
  // If no serial number, use empty string (may not be truly unique in multi-device scenarios)
  return `${usbDevice.vendorId}:${usbDevice.productId}:${usbDevice.serialNumber ?? ""}`;
}

export interface DeviceSlice {
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
   * Function to trigger device request (will be set by integration layer)
   */
  requestDevice: () => Promise<void>;

  /**
   * Add a device to the store
   */
  addDevice: (deviceId: DeviceId, entry: DeviceEntry) => void;

  /**
   * Remove a device from the store
   */
  removeDevice: (deviceId: DeviceId) => void;

  /**
   * Close and remove a device by ID
   */
  closeDevice: (deviceId: DeviceId) => Promise<void>;

  /**
   * Close all devices
   */
  closeAllDevices: () => Promise<void>;

  /**
   * Set whether we're checking for paired devices
   */
  setIsCheckingPaired: (checking: boolean) => void;

  /**
   * Connect to a previously paired USB device without opening the native picker
   */
  connectPairedUSBDevice: (usbDevice: USBDevice) => Promise<void>;

  /**
   * Set the requestDevice function (called by integration layer)
   */
  setRequestDevice: (fn: () => Promise<void>) => void;

  /**
   * Set the connectPairedUSBDevice function (called by integration layer)
   */
  setConnectPairedUSBDevice: (
    fn: (usbDevice: USBDevice) => Promise<void>,
  ) => void;
}

export const deviceSlice: StateCreator<DeviceSlice> = (set, get) => ({
  devices: new Map(),
  primaryDevice: undefined,
  isCheckingPaired: true,

  // These will be set by the integration layer
  // eslint-disable-next-line @typescript-eslint/require-await
  requestDevice: async (): Promise<void> => {
    deviceLogger.warn("requestDevice called before initialization");
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  connectPairedUSBDevice: async (): Promise<void> => {
    deviceLogger.warn("connectPairedUSBDevice called before initialization");
  },

  addDevice: (deviceId: DeviceId, entry: DeviceEntry): void => {
    set((state) => {
      // Skip if already initialized
      if (state.devices.has(deviceId)) {
        deviceLogger.debug("Device already initialized", { deviceId });
        return state;
      }

      const newDevices = new Map(state.devices);
      newDevices.set(deviceId, entry);

      // Update primary device if this is the first device
      const primaryDevice =
        newDevices.size === 1 ? entry.device : state.primaryDevice;

      deviceLogger.info("Device added to store", { deviceId });

      // Persist last-used device for future preference
      try {
        window.localStorage.setItem("rad.io:lastDeviceId", deviceId);
      } catch {
        // ignore storage failures (private mode, etc.)
      }

      return {
        devices: newDevices,
        primaryDevice,
      };
    });
  },

  removeDevice: (deviceId: DeviceId): void => {
    set((state) => {
      const newDevices = new Map(state.devices);
      const removed = newDevices.delete(deviceId);

      if (!removed) {
        return state;
      }

      // Update primary device if needed.
      // Prefer the last-used device (from localStorage) if present; otherwise, pick the first device.
      let primaryDevice: ISDRDevice | undefined;
      if (newDevices.size > 0) {
        let lastDeviceId: DeviceId | null = null;
        try {
          lastDeviceId = window.localStorage.getItem("rad.io:lastDeviceId");
        } catch {
          // ignore storage failures
        }
        if (lastDeviceId && newDevices.has(lastDeviceId)) {
          const entry = newDevices.get(lastDeviceId);
          primaryDevice = entry?.device;
        } else {
          primaryDevice = newDevices.values().next().value?.device;
        }
      } else {
        primaryDevice = undefined;
      }

      deviceLogger.info("Device removed from store", { deviceId });

      return {
        devices: newDevices,
        primaryDevice,
      };
    });
  },

  closeDevice: async (deviceId: DeviceId): Promise<void> => {
    const state = get();
    const entry = state.devices.get(deviceId);

    if (!entry) {
      deviceLogger.warn("Attempted to close unknown device", { deviceId });
      return;
    }

    try {
      await entry.device.close();
      state.removeDevice(deviceId);
      deviceLogger.info("Device closed", { deviceId });
    } catch (err) {
      deviceLogger.error("Failed to close device", err, { deviceId });
      throw err;
    }
  },

  closeAllDevices: async (): Promise<void> => {
    const state = get();
    const devicesToClose = Array.from(state.devices.entries());

    if (devicesToClose.length === 0) {
      return;
    }

    // Clear devices immediately to prevent concurrent closes
    set({ devices: new Map(), primaryDevice: undefined });

    const closePromises = devicesToClose.map(async ([deviceId, entry]) => {
      try {
        await entry.device.close();
      } catch (err) {
        deviceLogger.error("Failed to close device during cleanup", err, {
          deviceId,
        });
      }
    });

    await Promise.allSettled(closePromises);
    deviceLogger.info("All devices closed");
  },

  setIsCheckingPaired: (checking: boolean): void => {
    set({ isCheckingPaired: checking });
  },

  setRequestDevice: (fn: () => Promise<void>): void => {
    set({ requestDevice: fn });
  },

  setConnectPairedUSBDevice: (
    fn: (usbDevice: USBDevice) => Promise<void>,
  ): void => {
    set({ connectPairedUSBDevice: fn });
  },
});
