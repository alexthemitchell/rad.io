/**
 * Recording Controls Component
 *
 * Provides UI controls for recording, saving, loading, and playing back IQ data.
 */

import { useState, useCallback } from "react";
import {
  type IQRecording,
  loadRecordingFromFile,
} from "../utils/iqRecorder";

export type RecordingState = "idle" | "recording" | "playback";

export type RecordingControlsProps = {
  /** Current recording state */
  recordingState: RecordingState;
  /** Whether recording is available (device connected and not in playback) */
  canRecord: boolean;
  /** Whether playback controls are available (recording loaded) */
  canPlayback: boolean;
  /** Whether playback is currently active */
  isPlaying: boolean;
  /** Recording duration in seconds */
  duration: number;
  /** Playback progress (0-1) */
  playbackProgress?: number;
  /** Current playback time in seconds */
  playbackTime?: number;
  /** Sample count in current recording */
  sampleCount: number;
  /** Callback to start recording */
  onStartRecording: () => void;
  /** Callback to stop recording */
  onStopRecording: () => void;
  /** Callback to save current recording */
  onSaveRecording: (filename: string, format: "binary" | "json") => void;
  /** Callback to load a recording file */
  onLoadRecording: (recording: IQRecording) => void;
  /** Callback to start playback */
  onStartPlayback: () => void;
  /** Callback to pause playback */
  onPausePlayback: () => void;
  /** Callback to stop playback and return to live mode */
  onStopPlayback: () => void;
  /** Callback to seek to a position (0-1) */
  onSeek?: (position: number) => void;
};

/**
 * Recording and playback control panel
 */
function RecordingControls({
  recordingState,
  canRecord,
  canPlayback,
  isPlaying,
  duration,
  playbackProgress = 0,
  playbackTime = 0,
  sampleCount,
  onStartRecording,
  onStopRecording,
  onSaveRecording,
  onLoadRecording,
  onStartPlayback,
  onPausePlayback,
  onStopPlayback,
  onSeek,
}: RecordingControlsProps): React.JSX.Element {
  const [saveFilename, setSaveFilename] = useState("");
  const [saveFormat, setSaveFormat] = useState<"binary" | "json">("binary");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Format sample count with thousands separators
  const formatSampleCount = useCallback((count: number): string => {
    return count.toLocaleString();
  }, []);

  // Handle file selection for loading
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {return;}

      try {
        const recording = await loadRecordingFromFile(file);
        onLoadRecording(recording);
      } catch (error) {
        console.error("Failed to load recording:", error);
        alert(
          `Failed to load recording: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // Reset input so the same file can be selected again
      event.target.value = "";
    },
    [onLoadRecording],
  );

  // Handle save button click
  const handleSaveClick = useCallback(() => {
    if (!saveFilename.trim()) {
      alert("Please enter a filename");
      return;
    }
    onSaveRecording(saveFilename, saveFormat);
    setShowSaveDialog(false);
    setSaveFilename("");
  }, [saveFilename, saveFormat, onSaveRecording]);

  // Handle seek on progress bar
  const handleSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const position = x / rect.width;
      onSeek(Math.max(0, Math.min(1, position)));
    },
    [onSeek],
  );

  return (
    <div className="card" aria-label="Recording controls">
      <h3>Recording &amp; Playback</h3>

      {/* Recording Section */}
      <div className="recording-section">
        <div className="recording-info">
          <span className="info-label">Status:</span>
          <span
            className={`status-badge ${recordingState === "recording" ? "recording" : recordingState === "playback" ? "playback" : "idle"}`}
          >
            {recordingState === "recording"
              ? "● Recording"
              : recordingState === "playback"
                ? "▶ Playback"
                : "○ Idle"}
          </span>
        </div>

        <div className="recording-info">
          <span className="info-label">Duration:</span>
          <span className="info-value">{formatTime(duration)}</span>
        </div>

        <div className="recording-info">
          <span className="info-label">Samples:</span>
          <span className="info-value">{formatSampleCount(sampleCount)}</span>
        </div>

        {/* Recording Controls */}
        <div className="button-group">
          {recordingState !== "recording" ? (
            <button
              onClick={onStartRecording}
              disabled={!canRecord}
              className="btn btn-record"
              title={
                canRecord
                  ? "Start recording IQ samples"
                  : "Device must be connected and in live mode to record"
              }
            >
              ● Record
            </button>
          ) : (
            <button
              onClick={onStopRecording}
              className="btn btn-stop"
              title="Stop recording"
            >
              ■ Stop Recording
            </button>
          )}

          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={recordingState === "recording" || sampleCount === 0}
            className="btn btn-secondary"
            title="Save recording to file"
          >
            💾 Save
          </button>

          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            📁 Load
            <input
              type="file"
              accept=".iq,.json"
              onChange={handleFileSelect}
              style={{ display: "none" }}
              aria-label="Load recording file"
            />
          </label>
        </div>
      </div>

      {/* Playback Section */}
      {canPlayback && recordingState === "playback" && (
        <div className="playback-section">
          <div className="playback-controls">
            {!isPlaying ? (
              <button
                onClick={onStartPlayback}
                className="btn btn-primary"
                title="Play recording"
              >
                ▶ Play
              </button>
            ) : (
              <button
                onClick={onPausePlayback}
                className="btn btn-primary"
                title="Pause playback"
              >
                ⏸ Pause
              </button>
            )}

            <button
              onClick={onStopPlayback}
              className="btn btn-secondary"
              title="Stop playback and return to live mode"
            >
              ◼ Stop &amp; Return to Live
            </button>
          </div>

          {/* Progress Bar */}
          <div className="playback-progress-container">
            <div
              className="playback-progress-bar"
              onClick={handleSeek}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleSeek(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }}
              role="progressbar"
              tabIndex={0}
              aria-valuenow={Math.floor(playbackProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Playback progress"
            >
              <div
                className="playback-progress-fill"
                style={{ width: `${playbackProgress * 100}%` }}
              />
            </div>
            <div className="playback-time-display">
              <span>{formatTime(playbackTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div
          className="dialog-overlay"
          onClick={() => setShowSaveDialog(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSaveDialog(false);
            }
          }}
          role="presentation"
          tabIndex={-1}
        >
          <div className="dialog" role="dialog" aria-modal="true">
            <h4>Save Recording</h4>

            <label htmlFor="save-filename">Filename:</label>
            <input
              id="save-filename"
              type="text"
              value={saveFilename}
              onChange={(e) => setSaveFilename(e.target.value)}
              placeholder="my-recording"
            />

            <label htmlFor="save-format">Format:</label>
            <select
              id="save-format"
              value={saveFormat}
              onChange={(e) =>
                setSaveFormat(e.target.value as "binary" | "json")
              }
            >
              <option value="binary">Binary (.iq) - Efficient</option>
              <option value="json">JSON (.json) - Human-readable</option>
            </select>

            <div className="dialog-buttons">
              <button onClick={handleSaveClick} className="btn btn-primary">
                Save
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordingControls;
