import React from "react";
import type { SignalType } from "./SignalTypeSelector";

export interface AudioControlsProps {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current volume (0-1) */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Signal type for demodulation */
  signalType: SignalType;
  /** Whether audio playback is available (device connected) */
  isAvailable: boolean;
  /** Callback when play/pause is clicked */
  onTogglePlay: () => void;
  /** Callback when volume changes */
  onVolumeChange: (volume: number) => void;
  /** Callback when mute is toggled */
  onToggleMute: () => void;
}

/**
 * Audio playback controls for SDR receiver
 *
 * Provides volume control, play/pause, and mute functionality
 * for real-time audio demodulation from IQ samples.
 */
export default function AudioControls({
  isPlaying,
  volume,
  isMuted,
  signalType,
  isAvailable,
  onTogglePlay,
  onVolumeChange,
  onToggleMute,
}: AudioControlsProps): React.JSX.Element {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  };

  const displayVolume = isMuted ? 0 : Math.round(volume * 100);

  return (
    <div
      className="audio-controls"
      role="group"
      aria-label="Audio playback controls"
    >
      <div className="audio-controls-row">
        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          disabled={!isAvailable}
          className="btn btn-audio"
          title={
            !isAvailable
              ? "Connect device and start reception to enable audio"
              : isPlaying
                ? `Pause ${signalType} audio demodulation`
                : `Play ${signalType} audio demodulation`
          }
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? "⏸ Pause Audio" : "▶ Play Audio"}
        </button>

        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          disabled={!isAvailable}
          className="btn btn-mute"
          title={isMuted ? "Unmute audio" : "Mute audio"}
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        {/* Volume Control */}
        <div className="volume-control">
          <label htmlFor="audio-volume" className="volume-label">
            Volume:
          </label>
          <input
            id="audio-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            disabled={!isAvailable}
            className="volume-slider"
            aria-label="Audio volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayVolume}
            aria-valuetext={`${displayVolume} percent`}
          />
          <span className="volume-display" aria-live="polite">
            {displayVolume}%
          </span>
        </div>
      </div>

      {/* Status Information (live region without additional status role to avoid duplicates) */}
      <div className="audio-status" aria-live="polite">
        {isPlaying ? (
          <span className="audio-status-active">
            🎵 Playing {signalType} audio
          </span>
        ) : (
          <span className="audio-status-inactive">Audio paused</span>
        )}
      </div>
    </div>
  );
}
