/**
 * Central Zustand Store
 *
 * Replaces React Context API with a more performant and scalable state management solution.
 * This addresses performance issues with high-frequency updates from SDR devices.
 *
 * Key benefits over React Context:
 * - Better performance: Components only re-render when their specific slice changes
 * - Simpler API: No need for providers or context consumers
 * - Better TypeScript support: Full type inference
 * - Easier to debug: Built-in DevTools support
 * - More scalable: Handles complex state logic better
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  deviceSlice,
  type DeviceEntry,
  type DeviceId,
  type DeviceSlice,
} from "./slices/deviceSlice";
import { frequencySlice, type FrequencySlice } from "./slices/frequencySlice";
import {
  notificationSlice,
  type Notification,
  type NotificationSlice,
} from "./slices/notificationSlice";
import {
  settingsSlice,
  type SettingsSlice,
  type SettingsState,
} from "./slices/settingsSlice";
import type { ISDRDevice } from "../models/SDRDevice";

/**
 * Combined store type
 */
export type RootState = SettingsSlice &
  FrequencySlice &
  NotificationSlice &
  DeviceSlice;

/**
 * Create the root store with all slices
 *
 * Using devtools middleware for Redux DevTools integration
 * Persist middleware used for settings that should survive page refresh
 */
export const useStore = create<RootState>()(
  devtools(
    (...args) => ({
      ...settingsSlice(...args),
      ...frequencySlice(...args),
      ...notificationSlice(...args),
      ...deviceSlice(...args),
    }),
    { name: "rad.io-store" },
  ),
);

/**
 * Convenience hooks for accessing specific slices
 * These help with code organization and make components more readable
 */

// Settings slice selectors
export const useSettings = (): {
  settings: SettingsState;
  setSettings: (partial: Partial<SettingsState>) => void;
  resetSettings: () => void;
} => {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const resetSettings = useStore((state) => state.resetSettings);
  return { settings, setSettings, resetSettings };
};

// Frequency slice selectors
export const useFrequency = (): {
  frequencyHz: number;
  setFrequencyHz: (hz: number) => void;
} => {
  const frequencyHz = useStore((state) => state.frequencyHz);
  const setFrequencyHz = useStore((state) => state.setFrequencyHz);
  return { frequencyHz, setFrequencyHz };
};

// Notification slice selectors
export const useNotifications = (): {
  notifications: Notification[];
  notify: (
    notification: Omit<Notification, "id"> & { duration?: number },
  ) => void;
} => {
  const notifications = useStore((state) => state.notifications);
  const notify = useStore((state) => state.notify);
  return { notifications, notify };
};

// Device slice selectors
export const useDevice = (): {
  devices: Map<DeviceId, DeviceEntry>;
  primaryDevice: ISDRDevice | undefined;
  isCheckingPaired: boolean;
  requestDevice: () => Promise<void>;
  closeDevice: (deviceId: DeviceId) => Promise<void>;
  closeAllDevices: () => Promise<void>;
  connectPairedUSBDevice: (usbDevice: USBDevice) => Promise<void>;
} => {
  const devices = useStore((state) => state.devices);
  const primaryDevice = useStore((state) => state.primaryDevice);
  const isCheckingPaired = useStore((state) => state.isCheckingPaired);
  const requestDevice = useStore((state) => state.requestDevice);
  const closeDevice = useStore((state) => state.closeDevice);
  const closeAllDevices = useStore((state) => state.closeAllDevices);
  const connectPairedUSBDevice = useStore(
    (state) => state.connectPairedUSBDevice,
  );
  return {
    devices,
    primaryDevice,
    isCheckingPaired,
    requestDevice,
    closeDevice,
    closeAllDevices,
    connectPairedUSBDevice,
  };
};

// Export types
export type { SettingsState, VizMode } from "./slices/settingsSlice";
export type { Notification } from "./slices/notificationSlice";
export type { DeviceId, DeviceEntry } from "./slices/deviceSlice";
