import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveRegion } from "../hooks/useLiveRegion";

/**
 * FrequencyDisplay component - Primary frequency display with VFO controls
 *
 * According to ADR-0018, always visible and includes:
 * - Primary frequency display (JetBrains Mono font)
 * - VFO controls (tuning knobs, step size selector)
 * - Keyboard shortcuts for tuning
 *
 * Features:
 * - Large, readable frequency display
 * - Click-to-tune capability
 * - Arrow key tuning with modifiers (Shift, Alt, Ctrl for different step sizes)
 * - Direct frequency entry
 *
 * Keyboard shortcuts:
 * - Arrow Up/Down: Tune by current step size
 * - Shift + Arrow: 10x current step
 * - Alt + Arrow: 100x current step
 * - Ctrl + Arrow: 1000x current step
 *
 * Accessibility:
 * - Keyboard tuning support
 * - Screen reader announcements for frequency changes
 * - Focus management
 *
 * TODO: Integrate with device frequency control
 * TODO: Add frequency validation (device limits)
 */
interface FrequencyDisplayProps {
  frequency?: number; // Frequency in Hz
  onChange?: (frequency: number) => void;
}

const STEP_SIZES = [
  { label: "1 Hz", value: 1 },
  { label: "10 Hz", value: 10 },
  { label: "100 Hz", value: 100 },
  { label: "1 kHz", value: 1000 },
  { label: "10 kHz", value: 10000 },
  { label: "100 kHz", value: 100000 },
  { label: "1 MHz", value: 1000000 },
];

function FrequencyDisplay({
  frequency = 0,
  onChange,
}: FrequencyDisplayProps): React.JSX.Element {
  const [stepSize, setStepSize] = useState<number>(1000); // Default 1 kHz
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { announce } = useLiveRegion();

  const formatFrequency = (freqHz: number): string => {
    if (freqHz >= 1e9) {
      return `${(freqHz / 1e9).toFixed(6)} GHz`;
    }
    if (freqHz >= 1e6) {
      return `${(freqHz / 1e6).toFixed(3)} MHz`;
    }
    if (freqHz >= 1e3) {
      return `${(freqHz / 1e3).toFixed(1)} kHz`;
    }
    return `${freqHz.toFixed(0)} Hz`;
  };

  const handleTune = useCallback(
    (delta: number): void => {
      if (!onChange) {
        return;
      }
      const newFreq = Math.max(0, frequency + delta);
      onChange(newFreq);
      announce(`Frequency: ${formatFrequency(newFreq)}`);
    },
    [frequency, onChange, announce, formatFrequency],
  );

  const handleStepChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newStep = parseInt(e.target.value, 10);
    setStepSize(newStep);
    announce(`Step size: ${formatStepSize(newStep)}`);
  };

  const formatStepSize = (step: number): string => {
    const found = STEP_SIZES.find((s) => s.value === step);
    return found ? found.label : `${step} Hz`;
  };

  const handleFrequencyClick = (): void => {
    setIsEditing(true);
    setEditValue((frequency / 1e6).toFixed(3)); // Show in MHz
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEditValue(e.target.value);
  };

  const handleEditBlur = (): void => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0 && onChange) {
      const newFreq = Math.round(parsed * 1e6); // Convert MHz to Hz
      onChange(newFreq);
      announce(`Frequency set to ${formatFrequency(newFreq)}`);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (e.key === "Enter") {
      handleEditBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      let multiplier = 1;
      if (e.ctrlKey) {
        multiplier = 1000;
      } else if (e.altKey) {
        multiplier = 100;
      } else if (e.shiftKey) {
        multiplier = 10;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleTune(stepSize * multiplier);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleTune(-stepSize * multiplier);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return (): void => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stepSize, handleTune]);

  return (
    <div className="frequency-display" role="region" aria-label="VFO Control">
      <h2 className="visually-hidden">Frequency Control</h2>

      <div
        className="frequency-value"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="frequency-input"
            value={editValue}
            onChange={handleEditChange}
            onBlur={handleEditBlur}
            onKeyDown={handleEditKeyDown}
            aria-label="Enter frequency in MHz"
          />
        ) : (
          <span
            className="frequency-digits"
            role="button"
            tabIndex={0}
            onClick={handleFrequencyClick}
            onKeyDown={(e): void => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleFrequencyClick();
              }
            }}
            aria-label={`Current frequency: ${formatFrequency(frequency)}. Click to edit.`}
            title="Click to edit frequency"
          >
            {formatFrequency(frequency)}
          </span>
        )}
      </div>

      <div className="vfo-controls" role="group" aria-label="Tuning controls">
        <button
          className="tune-button"
          onClick={(): void => handleTune(stepSize)}
          aria-label="Tune up"
          title="Tune up (Keyboard: Up arrow)"
        >
          ▲
        </button>

        <button
          className="tune-button"
          onClick={(): void => handleTune(-stepSize)}
          aria-label="Tune down"
          title="Tune down (Keyboard: Down arrow)"
        >
          ▼
        </button>

        <select
          aria-label="Tuning step size"
          value={stepSize}
          onChange={handleStepChange}
        >
          {STEP_SIZES.map((step) => (
            <option key={step.value} value={step.value}>
              {step.label}
            </option>
          ))}
        </select>
      </div>

      <div className="keyboard-hints" aria-hidden="true">
        <small>
          Arrows: ±{formatStepSize(stepSize)} | Shift: ×10 | Alt: ×100 | Ctrl:
          ×1000
        </small>
      </div>
    </div>
  );
}

export default FrequencyDisplay;
