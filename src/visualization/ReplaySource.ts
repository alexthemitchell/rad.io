/**
 * ReplaySource - DataSource implementation for playing back recorded IQ data
 *
 * This class wraps the IQPlayback functionality and implements the DataSource
 * interface, allowing recorded data to be used with visualizations in the same
 * way as live or simulated sources.
 */

import { type IQSample } from "../models/SDRDevice";
import { IQPlayback, type IQRecording } from "../utils/iqRecorder";
import { type DataSource, type DataSourceMetadata } from "./interfaces";

/**
 * ReplaySource provides deterministic playback of recorded IQ data.
 * Perfect for testing, demos, and analyzing captured signals.
 */
export class ReplaySource implements DataSource {
  private playback: IQPlayback | null = null;
  private recording: IQRecording;
  private samplesPerChunk: number;
  private callback: ((samples: IQSample[]) => void) | null = null;

  /**
   * Create a replay source from a recording
   * @param recording - The IQ recording to play back
   * @param samplesPerChunk - Number of samples to deliver per callback (default: 32768)
   */
  constructor(recording: IQRecording, samplesPerChunk = 32768) {
    this.recording = recording;
    this.samplesPerChunk = samplesPerChunk;
  }

  async startStreaming(callback: (samples: IQSample[]) => void): Promise<void> {
    if (this.playback?.getIsPlaying()) {
      return Promise.resolve();
    }

    this.callback = callback;
    this.playback = new IQPlayback(
      this.recording,
      callback,
      this.samplesPerChunk,
    );
    this.playback.start();

    return Promise.resolve();
  }

  async stopStreaming(): Promise<void> {
    if (this.playback) {
      this.playback.stop();
      this.playback.cleanup();
      this.playback = null;
    }
    this.callback = null;

    return Promise.resolve();
  }

  isStreaming(): boolean {
    return this.playback?.getIsPlaying() ?? false;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getMetadata(): Promise<DataSourceMetadata> {
    const metadata = this.recording.metadata;
    return {
      name: "Replay Source",
      sampleRate: metadata.sampleRate,
      centerFrequency: metadata.frequency,
      signalType: metadata.signalType,
      deviceName: metadata.deviceName,
      timestamp: metadata.timestamp,
      duration: metadata.duration,
    };
  }

  /**
   * Pause playback without stopping
   */
  pause(): void {
    this.playback?.pause();
  }

  /**
   * Resume playback after pause
   */
  resume(): void {
    if (this.playback && !this.playback.getIsPlaying() && this.callback) {
      this.playback.start();
    }
  }

  /**
   * Get current playback progress (0-1)
   */
  getProgress(): number {
    return this.playback?.getProgress() ?? 0;
  }

  /**
   * Get current playback time in seconds
   */
  getCurrentTime(): number {
    return this.playback?.getCurrentTime() ?? 0;
  }

  /**
   * Seek to a specific position in the recording (0-1)
   */
  seek(position: number): void {
    this.playback?.seek(position);
  }

  /**
   * Get the underlying recording
   */
  getRecording(): IQRecording {
    return this.recording;
  }
}
