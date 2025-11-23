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
import { useShallow } from "zustand/react/shallow";
import {
  deviceSlice,
  type DeviceEntry,
  type DeviceId,
  type DeviceSlice,
} from "./slices/deviceSlice";
import {
  diagnosticsSlice,
  type DecoderMetrics,
  type DemodulatorMetrics,
  type DiagnosticEvent,
  type DiagnosticsSlice,
  type TSParserMetrics,
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
} =>
  useStore(
    useShallow((state: RootState) => ({
      settings: state.settings,
      setSettings: state.setSettings,
      resetSettings: state.resetSettings,
    }))
  );

// Frequency slice selectors
export const useFrequency = (): {
  frequencyHz: number;
  setFrequencyHz: (hz: number) => void;
} =>
  useStore(
    useShallow((state: RootState) => ({
      frequencyHz: state.frequencyHz,
      setFrequencyHz: state.setFrequencyHz,
    }))
  );

// Notification slice selectors
export const useNotifications = (): {
  notifications: Notification[];
  notify: (
    notification: Omit<Notification, "id"> & { duration?: number },
  ) => void;
} =>
  useStore(
    useShallow((state: RootState) => ({
      notifications: state.notifications,
      notify: state.notify,
    }))
  );

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
  useStore(
    useShallow((state: RootState) => ({
      devices: state.devices,
      primaryDevice: state.primaryDevice,
      isCheckingPaired: state.isCheckingPaired,
      requestDevice: state.requestDevice,
      closeDevice: state.closeDevice,
      closeAllDevices: state.closeAllDevices,
      connectPairedUSBDevice: state.connectPairedUSBDevice,
    }))
  );

// Diagnostics slice selectors
/**
 * Granular diagnostics selectors for Zustand.
 * Splitting selectors allows components to subscribe only to the state/actions they need,
 * minimizing unnecessary re-renders.
 */

/**
 * Hook for overlay visibility state and control.
 * Use this in components that only need to show/hide the diagnostics overlay.
 */
export const useDiagnosticsOverlay = (): {
  overlayVisible: boolean;
  setOverlayVisible: (visible: boolean) => void;
} =>
  useStore(
    useShallow((state: RootState) => ({
      overlayVisible: state.overlayVisible,
      setOverlayVisible: state.setOverlayVisible,
    }))
  );

/**
 * Hook for all metrics and their update actions.
 * Use this in components that display or update diagnostic metrics.
 */
export const useDiagnosticsMetrics = (): {
  demodulatorMetrics: DemodulatorMetrics | null;
  tsParserMetrics: TSParserMetrics | null;
  videoDecoderMetrics: DecoderMetrics | null;
  audioDecoderMetrics: DecoderMetrics | null;
  captionDecoderMetrics: DecoderMetrics | null;
  updateDemodulatorMetrics: (metrics: Partial<DemodulatorMetrics>) => void;
  updateTSParserMetrics: (metrics: Partial<TSParserMetrics>) => void;
  updateVideoDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  updateAudioDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
  updateCaptionDecoderMetrics: (metrics: Partial<DecoderMetrics>) => void;
} =>
  useStore(
    useShallow((state: RootState) => ({
      demodulatorMetrics: state.demodulatorMetrics,
      tsParserMetrics: state.tsParserMetrics,
      videoDecoderMetrics: state.videoDecoderMetrics,
      audioDecoderMetrics: state.audioDecoderMetrics,
      captionDecoderMetrics: state.captionDecoderMetrics,
      updateDemodulatorMetrics: state.updateDemodulatorMetrics,
      updateTSParserMetrics: state.updateTSParserMetrics,
      updateVideoDecoderMetrics: state.updateVideoDecoderMetrics,
      updateAudioDecoderMetrics: state.updateAudioDecoderMetrics,
      updateCaptionDecoderMetrics: state.updateCaptionDecoderMetrics,
    }))
  );

/**
 * Hook for diagnostic events.
 * Use this in components that display or manage event logs.
 */
export const useDiagnosticsEvents = (): {
  events: DiagnosticEvent[];
  addDiagnosticEvent: (
    event: Omit<DiagnosticEvent, "id" | "timestamp">,
  ) => void;
  clearDiagnosticEvents: () => void;
} =>
  useStore(
    useShallow((state: RootState) => ({
      events: state.events,
      addDiagnosticEvent: state.addDiagnosticEvent,
      clearDiagnosticEvents: state.clearDiagnosticEvents,
    }))
  );

/**
 * Legacy hook that returns all diagnostics state and actions.
 * Note: This will cause re-renders on any diagnostics state change.
 * Consider using more specific hooks (useDiagnosticsOverlay, useDiagnosticsMetrics, useDiagnosticsEvents)
 * for better performance.
 */
export const useDiagnostics = (): Pick<
  RootState,
  | "events"
  | "demodulatorMetrics"
  | "tsParserMetrics"
  | "videoDecoderMetrics"
  | "audioDecoderMetrics"
  | "captionDecoderMetrics"
  | "dspCapabilities"
  | "overlayVisible"
  | "addDiagnosticEvent"
  | "updateDemodulatorMetrics"
  | "updateTSParserMetrics"
  | "updateVideoDecoderMetrics"
  | "updateAudioDecoderMetrics"
  | "updateCaptionDecoderMetrics"
  | "setDSPCapabilities"
  | "clearDiagnosticEvents"
  | "resetDiagnostics"
  | "setOverlayVisible"
> => {
  return useStore(
    useShallow((state: RootState) => ({
      events: state.events,
      demodulatorMetrics: state.demodulatorMetrics,
      tsParserMetrics: state.tsParserMetrics,
      videoDecoderMetrics: state.videoDecoderMetrics,
      audioDecoderMetrics: state.audioDecoderMetrics,
      captionDecoderMetrics: state.captionDecoderMetrics,
      dspCapabilities: state.dspCapabilities,
      overlayVisible: state.overlayVisible,
      addDiagnosticEvent: state.addDiagnosticEvent,
      updateDemodulatorMetrics: state.updateDemodulatorMetrics,
      updateTSParserMetrics: state.updateTSParserMetrics,
      updateVideoDecoderMetrics: state.updateVideoDecoderMetrics,
      updateAudioDecoderMetrics: state.updateAudioDecoderMetrics,
      updateCaptionDecoderMetrics: state.updateCaptionDecoderMetrics,
      setDSPCapabilities: state.setDSPCapabilities,
      clearDiagnosticEvents: state.clearDiagnosticEvents,
      resetDiagnostics: state.resetDiagnostics,
      setOverlayVisible: state.setOverlayVisible,
    }))
  );
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
