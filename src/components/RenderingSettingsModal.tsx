import { useEffect, useRef } from "react";

export interface RenderingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Minimal rendering settings modal shell.
 * TODO: Populate with backend selection, target FPS, and performance toggles.
 */
export default function RenderingSettingsModal({
  isOpen,
  onClose,
}: RenderingSettingsModalProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const prevActive = document.activeElement as HTMLElement | null;

    // Focus modal on open
    const t = setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
      // Very lightweight focus trap: if focus leaves, bring it back
      if (e.key === "Tab") {
        // Prevent focus leaving the modal content
        e.preventDefault();
        dialogRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return (): void => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      prevActive?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* Backdrop close control to satisfy a11y for click-to-close */}
      <button
        type="button"
        aria-label="Close rendering settings"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "default",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rendering-settings-title"
        ref={dialogRef}
        tabIndex={-1}
        className="modal-card"
        style={{
          background: "var(--rad-bg, #0a0e1a)",
          color: "var(--rad-fg, #e6e8ef)",
          border: "1px solid var(--rad-border, #2b3145)",
          minWidth: 420,
          maxWidth: 720,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h2 id="rendering-settings-title" style={{ margin: 0, fontSize: 18 }}>
            Rendering Settings
          </h2>
          <button
            type="button"
            aria-label="Close settings"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: "4px 8px" }}
          >
            Close
          </button>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>
            Configure visualization backends and performance options. This is a
            placeholder UI; controls will be wired in a follow-up.
          </p>
          <ul style={{ marginTop: 8 }}>
            <li>Backend: Auto / WebGPU / WebGL2 / WebGL1 / Worker / 2D</li>
            <li>Target FPS: 30 / 60 / 120</li>
            <li>High performance mode toggle</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
