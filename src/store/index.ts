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
} =>
  useStore((state) => ({
    settings: state.settings,
    setSettings: state.setSettings,
    resetSettings: state.resetSettings,
  }));

// Frequency slice selectors
export const useFrequency = (): {
  frequencyHz: number;
  setFrequencyHz: (hz: number) => void;
} =>
  useStore((state) => ({
    frequencyHz: state.frequencyHz,
    setFrequencyHz: state.setFrequencyHz,
  }));

// Notification slice selectors
export const useNotifications = (): {
  notifications: Notification[];
  notify: (
    notification: Omit<Notification, "id"> & { duration?: number },
  ) => void;
} =>
  useStore((state) => ({
    notifications: state.notifications,
    notify: state.notify,
  }));

// Device slice selectors
export const useDevice = (): {
  devices: Map<DeviceId, DeviceEntry>;
  primaryDevice: ISDRDevice | undefined;
  isCheckingPaired: boolean;
  requestDevice: () => Promise<void>;
  closeDevice: (deviceId: DeviceId) => Promise<void>;
  closeAllDevices: () => Promise<void>;
  connectPairedUSBDevice: (usbDevice: USBDevice) => Promise<void>;
} =>
  useStore((state) => ({
    devices: state.devices,
    primaryDevice: state.primaryDevice,
    isCheckingPaired: state.isCheckingPaired,
    requestDevice: state.requestDevice,
    closeDevice: state.closeDevice,
    closeAllDevices: state.closeAllDevices,
    connectPairedUSBDevice: state.connectPairedUSBDevice,
  }));

// Export types
export type { SettingsState, VizMode } from "./slices/settingsSlice";
export type { Notification } from "./slices/notificationSlice";
export type { DeviceId, DeviceEntry } from "./slices/deviceSlice";
