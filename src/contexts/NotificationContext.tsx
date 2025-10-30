import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { notify as busNotify } from '../lib/notifications';

interface Notification {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  sr: 'assertive' | 'polite';
  visual: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  notify: (
    notification: Omit<Notification, 'id'> & { duration?: number },
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback to the global notifications bus so components can call notify()
    // without requiring NotificationProvider. This keeps compatibility with
    // the central ToastProvider that renders UI for notifications.
    return {
      notifications: [],
      notify: (n) =>
        busNotify({
          message: n.message,
          tone: n.tone,
          sr: n.sr,
          visual: n.visual,
          duration: n.duration,
        }),
    };
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nextId, setNextId] = useState(0);
  const timeoutIdsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const notify = useCallback(
    (notification: Omit<Notification, 'id'> & { duration?: number }) => {
      const id = nextId;
      setNextId((prevId) => prevId + 1);
      setNotifications((prev) => [...prev, { ...notification, id }]);

      const timeoutId = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        timeoutIdsRef.current.delete(timeoutId);
      }, notification.duration ?? 5000);
      
      timeoutIdsRef.current.add(timeoutId);
    },
    [nextId],
  );

  // Cleanup all timeouts on unmount to prevent memory leaks
  useEffect(() => {
    const timeouts = timeoutIdsRef.current;
    return (): void => {
      timeouts.forEach(clearTimeout);
      timeouts.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
        }}
      >
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: '10px 20px',
              backgroundColor:
                n.tone === 'success'
                  ? 'green'
                  : n.tone === 'error'
                  ? 'red'
                  : 'blue',
              color: 'white',
              marginBottom: '10px',
              borderRadius: '5px',
            }}
          >
            {n.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
