export type Announcement = {
  text: string;
};

const target = new EventTarget();

export function announce(text: string): void {
  const evt = new CustomEvent<Announcement>("announce", {
    detail: { text },
  });
  target.dispatchEvent(evt);
}

export function onAnnounce(handler: (text: string) => void): () => void {
  const listener = (e: Event): void => {
    const ce = e as CustomEvent<Announcement>;
    handler(ce.detail.text);
  };
  target.addEventListener("announce", listener as EventListener);
  return () =>
    target.removeEventListener("announce", listener as EventListener);
}
