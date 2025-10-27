import React from "react";
import { onNotify, type NotificationDetail } from "../lib/notifications";

export type Toast = NotificationDetail;

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [srPolite, setSrPolite] = React.useState<string>("");
  const [srAssertive, setSrAssertive] = React.useState<string>("");

  React.useEffect(() => {
    const unsubscribe = onNotify((detail) => {
      if (!detail.visual) {
        return;
      }
      setToasts((q) => [...q, detail]);
      window.setTimeout(() => {
        setToasts((q) => q.filter((t) => t.id !== detail.id));
      }, detail.duration);
    });
    return unsubscribe;
  }, []);

  // Screen reader announcements: update appropriate live region
  React.useEffect(() => {
    const unsubscribe = onNotify((detail) => {
      if (detail.sr === "polite") {
        setSrPolite(detail.message);
      } else if (detail.sr === "assertive") {
        setSrAssertive(detail.message);
      }
    });
    return unsubscribe;
  }, []);

  const dismiss = (id: string): void => {
    setToasts((q) => q.filter((t) => t.id !== id));
  };

  return (
    <>
      {children}
      <div className="toast-container" aria-live="off">
        {toasts.map((t) => {
          const ariaHidden = t.sr ? true : undefined;
          const role = !t.sr ? ("status" as const) : undefined;
          return (
            <div
              key={t.id}
              className={`toast tone-${t.tone}`}
              aria-hidden={ariaHidden}
              // inert removes focusability for non-assertive toasts announced via SR
              inert={Boolean(t.sr)}
              role={role}
              data-testid="toast"
            >
              <div className="toast-body">{t.message}</div>
              <button
                type="button"
                className="toast-dismiss"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {/* Global live regions for SR announcements (visually hidden) */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {srPolite}
      </div>
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {srAssertive}
      </div>
    </>
  );
}

export default ToastProvider;
