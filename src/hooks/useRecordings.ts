/**
 * useRecordings Hook
 *
 * Manages IQ sample recordings including:
 * - Starting/stopping recordings
 * - Storing samples in memory
 * - Exporting recordings to files
 */

import { useState, useRef, useCallback } from "react";
import { IQSample } from "../models/SDRDevice";
import {
  createIQRecording,
  exportIQRecording,
  downloadFile,
} from "../utils/fileFormats";
import { SignalType } from "../components/SignalTypeSelector";

export type RecordingState = "idle" | "recording" | "paused";

export type RecordingMetadata = {
  centerFrequency: number;
  sampleRate: number;
  signalType?: SignalType;
  deviceInfo?: string;
  description?: string;
};

export function useRecordings(): {
  recordingState: RecordingState;
  recordingDuration: number;
  startRecording: (metadata: RecordingMetadata) => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  addSamples: (samples: IQSample[]) => void;
  exportRecording: (
    filename?: string,
  ) => { sampleCount: number; duration: number; fileSize: number };
  clearRecording: () => void;
  getRecordingInfo: () => {
    state: RecordingState;
    sampleCount: number;
    duration: number;
    metadata: RecordingMetadata | null;
  };
} {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const samplesBuffer = useRef<IQSample[]>([]);
  const startTimeRef = useRef<number>(0);
  const metadataRef = useRef<RecordingMetadata | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Start a new recording
   */
  const startRecording = useCallback((metadata: RecordingMetadata) => {
    samplesBuffer.current = [];
    metadataRef.current = metadata;
    startTimeRef.current = Date.now();
    setRecordingState("recording");
    setRecordingDuration(0);

    // Update duration every 100ms
    durationIntervalRef.current = setInterval(() => {
      setRecordingDuration((Date.now() - startTimeRef.current) / 1000);
    }, 100);
  }, []);

  /**
   * Stop the current recording
   */
  const stopRecording = useCallback(() => {
    setRecordingState("idle");
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Pause the current recording
   */
  const pauseRecording = useCallback(() => {
    setRecordingState("paused");
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Resume a paused recording
   */
  const resumeRecording = useCallback(() => {
    setRecordingState("recording");
    startTimeRef.current = Date.now() - recordingDuration * 1000;

    durationIntervalRef.current = setInterval(() => {
      setRecordingDuration((Date.now() - startTimeRef.current) / 1000);
    }, 100);
  }, [recordingDuration]);

  /**
   * Add samples to the current recording
   */
  const addSamples = useCallback((samples: IQSample[]) => {
    if (recordingState === "recording") {
      samplesBuffer.current.push(...samples);
    }
  }, [recordingState]);

  /**
   * Export the current recording to a file
   */
  const exportRecording = useCallback(
    (filename?: string) => {
      if (!metadataRef.current) {
        throw new Error("No recording metadata available");
      }

      const recording = createIQRecording(samplesBuffer.current, {
        ...metadataRef.current,
        duration: recordingDuration,
      });

      const json = exportIQRecording(recording);
      const defaultFilename = `iq-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      downloadFile(json, filename || defaultFilename, "application/json");

      return {
        sampleCount: samplesBuffer.current.length,
        duration: recordingDuration,
        fileSize: json.length,
      };
    },
    [recordingDuration],
  );

  /**
   * Clear the current recording buffer
   */
  const clearRecording = useCallback(() => {
    samplesBuffer.current = [];
    setRecordingDuration(0);
    setRecordingState("idle");
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Get current recording info
   */
  const getRecordingInfo = useCallback(() => {
    return {
      state: recordingState,
      sampleCount: samplesBuffer.current.length,
      duration: recordingDuration,
      metadata: metadataRef.current,
    };
  }, [recordingState, recordingDuration]);

  return {
    recordingState,
    recordingDuration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    addSamples,
    exportRecording,
    clearRecording,
    getRecordingInfo,
  };
}
