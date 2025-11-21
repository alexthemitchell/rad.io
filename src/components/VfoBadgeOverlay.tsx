/**
 * VFO Badge Overlay
 *
 * Displays VFO markers on waterfall/spectrum with mode, frequency, and remove button.
 */

import React from "react";
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
        position: "absolute",
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: "none",
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
            role="button"
            tabIndex={0}
            style={{
              position: "absolute",
              left: `${x}px`,
              top: "10px",
              transform: "translateX(-50%)",
              pointerEvents: "auto",
            }}
            onClick={() => onSelect?.(vfo.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(vfo.id);
              }
            }}
          >
            <div className="vfo-badge-content">
              <span className="vfo-mode">{vfo.modeId.toUpperCase()}</span>
              <span className="vfo-frequency rad-tabular-nums">
                {(vfo.centerHz / 1e6).toFixed(3)}
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
                aria-label={`Remove VFO at ${(vfo.centerHz / 1e6).toFixed(3)} MHz`}
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
