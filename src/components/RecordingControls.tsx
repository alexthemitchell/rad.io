/**
 * RecordingControls Component
 *
 * Provides UI controls for recording IQ samples from SDR devices.
 * Features:
 * - Start/stop recording button
 * - Recording status indicator
 * - Real-time duration display
 * - Download recorded data
 *
 * @module RecordingControls
 */

import { useEffect, useState } from "react";
import type { RecordingManager } from "../utils/recordingManager";
import { RecordingState } from "../utils/recordingManager";

export type RecordingControlsProps = {
  /** RecordingManager instance */
  recordingManager: RecordingManager | null;
  /** Current frequency in Hz */
  frequency: number;
  /** Current sample rate in Hz */
  sampleRate: number;
  /** Whether device is currently receiving data */
  isReceiving: boolean;
  /** Callback when recording state changes */
  onRecordingStateChange?: (isRecording: boolean) => void;
};

function RecordingControls({
  recordingManager,
  frequency,
  sampleRate,
  isReceiving,
  onRecordingStateChange,
}: RecordingControlsProps): React.JSX.Element {
  const [recordingState, setRecordingState] = useState<RecordingState>(
    RecordingState.IDLE,
  );
  const [duration, setDuration] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);

  // Update duration every second while recording
  useEffect(() => {
    if (recordingState !== RecordingState.RECORDING || !recordingManager) {
      return;
    }

    const interval = setInterval(() => {
      setDuration(recordingManager.getDuration());
      setSampleCount(recordingManager.getSampleCount());
    }, 100);

    return () => clearInterval(interval);
  }, [recordingState, recordingManager]);

  const handleStartRecording = (): void => {
    if (!recordingManager || !isReceiving) {
      return;
    }

    try {
      recordingManager.startRecording(frequency, sampleRate);
      setRecordingState(RecordingState.RECORDING);
      setDuration(0);
      setSampleCount(0);
      onRecordingStateChange?.(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = (): void => {
    if (!recordingManager) {
      return;
    }

    try {
      recordingManager.stopRecording();
      setRecordingState(RecordingState.STOPPED);
      onRecordingStateChange?.(false);
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handleDownload = (): void => {
    if (!recordingManager) {
      return;
    }

    try {
      const blob = recordingManager.exportAsBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Generate filename with timestamp and frequency
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const freqMHz = (frequency / 1e6).toFixed(1);
      a.download = `radio-recording-${freqMHz}MHz-${timestamp}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download recording:", error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSampleCount = (count: number): string => {
    if (count < 1000) {
      return `${count}`;
    } else if (count < 1000000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return `${(count / 1000000).toFixed(1)}M`;
    }
  };

  const isRecording = recordingState === RecordingState.RECORDING;
  const hasRecording =
    recordingState === RecordingState.STOPPED ||
    recordingState === RecordingState.RECORDING;

  return (
    <div className="recording-controls">
      <div className="recording-actions">
        <button
          className={`btn ${isRecording ? "btn-danger" : "btn-primary"}`}
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!isReceiving || !recordingManager}
          title={
            !isReceiving
              ? "Start reception first to enable recording"
              : isRecording
                ? "Stop recording and save data"
                : "Start recording IQ samples"
          }
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          <span className="btn-icon">{isRecording ? "⏹" : "⏺"}</span>
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleDownload}
          disabled={!hasRecording}
          title={
            hasRecording
              ? "Download recording as JSON file"
              : "No recording available to download"
          }
          aria-label="Download recording"
        >
          <span className="btn-icon">⬇</span>
          Download
        </button>
      </div>

      <div className="recording-stats">
        <div
          className="recording-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={`status-dot ${isRecording ? "recording" : recordingState === RecordingState.STOPPED ? "stopped" : "idle"}`}
          />
          <span className="status-text">
            {isRecording
              ? "Recording"
              : recordingState === RecordingState.STOPPED
                ? "Stopped"
                : "Ready"}
          </span>
        </div>

        {hasRecording && (
          <>
            <div className="recording-stat" aria-label="Recording duration">
              <span className="stat-label">Duration:</span>
              <span className="stat-value">{formatDuration(duration)}</span>
            </div>

            <div className="recording-stat" aria-label="Sample count">
              <span className="stat-label">Samples:</span>
              <span className="stat-value">{formatSampleCount(sampleCount)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RecordingControls;
