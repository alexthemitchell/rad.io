import { useEffect, useRef, useState } from "react";
import { onToggleShortcuts } from "../lib/shortcuts";

/**
 * Keyboard Shortcuts Overlay
 * Opens with '?' key and lists common shortcuts per UI-DESIGN-SPEC.md.
 * Accessible dialog with focus management and Escape to close.
 */
function ShortcutsOverlay(): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      // '?' is Shift + '/'
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Close with Escape when open
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return (): void => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Listen for programmatic toggle requests
  useEffect(() => {
    const cleanup = onToggleShortcuts(() => {
      setOpen((prev) => !prev);
    });
    return cleanup;
  }, []);

  // Focus first control on open
  useEffect(() => {
    if (open) {
      closeBtnRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onClick={(e): void => {
        if (e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <h4 id="shortcuts-title" style={{ margin: 0 }}>
            Keyboard Shortcuts
          </h4>
          <button
            ref={closeBtnRef}
            onClick={(): void => setOpen(false)}
            aria-label="Close"
            className="button"
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <section aria-labelledby="shortcuts-global">
            <h5 id="shortcuts-global" style={{ marginBottom: 8 }}>
              Global
            </h5>
            <ul>
              <li>Ctrl/Cmd+K: Command palette</li>
              <li>Ctrl/Cmd+S: Start/stop recording</li>
              <li>Ctrl/Cmd+F: Focus frequency input</li>
              <li>?: Show shortcuts help</li>
            </ul>
          </section>

          <section aria-labelledby="shortcuts-tuning">
            <h5 id="shortcuts-tuning" style={{ marginBottom: 8 }}>
              Tuning
            </h5>
            <ul>
              <li>Arrow Up/Down: ± current step</li>
              <li>Shift: ×10, Alt: ×100, Ctrl: ×1000</li>
              <li>[ / ]: Cycle step sizes</li>
              <li>M: Cycle modes; Shift+M: Mode menu</li>
            </ul>
          </section>

          <section aria-labelledby="shortcuts-views">
            <h5 id="shortcuts-views" style={{ marginBottom: 8 }}>
              Spectrum/Waterfall
            </h5>
            <ul>
              <li>1/2/3/4: Switch tabs</li>
              <li>Z: Zoom to selection; X: Reset zoom</li>
              <li>P: Toggle peak hold; G: Grid; R: RBW</li>
              <li>B: Add bookmark; Enter: Tune at cursor</li>
            </ul>
          </section>

          <section aria-labelledby="shortcuts-scanner">
            <h5 id="shortcuts-scanner" style={{ marginBottom: 8 }}>
              Scanner & Bookmarks
            </h5>
            <ul>
              <li>. / , : Scan next/prev; Space: Pause/resume</li>
              <li>Ctrl/Cmd+B: New bookmark; Del: Delete bookmark</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ShortcutsOverlay;
