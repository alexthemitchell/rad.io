/**
 * PlaybackControls Component
 *
 * Provides UI controls for playing back recorded IQ samples.
 * Features:
 * - File upload/selection
 * - Play/pause/stop controls
 * - Playback progress indicator
 * - Playback speed control
 *
 * @module PlaybackControls
 */

import { useRef, useState, useEffect } from "react";
import type { PlaybackManager } from "../utils/playbackManager";
import { PlaybackState } from "../utils/playbackManager";
import type { Recording } from "../utils/recordingManager";

export type PlaybackControlsProps = {
  /** PlaybackManager instance */
  playbackManager: PlaybackManager | null;
  /** Whether currently in playback mode */
  isPlaybackMode: boolean;
  /** Callback when playback mode changes */
  onPlaybackModeChange?: (enabled: boolean) => void;
  /** Callback when playback state changes */
  onPlaybackStateChange?: (state: PlaybackState) => void;
};

function PlaybackControls({
  playbackManager,
  isPlaybackMode,
  onPlaybackModeChange,
  onPlaybackStateChange,
}: PlaybackControlsProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    PlaybackState.IDLE,
  );
  const [position, setPosition] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [speed, setSpeed] = useState(1.0);

  // Update position while playing
  useEffect((): (() => void) => {
    if (playbackState !== PlaybackState.PLAYING || !playbackManager) {
      return () => {};
    }

    const interval = setInterval(() => {
      setPosition(playbackManager.getPosition());
    }, 100);

    return () => clearInterval(interval);
  }, [playbackState, playbackManager]);

  // Update state when playback manager state changes
  useEffect((): (() => void) => {
    if (!playbackManager) {
      return () => {};
    }

    const checkState = (): void => {
      const state = playbackManager.getState();
      if (state !== playbackState) {
        setPlaybackState(state);
        onPlaybackStateChange?.(state);
      }
    };

    const interval = setInterval(checkState, 200);
    return () => clearInterval(interval);
  }, [playbackManager, playbackState, onPlaybackStateChange]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !playbackManager) {
      return;
    }

    try {
      await playbackManager.loadFromFile(file);
      const metadata = playbackManager.getMetadata();
      if (metadata) {
        setRecording({
          metadata,
          samples: [], // Don't store all samples in component state
        });
        setPlaybackState(PlaybackState.STOPPED);
        onPlaybackModeChange?.(true);
      }
    } catch (error) {
      console.error("Failed to load recording:", error);
      alert("Failed to load recording file. Please check the file format.");
    }
  };

  const handlePlay = (): void => {
    if (!playbackManager) {
      return;
    }

    if (playbackState === PlaybackState.PAUSED) {
      playbackManager.resumePlayback();
      setPlaybackState(PlaybackState.PLAYING);
    }
  };

  const handlePause = (): void => {
    if (!playbackManager) {
      return;
    }

    playbackManager.pausePlayback();
    setPlaybackState(PlaybackState.PAUSED);
  };

  const handleStop = (): void => {
    if (!playbackManager) {
      return;
    }

    playbackManager.stopPlayback();
    setPlaybackState(PlaybackState.STOPPED);
    setPosition(0);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (!playbackManager) {
      return;
    }

    const newPosition = parseFloat(event.target.value);
    playbackManager.seek(newPosition);
    setPosition(newPosition);
  };

  const handleSpeedChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    if (!playbackManager) {
      return;
    }

    const newSpeed = parseFloat(event.target.value);
    playbackManager.setConfig({ speed: newSpeed });
    setSpeed(newSpeed);
  };

  const handleClose = (): void => {
    if (!playbackManager) {
      return;
    }

    playbackManager.clearRecording();
    setRecording(null);
    setPlaybackState(PlaybackState.IDLE);
    setPosition(0);
    onPlaybackModeChange?.(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isPlaying = playbackState === PlaybackState.PLAYING;
  const isPaused = playbackState === PlaybackState.PAUSED;
  const hasRecording = recording !== null;

  return (
    <div className="playback-controls">
      <div className="playback-file-select">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: "none" }}
          aria-label="Select recording file"
        />
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPlaybackMode && hasRecording}
          title="Load a recorded IQ sample file"
          aria-label="Load recording file"
        >
          <span className="btn-icon">📁</span>
          Load Recording
        </button>

        {hasRecording && (
          <button
            className="btn btn-danger"
            onClick={handleClose}
            title="Close recording and return to live mode"
            aria-label="Close recording"
          >
            <span className="btn-icon">✕</span>
            Close
          </button>
        )}
      </div>

      {hasRecording && recording && (
        <>
          <div className="playback-info">
            <div className="playback-info-item">
              <span className="info-label">Frequency:</span>
              <span className="info-value">
                {(recording.metadata.frequency / 1e6).toFixed(3)} MHz
              </span>
            </div>
            <div className="playback-info-item">
              <span className="info-label">Sample Rate:</span>
              <span className="info-value">
                {(recording.metadata.sampleRate / 1e6).toFixed(1)} MS/s
              </span>
            </div>
            <div className="playback-info-item">
              <span className="info-label">Duration:</span>
              <span className="info-value">
                {formatTime(recording.metadata.duration)}
              </span>
            </div>
          </div>

          <div className="playback-actions">
            <button
              className="btn btn-primary"
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={!hasRecording}
              title={isPlaying ? "Pause playback" : "Start playback"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <span className="btn-icon">{isPlaying ? "⏸" : "▶"}</span>
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleStop}
              disabled={!isPlaying && !isPaused}
              title="Stop playback and reset to beginning"
              aria-label="Stop"
            >
              <span className="btn-icon">⏹</span>
              Stop
            </button>

            <div className="playback-speed">
              <label htmlFor="playback-speed-select">Speed:</label>
              <select
                id="playback-speed-select"
                value={speed}
                onChange={handleSpeedChange}
                aria-label="Playback speed"
              >
                <option value="0.5">0.5×</option>
                <option value="1.0">1.0×</option>
                <option value="2.0">2.0×</option>
                <option value="4.0">4.0×</option>
              </select>
            </div>
          </div>

          <div className="playback-progress">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={position}
              onChange={handleSeek}
              className="playback-slider"
              aria-label="Playback position"
              title={`Position: ${(position * 100).toFixed(1)}%`}
            />
            <div className="playback-time">
              <span className="time-current">
                {formatTime((playbackManager?.getCurrentTime() || 0))}
              </span>
              <span className="time-separator">/</span>
              <span className="time-total">
                {formatTime(recording.metadata.duration)}
              </span>
            </div>
          </div>

          <div
            className="playback-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span
              className={`status-dot ${isPlaying ? "playing" : isPaused ? "paused" : "stopped"}`}
            />
            <span className="status-text">
              {isPlaying ? "Playing" : isPaused ? "Paused" : "Stopped"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default PlaybackControls;
