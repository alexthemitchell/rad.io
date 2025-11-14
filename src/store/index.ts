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

import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import {
  deviceSlice,
  type DeviceEntry,
  type DeviceId,
  type DeviceSlice,
} from "./slices/deviceSlice";
import {
  diagnosticsSlice,
  type DiagnosticsSlice,
  type DiagnosticEvent,
  type DemodulatorMetrics,
  type TSParserMetrics,
  type DecoderMetrics,
} from "./slices/diagnosticsSlice";
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
  DeviceSlice &
  DiagnosticsSlice;

/**
 * Create the root store with all slices
 *
 * Using devtools middleware for Redux DevTools integration
 * Settings persistence is handled manually in settingsSlice via localStorage
 */
export const useStore = create<RootState>()(
  devtools(
    (...args: Parameters<StateCreator<RootState>>) => ({
      ...settingsSlice(...args),
      ...frequencySlice(...args),
      ...notificationSlice(...args),
      ...deviceSlice(...args),
      ...diagnosticsSlice(...args),
    }),
    { name: "rad.io-store" },
  ),
);

/**
 * Convenience hooks for accessing specific slices
 * These help with code organization and make components more readable
 *
 * Note: Each hook creates separate subscriptions for each selector.
 * Components will re-render when any of the returned values change.
 * For fine-grained control, use useStore directly with a single selector.
 */

// Settings slice selectors
export const useSettings = (): {
  settings: SettingsState;
  setSettings: (partial: Partial<SettingsState>) => void;
  resetSettings: () => void;
} => {
  const settings = useStore((state: RootState) => state.settings);
  const setSettings = useStore((state: RootState) => state.setSettings);
  const resetSettings = useStore((state: RootState) => state.resetSettings);
  return { settings, setSettings, resetSettings };
};

// Frequency slice selectors
export const useFrequency = (): {
  frequencyHz: number;
  setFrequencyHz: (hz: number) => void;
} => {
  const frequencyHz = useStore((state: RootState) => state.frequencyHz);
  const setFrequencyHz = useStore((state: RootState) => state.setFrequencyHz);
  return { frequencyHz, setFrequencyHz };
};

// Notification slice selectors
export const useNotifications = (): {
  notifications: Notification[];
  notify: (
    notification: Omit<Notification, "id"> & { duration?: number },
  ) => void;
} => {
  const notifications = useStore((state: RootState) => state.notifications);
  const notify = useStore((state: RootState) => state.notify);
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
  const devices = useStore((state: RootState) => state.devices);
  const primaryDevice = useStore((state: RootState) => state.primaryDevice);
  const isCheckingPaired = useStore(
    (state: RootState) => state.isCheckingPaired,
  );
  const requestDevice = useStore((state: RootState) => state.requestDevice);
  const closeDevice = useStore((state: RootState) => state.closeDevice);
  const closeAllDevices = useStore((state: RootState) => state.closeAllDevices);
  const connectPairedUSBDevice = useStore(
    (state: RootState) => state.connectPairedUSBDevice,
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

// Diagnostics slice selectors
export const useDiagnostics = (): {
  events: DiagnosticEvent[];
  demodulatorMetrics: DemodulatorMetrics | null;
  tsParserMetrics: TSParserMetrics | null;
  videoDecoderMetrics: DecoderMetrics | null;
  audioDecoderMetrics: DecoderMetrics | null;
  captionDecoderMetrics: DecoderMetrics | null;
  overlayVisible: boolean;
  addDiagnosticEvent: (
    event: Omit<DiagnosticEvent, "id" | "timestamp">,
  ) => void;
  updateDemodulatorMetrics: (metrics: Partial<DemodulatorMetrics>) => void;
  updateTSParserMetrics: (metrics: Partial<TSParserMetrics>) => void;
  updateVideoDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  updateAudioDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  updateCaptionDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  clearDiagnosticEvents: () => void;
  resetDiagnostics: () => void;
  setOverlayVisible: (visible: boolean) => void;
} => {
  const events = useStore((state: RootState) => state.events);
  const demodulatorMetrics = useStore(
    (state: RootState) => state.demodulatorMetrics,
  );
  const tsParserMetrics = useStore((state: RootState) => state.tsParserMetrics);
  const videoDecoderMetrics = useStore(
    (state: RootState) => state.videoDecoderMetrics,
  );
  const audioDecoderMetrics = useStore(
    (state: RootState) => state.audioDecoderMetrics,
  );
  const captionDecoderMetrics = useStore(
    (state: RootState) => state.captionDecoderMetrics,
  );
  const overlayVisible = useStore((state: RootState) => state.overlayVisible);
  const addDiagnosticEvent = useStore(
    (state: RootState) => state.addDiagnosticEvent,
  );
  const updateDemodulatorMetrics = useStore(
    (state: RootState) => state.updateDemodulatorMetrics,
  );
  const updateTSParserMetrics = useStore(
    (state: RootState) => state.updateTSParserMetrics,
  );
  const updateVideoDecoderMetrics = useStore(
    (state: RootState) => state.updateVideoDecoderMetrics,
  );
  const updateAudioDecoderMetrics = useStore(
    (state: RootState) => state.updateAudioDecoderMetrics,
  );
  const updateCaptionDecoderMetrics = useStore(
    (state: RootState) => state.updateCaptionDecoderMetrics,
  );
  const clearDiagnosticEvents = useStore(
    (state: RootState) => state.clearDiagnosticEvents,
  );
  const resetDiagnostics = useStore(
    (state: RootState) => state.resetDiagnostics,
  );
  const setOverlayVisible = useStore(
    (state: RootState) => state.setOverlayVisible,
  );

  return {
    events,
    demodulatorMetrics,
    tsParserMetrics,
    videoDecoderMetrics,
    audioDecoderMetrics,
    captionDecoderMetrics,
    overlayVisible,
    addDiagnosticEvent,
    updateDemodulatorMetrics,
    updateTSParserMetrics,
    updateVideoDecoderMetrics,
    updateAudioDecoderMetrics,
    updateCaptionDecoderMetrics,
    clearDiagnosticEvents,
    resetDiagnostics,
    setOverlayVisible,
  };
};

// Export types
export type { SettingsState, VizMode } from "./slices/settingsSlice";
export type { Notification } from "./slices/notificationSlice";
export type { DeviceId, DeviceEntry } from "./slices/deviceSlice";
export type {
  DiagnosticEvent,
  DiagnosticSeverity,
  DiagnosticSource,
  DemodulatorMetrics,
  TSParserMetrics,
  DecoderMetrics,
  SignalQualityMetrics,
} from "./slices/diagnosticsSlice";
