import { useEffect, useState } from "react";
import { onAnnounce } from "../lib/announcer";

/**
 * GlobalLiveRegion renders a single aria-live region and listens for
 * announcements via the global announcer. Place once near the root of the app.
 */
export default function GlobalLiveRegion(): React.JSX.Element {
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    return onAnnounce((text) => setMessage(text));
  }, []);

  return (
    <div aria-live="polite" aria-atomic="true" className="visually-hidden">
      {message}
    </div>
  );
}
