import React from "react";

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
 * - Arrow key tuning with modifiers (Shift, Alt for different step sizes)
 * - Direct frequency entry
 *
 * Accessibility:
 * - Keyboard tuning support
 * - Screen reader announcements for frequency changes
 * - Focus management
 *
 * TODO: Integrate with device frequency control
 * TODO: Add tuning controls (up/down buttons, step selector)
 * TODO: Implement keyboard shortcuts (arrows, +/-, shift/alt modifiers)
 * TODO: Add direct frequency input
 * TODO: Add frequency validation
 * TODO: Add accessibility announcements
 */
interface FrequencyDisplayProps {
  frequency?: number; // Frequency in Hz
  onChange?: (frequency: number) => void;
}

function FrequencyDisplay({
  frequency = 0,
  onChange,
}: FrequencyDisplayProps): React.JSX.Element {
  const formatFrequency = (freqHz: number): string => {
    if (freqHz >= 1e9) {
      return `${(freqHz / 1e9).toFixed(6)} GHz`;
    } else if (freqHz >= 1e6) {
      return `${(freqHz / 1e6).toFixed(3)} MHz`;
    } else if (freqHz >= 1e3) {
      return `${(freqHz / 1e3).toFixed(1)} kHz`;
    }
    return `${freqHz.toFixed(0)} Hz`;
  };

  const handleTuneUp = (): void => {
    // TODO: Implement tune up with configurable step size
    if (onChange) {
      onChange(frequency + 1000); // Default 1 kHz step
    }
  };

  const handleTuneDown = (): void => {
    // TODO: Implement tune down with configurable step size
    if (onChange) {
      onChange(frequency - 1000); // Default 1 kHz step
    }
  };

  return (
    <div className="frequency-display" role="region" aria-label="VFO Control">
      <h2 className="visually-hidden">Frequency Control</h2>

      <div
        className="frequency-value"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {/* TODO: Make frequency display editable */}
        <span
          className="frequency-digits"
          aria-label={`Current frequency: ${formatFrequency(frequency)}`}
        >
          {formatFrequency(frequency)}
        </span>
      </div>

      <div className="vfo-controls" role="group" aria-label="Tuning controls">
        <button
          className="tune-button"
          onClick={handleTuneUp}
          aria-label="Tune up"
          title="Tune up (Keyboard: Up arrow)"
        >
          ▲
        </button>

        <button
          className="tune-button"
          onClick={handleTuneDown}
          aria-label="Tune down"
          title="Tune down (Keyboard: Down arrow)"
        >
          ▼
        </button>

        {/* TODO: Step size selector */}
        <select aria-label="Tuning step size" disabled defaultValue="1kHz">
          <option value="1Hz">1 Hz</option>
          <option value="10Hz">10 Hz</option>
          <option value="100Hz">100 Hz</option>
          <option value="1kHz">1 kHz</option>
          <option value="10kHz">10 kHz</option>
          <option value="100kHz">100 kHz</option>
          <option value="1MHz">1 MHz</option>
        </select>
      </div>

      {/* TODO: Direct frequency input */}
      {/* TODO: Keyboard shortcut hints */}
    </div>
  );
}

export default FrequencyDisplay;
