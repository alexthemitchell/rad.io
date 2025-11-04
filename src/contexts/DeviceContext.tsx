/**
 * DeviceContext compatibility layer
 *
 * The project migrated to Zustand (`src/store/`) for state management.
 * This file preserves the previous public API surface so legacy imports
 * keep working while delegating implementation to the store.
 */

import { useDeviceIntegration } from "../hooks/useDeviceIntegration";
import { useStore, type RootState } from "../store";
import type { ISDRDevice } from "../models/SDRDevice";
import type { DeviceEntry, DeviceId } from "../store/slices/deviceSlice";
import type React from "react";

// Provider stub: initializes device integration and renders children
export function DeviceProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  useDeviceIntegration();
  return <>{children}</>;
}

// Backwards-compatible context accessor implemented via Zustand selectors
export function useDeviceContext(): {
  devices: Map<DeviceId, DeviceEntry>;
  primaryDevice: ISDRDevice | undefined;
  isCheckingPaired: boolean;
  requestDevice: () => Promise<void>;
  closeDevice: (deviceId: DeviceId) => Promise<void>;
  closeAllDevices: () => Promise<void>;
  connectPairedUSBDevice: (usbDevice: USBDevice) => Promise<void>;
} {
  const devices = useStore((s: RootState) => s.devices);
  const primaryDevice = useStore((s: RootState) => s.primaryDevice);
  const isCheckingPaired = useStore((s: RootState) => s.isCheckingPaired);
  const requestDevice = useStore((s: RootState) => s.requestDevice);
  const closeDevice = useStore((s: RootState) => s.closeDevice);
  const closeAllDevices = useStore((s: RootState) => s.closeAllDevices);
  const connectPairedUSBDevice = useStore(
    (s: RootState) => s.connectPairedUSBDevice,
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
}

// Re-export store hook for compatibility where `useDevice` was imported from this module
export { useDevice as useDevice } from "../store";

// Types for compatibility
export type { DeviceId, DeviceEntry } from "../store";
