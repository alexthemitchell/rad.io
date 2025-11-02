/**
 * Notification Slice
 *
 * Manages application notifications and toasts.
 * Migrated from NotificationContext.tsx to use Zustand.
 */

import { type StateCreator } from "zustand";
import { notify as busNotify } from "../../lib/notifications";

export interface Notification {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  sr: "assertive" | "polite";
  visual: boolean;
}

export interface NotificationSlice {
  notifications: Notification[];
  notify: (
    notification: Omit<Notification, "id"> & { duration?: number },
  ) => void;
  _nextId: number; // Internal counter for notification IDs
  _timeouts: Map<number, NodeJS.Timeout>; // Track active timeouts for cleanup
}

export const notificationSlice: StateCreator<NotificationSlice> = (
  set,
  get,
) => ({
  notifications: [],
  _nextId: 0,
  _timeouts: new Map(),

  notify: (
    notification: Omit<Notification, "id"> & { duration?: number },
  ): void => {
    const state = get();
    const id = state._nextId;
    const newNotification: Notification = {
      ...notification,
      id,
    };

    // Add notification
    set((state) => ({
      notifications: [...state.notifications, newNotification],
      _nextId: state._nextId + 1,
    }));

    // Also send to global notification bus for compatibility with ToastProvider
    busNotify({
      message: notification.message,
      tone: notification.tone,
      sr: notification.sr,
      visual: notification.visual,
      duration: notification.duration,
    });

    // Schedule removal
    const timeoutId = setTimeout(() => {
      set((state) => {
        const newTimeouts = new Map(state._timeouts);
        newTimeouts.delete(id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          _timeouts: newTimeouts,
        };
      });
    }, notification.duration ?? 5000);

    // Track timeout for cleanup
    set((state) => {
      const newTimeouts = new Map(state._timeouts);
      newTimeouts.set(id, timeoutId);
      return { _timeouts: newTimeouts };
    });
  },
});

// Export cleanup function for use in App.tsx or similar
export function cleanupNotificationTimeouts(
  timeouts: Map<number, NodeJS.Timeout>,
): void {
  timeouts.forEach(clearTimeout);
  timeouts.clear();
}
