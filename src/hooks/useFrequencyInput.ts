import { useCallback } from "react";
import type { SignalType } from "../components/SignalTypeSelector";
import type { ChangeEvent, KeyboardEvent } from "react";

/**
 * Frequency bounds configuration for a signal type
 */
export interface FrequencyBounds {
  /** Minimum frequency in the display unit (MHz for FM, kHz for AM) */
  min: number;
  /** Maximum frequency in the display unit (MHz for FM, kHz for AM) */
  max: number;
  /** Fine step size in the display unit */
  step: number;
  /** Coarse step size (for Page Up/Down) in the display unit */
  coarseStep: number;
  /** Unit label (MHz or kHz) */
  unit: string;
  /** Conversion factor from Hz to display unit */
  conversionFactor: number;
}

/**
 * Options for the useFrequencyInput hook
 */
export interface UseFrequencyInputOptions {
  /** Current frequency in Hz */
  frequency: number;
  /** Signal type (FM or AM) */
  signalType: SignalType;
  /** Callback to set frequency (in Hz) */
  setFrequency: (frequencyHz: number) => Promise<void>;
}

/**
 * Result from useFrequencyInput hook
 */
export interface UseFrequencyInputResult {
  /** Display value for the input (in MHz or kHz) */
  displayValue: number;
  /** Minimum value for validation */
  min: number;
  /** Maximum value for validation */
  max: number;
  /** Step size for the input */
  step: number;
  /** Unit label */
  unit: string;
  /** Tooltip text for the input */
  tooltip: string;
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Hint text for screen readers */
  hint: string;
  /** Handler for input change events */
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Handler for keyboard navigation */
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Default frequency bounds for FM broadcast
 */
const FM_BOUNDS: FrequencyBounds = {
  min: 88.1,
  max: 107.9,
  step: 0.1,
  coarseStep: 1.0, // 10x the fine step for Page Up/Down navigation
  unit: "MHz",
  conversionFactor: 1e6,
};

/**
 * Default frequency bounds for AM broadcast
 */
const AM_BOUNDS: FrequencyBounds = {
  min: 530,
  max: 1700,
  step: 10,
  coarseStep: 100, // 10x the fine step for Page Up/Down navigation
  unit: "kHz",
  conversionFactor: 1e3,
};

/**
 * Get frequency bounds for a given signal type
 * P25 uses the same bounds as FM (VHF/UHF bands)
 */
function getBounds(signalType: SignalType): FrequencyBounds {
  return signalType === "AM" ? AM_BOUNDS : FM_BOUNDS;
}

/**
 * Custom hook to manage frequency input with signal type-aware conversion and validation
 *
 * Encapsulates the business logic for:
 * - Converting between Hz and display units (MHz/kHz)
 * - Validating frequency bounds
 * - Handling keyboard navigation (Arrow keys, Page Up/Down)
 * - Formatting display values
 * - Providing accessibility attributes
 *
 * @param options Configuration options
 * @returns Frequency input handlers and values
 */
export function useFrequencyInput(
  options: UseFrequencyInputOptions,
): UseFrequencyInputResult {
  const { frequency, signalType, setFrequency } = options;
  const bounds = getBounds(signalType);

  /**
   * Handle input change events
   */
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const numValue = Number(e.target.value);
      const frequencyHz = numValue * bounds.conversionFactor;
      setFrequency(frequencyHz).catch((error: unknown) => {
        console.error("useFrequencyInput: Failed to set frequency", error, {
          requestedFrequency: frequencyHz,
          signalType,
          inputValue: e.target.value,
        });
      });
    },
    [bounds.conversionFactor, setFrequency, signalType],
  );

  /**
   * Handle keyboard navigation for frequency tuning
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      const currentValue = frequency / bounds.conversionFactor;
      let newValue: number;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        newValue = currentValue + bounds.step;
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        newValue = currentValue - bounds.step;
      } else if (e.key === "PageUp") {
        e.preventDefault();
        newValue = currentValue + bounds.coarseStep;
      } else if (e.key === "PageDown") {
        e.preventDefault();
        newValue = currentValue - bounds.coarseStep;
      } else {
        return; // Let other keys work normally
      }

      newValue = Math.max(bounds.min, Math.min(bounds.max, newValue));
      const frequencyHz = newValue * bounds.conversionFactor;

      setFrequency(frequencyHz).catch((error: unknown) => {
        console.error(
          "useFrequencyInput: Failed to set frequency via keyboard",
          error,
          {
            requestedFrequency: frequencyHz,
            signalType,
            key: e.key,
            bounds: { min: bounds.min, max: bounds.max },
          },
        );
      });
    },
    [frequency, bounds, setFrequency, signalType],
  );

  const displayValue = frequency / bounds.conversionFactor;
  const precision = signalType === "FM" ? 1 : 0;

  const tooltip =
    signalType === "FM"
      ? `Enter FM broadcast frequency (${bounds.min}-${bounds.max} ${bounds.unit}). Use arrow keys for fine tuning (±${bounds.step} ${bounds.unit}), Page Up/Down for coarse tuning (±${bounds.coarseStep} ${bounds.unit}), or type to adjust. Popular stations: 88.5 (NPR), 95.5 (Classic Rock), 100.3 (Pop)`
      : `Enter AM broadcast frequency (${bounds.min}-${bounds.max} ${bounds.unit}). Use arrow keys for fine tuning (±${bounds.step} ${bounds.unit}), Page Up/Down for coarse tuning (±${bounds.coarseStep} ${bounds.unit}), or type to adjust. Popular stations: 660 (News), 1010 (Sports), 1450 (Public Radio)`;

  const ariaLabel = `Center frequency in ${bounds.unit}. Range: ${bounds.min} to ${bounds.max} ${bounds.unit}. Current: ${displayValue.toFixed(precision)} ${bounds.unit}. Use arrow keys for fine tuning, Page Up/Down for coarse tuning.`;

  const hint = `Use arrow keys for ${bounds.step} ${bounds.unit} increments, Page Up/Down for ${bounds.coarseStep} ${bounds.unit} increments`;

  return {
    displayValue,
    min: bounds.min,
    max: bounds.max,
    step: bounds.step,
    unit: bounds.unit,
    tooltip,
    ariaLabel,
    hint,
    handleChange,
    handleKeyDown,
  };
}
