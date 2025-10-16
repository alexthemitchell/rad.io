/**
 * Playback Manager
 *
 * Manages playback of recorded IQ samples, simulating live SDR data streaming.
 * Supports loading recordings from JSON files and controlling playback state.
 *
 * @module playbackManager
 */

import type { IQSample } from "../models/SDRDevice";
import type { Recording, RecordingMetadata } from "./recordingManager";

/**
 * Playback state
 */
export enum PlaybackState {
  IDLE = "IDLE",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
}

/**
 * Playback configuration
 */
export type PlaybackConfig = {
  /** Chunk size for streaming (samples per callback) */
  chunkSize?: number;
  /** Playback speed multiplier (1.0 = real-time) */
  speed?: number;
  /** Loop playback when finished */
  loop?: boolean;
};

/**
 * Playback callback type
 */
export type PlaybackCallback = (samples: IQSample[]) => void;

/**
 * PlaybackManager class for handling recorded IQ sample playback
 */
export class PlaybackManager {
  private recording: Recording | null = null;
  private state: PlaybackState = PlaybackState.IDLE;
  private currentPosition: number = 0;
  private playbackTimer: number | null = null;
  private callback: PlaybackCallback | null = null;
  private config: Required<PlaybackConfig>;

  constructor(config?: PlaybackConfig) {
    this.config = {
      chunkSize: config?.chunkSize || 1024,
      speed: config?.speed || 1.0,
      loop: config?.loop || false,
    };
  }

  /**
   * Load a recording from JSON
   */
  loadRecording(recording: Recording): void {
    this.validateRecording(recording);
    this.recording = recording;
    this.currentPosition = 0;
    this.state = PlaybackState.STOPPED;
  }

  /**
   * Load a recording from JSON string
   */
  loadFromJSON(json: string): void {
    try {
      const recording = JSON.parse(json) as Recording;
      this.loadRecording(recording);
    } catch (error) {
      throw new Error(`Failed to parse recording JSON: ${error}`);
    }
  }

  /**
   * Load a recording from a File object
   */
  async loadFromFile(file: File): Promise<void> {
    const text = await file.text();
    this.loadFromJSON(text);
  }

  /**
   * Start playback
   */
  startPlayback(callback: PlaybackCallback): void {
    if (!this.recording) {
      throw new Error("No recording loaded");
    }

    if (this.state === PlaybackState.PLAYING) {
      return; // Already playing
    }

    this.callback = callback;
    this.state = PlaybackState.PLAYING;
    this.scheduleNextChunk();
  }

  /**
   * Pause playback
   */
  pausePlayback(): void {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }

    this.state = PlaybackState.PAUSED;
    this.clearPlaybackTimer();
  }

  /**
   * Resume playback
   */
  resumePlayback(): void {
    if (this.state !== PlaybackState.PAUSED) {
      return;
    }

    this.state = PlaybackState.PLAYING;
    this.scheduleNextChunk();
  }

  /**
   * Stop playback and reset position
   */
  stopPlayback(): void {
    this.state = PlaybackState.STOPPED;
    this.currentPosition = 0;
    this.clearPlaybackTimer();
    this.callback = null;
  }

  /**
   * Seek to a specific position (0-1 normalized)
   */
  seek(position: number): void {
    if (!this.recording) {
      throw new Error("No recording loaded");
    }

    const normalizedPosition = Math.max(0, Math.min(1, position));
    this.currentPosition = Math.floor(
      normalizedPosition * this.recording.samples.length,
    );
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current playback position (0-1 normalized)
   */
  getPosition(): number {
    if (!this.recording || this.recording.samples.length === 0) {
      return 0;
    }

    return this.currentPosition / this.recording.samples.length;
  }

  /**
   * Get recording metadata
   */
  getMetadata(): RecordingMetadata | null {
    return this.recording?.metadata || null;
  }

  /**
   * Get total duration in seconds
   */
  getDuration(): number {
    return this.recording?.metadata.duration || 0;
  }

  /**
   * Get current playback time in seconds
   */
  getCurrentTime(): number {
    if (!this.recording) {
      return 0;
    }

    return this.currentPosition / this.recording.metadata.sampleRate;
  }

  /**
   * Check if a recording is loaded
   */
  hasRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.state === PlaybackState.PLAYING;
  }

  /**
   * Update playback configuration
   */
  setConfig(config: Partial<PlaybackConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Clear the loaded recording
   */
  clearRecording(): void {
    this.stopPlayback();
    this.recording = null;
    this.state = PlaybackState.IDLE;
  }

  /**
   * Schedule the next chunk of samples for playback
   */
  private scheduleNextChunk(): void {
    if (!this.recording || !this.callback || this.state !== PlaybackState.PLAYING) {
      return;
    }

    const { samples } = this.recording;
    const { chunkSize, speed } = this.config;

    // Get next chunk
    const endPosition = Math.min(this.currentPosition + chunkSize, samples.length);
    const chunk = samples.slice(this.currentPosition, endPosition);

    if (chunk.length === 0) {
      // End of recording
      if (this.config.loop) {
        this.currentPosition = 0;
        this.scheduleNextChunk();
      } else {
        this.stopPlayback();
      }
      return;
    }

    // Send chunk to callback
    this.callback(chunk);
    this.currentPosition = endPosition;

    // Calculate delay for next chunk to simulate real-time streaming
    // delay = (chunk_size / sample_rate) * 1000ms / speed
    const delayMs = (chunkSize / this.recording.metadata.sampleRate) * 1000 / speed;

    this.playbackTimer = window.setTimeout(() => {
      this.scheduleNextChunk();
    }, delayMs);
  }

  /**
   * Clear the playback timer
   */
  private clearPlaybackTimer(): void {
    if (this.playbackTimer !== null) {
      window.clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  /**
   * Validate a recording object
   */
  private validateRecording(recording: Recording): void {
    if (!recording || typeof recording !== "object") {
      throw new Error("Invalid recording: must be an object");
    }

    if (!recording.metadata || typeof recording.metadata !== "object") {
      throw new Error("Invalid recording: missing metadata");
    }

    if (!Array.isArray(recording.samples)) {
      throw new Error("Invalid recording: samples must be an array");
    }

    const { metadata } = recording;
    if (
      typeof metadata.frequency !== "number" ||
      typeof metadata.sampleRate !== "number"
    ) {
      throw new Error("Invalid recording: metadata must include frequency and sampleRate");
    }
  }
}
