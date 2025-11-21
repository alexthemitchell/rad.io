/**
 * VFO Manager Panel
 *
 * Panel component for managing multiple VFOs with audio output selection.
 */

import React from "react";
import { formatFrequency } from "../utils/frequency";
import type { VfoState } from "../types/vfo";

export interface VfoManagerPanelProps {
  /** List of all VFOs */
  vfos: VfoState[];
  /** Callback to update VFO audio state */
  onToggleAudio: (vfoId: string, enabled: boolean) => void;
  /** Callback to remove a VFO */
  onRemove: (vfoId: string) => void;
  /** Callback when user clicks on a VFO (optional) */
  onSelect?: (vfoId: string) => void;
}

/**
 * VFO Manager Panel Component
 */
export function VfoManagerPanel({
  vfos,
  onToggleAudio,
  onRemove,
  onSelect,
}: VfoManagerPanelProps): React.JSX.Element {
  if (vfos.length === 0) {
    return (
      <div className="vfo-manager-panel">
        <h3 className="vfo-panel-title">VFO Manager</h3>
        <div className="vfo-empty-state">
          <p>No VFOs created</p>
          <p style={{ fontSize: "0.875rem", color: "var(--rad-fg-muted)" }}>
            Alt+Click on the waterfall to add a VFO
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="vfo-manager-panel">
      <h3 className="vfo-panel-title">VFO Manager ({vfos.length})</h3>
      <div className="vfo-list">
        {vfos.map((vfo) => (
          <div
            key={vfo.id}
            className="vfo-item"
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
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
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <div className="vfo-item-header">
              <div className="vfo-item-info">
                <span className="vfo-item-mode">
                  {vfo.modeId.toUpperCase()}
                </span>
                <span className="vfo-item-frequency rad-tabular-nums">
                  {formatFrequency(vfo.centerHz)}
                </span>
              </div>
              <button
                className="vfo-item-remove"
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

            <div className="vfo-item-controls">
              <label className="vfo-audio-control">
                <input
                  type="checkbox"
                  checked={vfo.audioEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleAudio(vfo.id, e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Enable audio for VFO at ${formatFrequency(vfo.centerHz)}`}
                />
                <span>Audio Output</span>
              </label>

              {vfo.audioEnabled && (
                <div className="vfo-audio-indicator">
                  <span
                    className="audio-active-badge"
                    aria-label="Audio active"
                  >
                    🔊
                  </span>
                </div>
              )}
            </div>

            <div className="vfo-item-status">
              <span
                className={`vfo-status-badge vfo-status-${vfo.status}`}
                aria-label={`Status: ${vfo.status}`}
              >
                {vfo.status}
              </span>
              {typeof vfo.metrics.rssi === "number" && (
                <span className="vfo-rssi rad-tabular-nums">
                  RSSI: {vfo.metrics.rssi.toFixed(1)} dBFS
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
