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
  markerSlice,
  type Marker,
  type MarkerSlice,
} from "./slices/markerSlice";
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
import {
  signalLevelSlice,
  type SignalLevelSlice,
} from "./slices/signalLevelSlice";
import type { SignalLevel } from "../lib/measurement/types";
import type { ISDRDevice } from "../models/SDRDevice";

/**
 * Combined store type
 */
export type RootState = SettingsSlice &
  FrequencySlice &
  NotificationSlice &
  DeviceSlice &
  DiagnosticsSlice &
  MarkerSlice &
  SignalLevelSlice;

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
      ...markerSlice(...args),
      ...signalLevelSlice(...args),
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
  useStore((state: RootState) => ({
    overlayVisible: state.overlayVisible,
    setOverlayVisible: state.setOverlayVisible,
  }));

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
  useStore((state: RootState) => ({
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
  }));

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
  useStore((state: RootState) => ({
    events: state.events,
    addDiagnosticEvent: state.addDiagnosticEvent,
    clearDiagnosticEvents: state.clearDiagnosticEvents,
  }));

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
    })),
  );
};

// Marker slice selectors
export const useMarkers = (): {
  markers: Marker[];
  nextMarkerNumber: number;
  addMarker: (freqHz: number, powerDb?: number) => void;
  updateMarker: (id: string, freqHz?: number, powerDb?: number) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
} => {
  const markers = useStore((state: RootState) => state.markers);
  const nextMarkerNumber = useStore(
    (state: RootState) => state.nextMarkerNumber,
  );
  const addMarker = useStore((state: RootState) => state.addMarker);
  const updateMarker = useStore((state: RootState) => state.updateMarker);
  const removeMarker = useStore((state: RootState) => state.removeMarker);
  const clearMarkers = useStore((state: RootState) => state.clearMarkers);
  return {
    markers,
    nextMarkerNumber,
    addMarker,
    updateMarker,
    removeMarker,
    clearMarkers,
  };
};

// Signal Level slice selectors
export const useSignalLevel = (): {
  signalLevel: SignalLevel | null;
  setSignalLevel: (level: SignalLevel) => void;
  clearSignalLevel: () => void;
} => {
  const signalLevel = useStore((state: RootState) => state.signalLevel);
  const setSignalLevel = useStore((state: RootState) => state.setSignalLevel);
  const clearSignalLevel = useStore(
    (state: RootState) => state.clearSignalLevel,
  );
  return { signalLevel, setSignalLevel, clearSignalLevel };
};

// Export types
export type { SettingsState, VizMode } from "./slices/settingsSlice";
export type { Marker } from "./slices/markerSlice";
export type { Notification } from "./slices/notificationSlice";
export type { DeviceId, DeviceEntry } from "./slices/deviceSlice";
export type { SignalLevel } from "../lib/measurement/types";
export type {
  DiagnosticEvent,
  DiagnosticSeverity,
  DiagnosticSource,
  DemodulatorMetrics,
  TSParserMetrics,
  DecoderMetrics,
  SignalQualityMetrics,
} from "./slices/diagnosticsSlice";
