import { useState, useEffect, useRef, useCallback } from "react";
import { notify } from "../lib/notifications";
import { formatFrequency } from "../utils/frequency";

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
  { label: "Auto (context)", value: 0 },
  { label: "1 Hz", value: 1 },
  { label: "10 Hz", value: 10 },
  { label: "100 Hz", value: 100 },
  { label: "1 kHz", value: 1000 },
  { label: "10 kHz", value: 10000 },
  { label: "100 kHz", value: 100000 },
  { label: "1 MHz", value: 1000000 },
];

// Digit-under-caret editing (Phase A.1)
// We support 6 magnitudes aligned with display digits: 100 MHz, 10 MHz, 1 MHz, 100 kHz, 10 kHz, 1 kHz
// This keeps UI readable (MHz with 3 decimals) while allowing precise kHz tuning.
const DIGIT_MAGNITUDES = [1e8, 1e7, 1e6, 1e5, 1e4, 1e3] as const;
const DIGIT_COUNT = DIGIT_MAGNITUDES.length;
function labelForDigit(index: number): string {
  switch (index) {
    case 0:
      return "hundreds of megahertz";
    case 1:
      return "tens of megahertz";
    case 2:
      return "megahertz";
    case 3:
      return "hundreds of kilohertz";
    case 4:
      return "tens of kilohertz";
    case 5:
      return "kilohertz";
    default:
      return "digit";
  }
}

function FrequencyDisplay({
  frequency = 0,
  onChange,
}: FrequencyDisplayProps): React.JSX.Element {
  const [stepSize, setStepSize] = useState<number>(1000); // Default 1 kHz (Auto available)
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const backingInputRef = useRef<HTMLInputElement>(null);
  const [activeDigit, setActiveDigit] = useState<number>(2); // default to 1 MHz place

  const handleTune = useCallback(
    (delta: number): void => {
      if (!onChange) {
        return;
      }
      const newFreq = Math.max(0, frequency + delta);
      onChange(newFreq);
      notify({
        message: `Frequency: ${formatFrequency(newFreq)}`,
        sr: "polite",
        visual: false,
      });
    },
    [frequency, onChange],
  );

  const adjustAtActiveDigit = useCallback(
    (direction: 1 | -1, multiplier = 1): void => {
      const mag = DIGIT_MAGNITUDES[activeDigit] ?? 1000;
      handleTune(direction * mag * multiplier);
    },
    [activeDigit, handleTune],
  );

  const handleStepChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newStep = parseInt(e.target.value, 10);
    setStepSize(newStep);
    notify({
      message: `Step size: ${formatStepSize(newStep)}`,
      sr: "polite",
      visual: false,
    });
  };

  const formatStepSize = (step: number): string => {
    if (step === 0) {
      return "Auto (context)";
    }
    const found = STEP_SIZES.find((s) => s.value === step);
    return found ? found.label : `${step} Hz`;
  };

  const handleFrequencyClick = (): void => {
    setIsEditing(true);
    setEditValue((frequency / 1e6).toFixed(3)); // Show in MHz
  };

  const computeAutoStep = (freqHz: number): number => {
    // Broad, understandable defaults based on frequency magnitude
    if (freqHz < 1e6) {
      return 100; // <1 MHz: 100 Hz
    }
    if (freqHz < 30e6) {
      return 1000; // 1–30 MHz: 1 kHz (HF)
    }
    if (freqHz < 300e6) {
      return 10000; // 30–300 MHz: 10 kHz (VHF)
    }
    if (freqHz < 3e9) {
      return 100000; // 300 MHz–3 GHz: 100 kHz (UHF/microwave)
    }
    return 1000000; // 3+ GHz: 1 MHz
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEditValue(e.target.value);
  };

  const handleEditBlur = (): void => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0 && onChange) {
      const newFreq = Math.round(parsed * 1e6); // Convert MHz to Hz
      onChange(newFreq);
      notify({
        message: `Frequency set to ${formatFrequency(newFreq)}`,
        sr: "polite",
        visual: false,
      });
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

      // Global shortcut: Ctrl/Cmd+F focuses frequency input (backing numeric input)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const el = backingInputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
        return;
      }

      // Digit-mode navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveDigit((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveDigit((i) => Math.min(DIGIT_COUNT - 1, i + 1));
        return;
      }

      // Multiplier modifiers
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
        // Prefer digit-mode adjustment; fallback to step size
        adjustAtActiveDigit(1, multiplier);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        adjustAtActiveDigit(-1, multiplier);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        // Coarse tuning step: use a larger multiplier (e.g., ×100 of digit place)
        adjustAtActiveDigit(1, 100);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        adjustAtActiveDigit(-1, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return (): void => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [adjustAtActiveDigit]);

  // Scroll-to-change-digit support
  const digitsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = digitsContainerRef.current;
    if (!el) {
      return;
    }
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const direction: 1 | -1 = e.deltaY > 0 ? -1 : 1; // up: increase
      adjustAtActiveDigit(direction);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return (): void => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [adjustAtActiveDigit]);

  return (
    <div className="frequency-display" role="region" aria-label="VFO Control">
      <h2 className="visually-hidden">Frequency Control</h2>

      <div className="frequency-value">
        {/* Backing numeric input (Hz) for keyboard-driven tests and focus shortcut. Visually hidden but focusable. */}
        <input
          ref={backingInputRef}
          id="frequency-backing-hz"
          type="number"
          className="visually-hidden"
          aria-label="Frequency"
          value={frequency}
          step={1000}
          onKeyDown={(e): void => {
            if (!onChange) {return;}
            if (e.key === "PageUp") {
              e.preventDefault();
              onChange(Math.max(0, Math.round(frequency + 100000)));
            } else if (e.key === "PageDown") {
              e.preventDefault();
              onChange(Math.max(0, Math.round(frequency - 100000)));
            }
          }}
          onChange={(e): void => {
            const next = parseFloat(e.target.value);
            if (!Number.isNaN(next) && onChange) {
              onChange(Math.max(0, Math.round(next)));
            }
          }}
        />
        {/* Visually hidden full formatted value for screen readers and tests */}
        <span className="visually-hidden">{formatFrequency(frequency)}</span>
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
          <div
            className="frequency-digits rad-font-mono rad-tabular-nums"
            ref={digitsContainerRef}
            role="group"
            aria-label={`Current frequency: ${formatFrequency(frequency)}. Use Left/Right to choose digit, Up/Down or scroll to adjust.`}
            title="Click a digit to select; Left/Right to move, Up/Down or scroll to adjust. Click to edit full value."
            onDoubleClick={handleFrequencyClick}
            style={{ cursor: "ns-resize", userSelect: "none" }}
          >
            {renderDigits(frequency, activeDigit, setActiveDigit)}
            <span style={{ marginLeft: 6, opacity: 0.8 }}>MHz</span>
          </div>
        )}
      </div>

      <div className="vfo-controls" role="group" aria-label="Tuning controls">
        <button
          className="tune-button"
          onClick={(): void =>
            handleTune(stepSize === 0 ? computeAutoStep(frequency) : stepSize)
          }
          aria-label="Tune up"
          title="Tune up (Keyboard: Up arrow)"
        >
          ▲
        </button>

        <button
          className="tune-button"
          onClick={(): void =>
            handleTune(
              -(stepSize === 0 ? computeAutoStep(frequency) : stepSize),
            )
          }
          aria-label="Tune down"
          title="Tune down (Keyboard: Down arrow)"
        >
          ▼
        </button>

        <select
          aria-label="Tuning step size"
          value={stepSize}
          onChange={handleStepChange}
          title="Auto picks a contextual step based on the current frequency band"
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

// Render frequency as MHz with 3 decimals and selectable digits.
function renderDigits(
  frequencyHz: number,
  activeDigit: number,
  setActive: (i: number) => void,
): React.ReactNode {
  // Compute MHz integer and 3 decimal digits (kHz)
  const mhz = Math.floor(frequencyHz / 1e6);
  const khz = Math.floor((frequencyHz % 1e6) / 1e3); // 0..999

  const intStr = mhz.toString().padStart(3, "0").slice(-3); // show last 3 digits for MHz
  const decStr = khz.toString().padStart(3, "0");

  // Mapping activeDigit indices to visual positions:
  // 0: 100 MHz, 1: 10 MHz, 2: 1 MHz, 3: 100 kHz, 4: 10 kHz, 5: 1 kHz
  const makeDigit = (
    ch: string,
    idx: number,
    mapIndex: number,
  ): React.JSX.Element => (
    <button
      key={`${mapIndex}-${idx}`}
      type="button"
      className={
        "frequency-digit" + (activeDigit === mapIndex ? " active" : "")
      }
      onClick={(): void => setActive(mapIndex)}
      aria-label={`Select ${labelForDigit(mapIndex)} digit`}
      aria-current={activeDigit === mapIndex ? "true" : undefined}
      style={{
        display: "inline-block",
        background: "none",
        border: "none",
        padding: "0 2px",
        margin: 0,
        lineHeight: 1.2,
        borderBottom:
          activeDigit === mapIndex
            ? "2px solid var(--rad-accent, #5aa3e8)"
            : "2px solid transparent",
        cursor: "ns-resize",
      }}
    >
      {ch}
    </button>
  );

  const nodes: React.ReactNode[] = [];
  // Integer MHz: indices map 0..2 -> active 0..2 (100/10/1 MHz)
  for (let i = 0; i < intStr.length; i++) {
    const mapIndex = i; // 0..2
    nodes.push(makeDigit(intStr.charAt(i), i, mapIndex));
  }
  nodes.push(
    <span key="dot" style={{ padding: "0 2px", opacity: 0.8 }}>
      .
    </span>,
  );
  // Decimal kHz: indices map 0..2 -> active 3..5 (100/10/1 kHz)
  for (let i = 0; i < decStr.length; i++) {
    const mapIndex = 3 + i;
    nodes.push(makeDigit(decStr.charAt(i), i, mapIndex));
  }
  return nodes;
}
