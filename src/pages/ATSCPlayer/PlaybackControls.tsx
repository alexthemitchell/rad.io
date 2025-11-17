/**
 * Playback Controls Component
 *
 * Provides controls for playback including stop, volume, mute, and closed captions.
 */

import React from "react";

interface PlaybackControlsProps {
  volume: number;
  muted: boolean;
  closedCaptionsEnabled: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onCCToggle: () => void;
  onStop: () => void;
  disabled: boolean;
}

export function PlaybackControls({
  volume,
  muted,
  closedCaptionsEnabled,
  onVolumeChange,
  onMuteToggle,
  onCCToggle,
  onStop,
  disabled,
}: PlaybackControlsProps): React.JSX.Element {
  return (
    <div className="playback-controls">
      <button
        className="btn btn-danger"
        onClick={onStop}
        disabled={disabled}
        title="Stop playback"
      >
        Stop
      </button>

      <div className="volume-control">
        <button
          className="btn btn-icon"
          onClick={onMuteToggle}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume * 100}
          onChange={(e) => onVolumeChange(parseInt(e.target.value, 10) / 100)}
          disabled={disabled}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
        <span className="volume-label">{Math.round(volume * 100)}%</span>
      </div>

      <button
        className={`btn ${closedCaptionsEnabled ? "btn-primary" : "btn-secondary"}`}
        onClick={onCCToggle}
        disabled={disabled}
        title={
          closedCaptionsEnabled
            ? "Disable closed captions"
            : "Enable closed captions"
        }
      >
        CC
      </button>
    </div>
  );
}
