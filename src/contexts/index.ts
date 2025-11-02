/**
 * Contexts barrel export
 *
 * DEPRECATED: This file now re-exports from the Zustand store for backward compatibility.
 * Components should import directly from '../store' for new code.
 *
 * Legacy Context API has been replaced with Zustand for better performance and scalability.
 */

// Re-export store hooks for backward compatibility
export {
  useDevice,
  useFrequency,
  useNotifications,
  useSettings,
} from "../store";

// Export types
export type { SettingsState, VizMode } from "../store";
export type { Notification } from "../store/slices/notificationSlice";
export type { DeviceId, DeviceEntry } from "../store/slices/deviceSlice";

// Legacy exports for components that may still reference these
// These are now no-ops or simple re-exports from the store
export { useDevice as useDeviceContext } from "../store";
