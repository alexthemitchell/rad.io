export type Tone = "info" | "success" | "warning" | "error";
export type Politeness = "polite" | "assertive" | false;

export type NotifyOptions = {
  message: string;
  tone?: Tone;
  sr?: Politeness; // default 'polite' -> announce via live region
  visual?: boolean; // default true -> show toast
  duration?: number; // ms, default 4000
};

export type NotificationDetail = Required<NotifyOptions> & {
  id: string;
};

const target = new EventTarget();

export function notify(opts: NotifyOptions): void {
  const detail: NotificationDetail = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message: opts.message,
    tone: opts.tone ?? "info",
    sr: opts.sr ?? "polite",
    visual: opts.visual ?? true,
    duration: opts.duration ?? 4000,
  };

  const evt = new CustomEvent<NotificationDetail>("notify", { detail });
  target.dispatchEvent(evt);
}

export function onNotify(
  handler: (detail: NotificationDetail) => void,
): () => void {
  const listener = (e: Event): void => {
    const ce = e as CustomEvent<NotificationDetail>;
    handler(ce.detail);
  };
  target.addEventListener("notify", listener as EventListener);
  return () => target.removeEventListener("notify", listener as EventListener);
}

// Expose a helper in non-production builds to simplify manual and E2E testing.
// This avoids coupling tests to internal EventTarget.
declare global {
  interface Window {
    radNotify: (opts: NotifyOptions) => void;
  }
}
if (typeof window !== "undefined" && process.env["NODE_ENV"] !== "production") {
  window.radNotify = notify;
}
