/**
 * Add VFO Modal
 *
 * Modal dialog for creating a new VFO at a clicked frequency.
 */

import React, { useEffect, useRef, useState } from "react";
import { formatFrequency } from "../utils/frequency";
import { VFO_MODE_CONFIGS } from "../utils/vfoModes";

export interface AddVfoModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Frequency in Hz where user clicked */
  frequencyHz: number;
  /** Callback when user confirms creation */
  onConfirm: (modeId: string) => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Add VFO Modal Component
 */
export function AddVfoModal({
  isOpen,
  frequencyHz,
  onConfirm,
  onCancel,
}: AddVfoModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedMode, setSelectedMode] = useState<string>("am");

  // Reset selectedMode to "am" whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMode("am");
    }
  }, [isOpen]);

  // Focus trap and escape key handler
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Focus confirm button when modal opens
    confirmButtonRef.current?.focus();

    // Handle escape key
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return (): void => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = (): void => {
    onConfirm(selectedMode);
  };

  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onClick={(e): void => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-vfo-modal-title"
        ref={modalRef}
      >
        <h4 id="add-vfo-modal-title">Add VFO</h4>

        <div className="dialog-field-group">
          <label htmlFor="vfo-frequency">Frequency</label>
          <div
            id="vfo-frequency"
            className="rad-tabular-nums vfo-frequency-display"
          >
            {formatFrequency(frequencyHz)}
          </div>
        </div>

        <div className="dialog-field-group">
          <label htmlFor="vfo-mode">Demodulation Mode</label>
          <select
            id="vfo-mode"
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
          >
            {VFO_MODE_CONFIGS.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        <div className="dialog-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
          >
            Add VFO
          </button>
        </div>
      </div>
    </div>
  );
}
