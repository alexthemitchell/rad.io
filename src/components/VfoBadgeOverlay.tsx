/**
 * VFO Badge Overlay
 *
 * Displays VFO markers on waterfall/spectrum with mode, frequency, and remove button.
 */

import React from "react";
import { formatFrequency } from "../utils/frequency";
import type { VfoState } from "../types/vfo";

export interface VfoBadgeOverlayProps {
  /** List of active VFOs */
  vfos: VfoState[];
  /** Sample rate in Hz for frequency calculation */
  sampleRate: number;
  /** Hardware center frequency in Hz */
  centerFrequency: number;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Callback when user clicks remove on a VFO */
  onRemove: (vfoId: string) => void;
  /** Callback when user clicks on a VFO badge */
  onSelect?: (vfoId: string) => void;
}

/**
 * Converts frequency to pixel position
 */
function frequencyToPixel(
  freqHz: number,
  centerFreqHz: number,
  sampleRateHz: number,
  widthPx: number,
): number {
  const minFreq = centerFreqHz - sampleRateHz / 2;
  const maxFreq = centerFreqHz + sampleRateHz / 2;
  const normalizedPos = (freqHz - minFreq) / (maxFreq - minFreq);
  return normalizedPos * widthPx;
}

/**
 * VFO Badge Overlay Component
 */
export function VfoBadgeOverlay({
  vfos,
  sampleRate,
  centerFrequency,
  width,
  height,
  onRemove,
  onSelect,
}: VfoBadgeOverlayProps): React.JSX.Element {
  return (
    <div
      className="vfo-badge-overlay"
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {vfos.map((vfo) => {
        const x = frequencyToPixel(
          vfo.centerHz,
          centerFrequency,
          sampleRate,
          width,
        );

        // Skip if VFO is out of visible range
        if (x < 0 || x > width) {
          return null;
        }

        return (
          <div
            key={vfo.id}
            className="vfo-badge"
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            style={{
              left: `${x}px`,
              top: "10px",
            }}
            onClick={onSelect ? (): void => onSelect(vfo.id) : undefined}
            onKeyDown={
              onSelect
                ? (e): void => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(vfo.id);
                    }
                  }
                : undefined
            }
          >
            <div className="vfo-badge-content">
              <span className="vfo-mode">{vfo.modeId.toUpperCase()}</span>
              <span className="vfo-frequency rad-tabular-nums">
                {formatFrequency(vfo.centerHz)}
              </span>
              <button
                className="vfo-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(vfo.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(vfo.id);
                  }
                }}
                aria-label={`Remove VFO at ${formatFrequency(vfo.centerHz)}`}
                title="Remove VFO"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
