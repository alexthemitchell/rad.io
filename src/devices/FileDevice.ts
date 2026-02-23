import { ISDRDevice, SDRDataCallback, SDRGainStage } from './ISDRDevice';
import { type SigmfFixtureBundle } from '../fixtures/sigmf/schema';
import { SDRDiscontinuityCause, SDRDiscontinuityEvent, SDRStreamFrame } from './streamFrame';

type FileDeviceOptions = {
  chunkSizeBytes?: number;
};

export class FileDevice implements ISDRDevice {
  name = 'File Source (SigMF Replay)';

  private readonly fixture: SigmfFixtureBundle;
  private readonly chunkSizeBytes: number;
  private isOpen = false;
  private isStreaming = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private playbackCursor = 0;
  private sampleRateHz: number;
  private sequence = 0;
  private sampleIndex = 0;
  private timestampNs = 0;
  private pendingDiscontinuity: SDRDiscontinuityCause | null = null;
  private lastTickWallClockMs = 0;

  private markDiscontinuity(cause: SDRDiscontinuityCause): void {
    if (this.pendingDiscontinuity === 'restart') {
      return;
    }

    if (cause === 'restart' || this.pendingDiscontinuity === null) {
      this.pendingDiscontinuity = cause;
      return;
    }

    // Keep sample-rate changes sticky until observed by the next frame.
    if (this.pendingDiscontinuity === 'sample_rate_change' && cause === 'retune') {
      return;
    }

    this.pendingDiscontinuity = cause;
  }

  constructor(fixture: SigmfFixtureBundle, options?: FileDeviceOptions) {
    this.fixture = fixture;
    this.sampleRateHz = fixture.metadata.sampleRateHz;

    const requestedChunkSize = options?.chunkSizeBytes ?? 16384;
    if (!Number.isInteger(requestedChunkSize) || requestedChunkSize <= 0 || requestedChunkSize % 2 !== 0) {
      throw new Error('FileDevice chunkSizeBytes must be a positive even integer.');
    }

    this.chunkSizeBytes = requestedChunkSize;
  }

  getGainStages(): SDRGainStage[] {
    return [];
  }

  getFixtureMetadata(): SigmfFixtureBundle['metadata'] {
    return this.fixture.metadata;
  }

  async open(): Promise<void> {
    this.isOpen = true;
    this.playbackCursor = 0;
    this.sequence = 0;
    this.sampleIndex = 0;
    this.timestampNs = 0;
  }

  async close(): Promise<void> {
    await this.stop();
    this.isOpen = false;
  }

  async setFrequency(hz: number): Promise<void> {
    void hz;
    if (this.isStreaming) {
      this.markDiscontinuity('retune');
    }
  }

  async setSampleRate(hz: number): Promise<void> {
    if (hz > 0 && Number.isFinite(hz)) {
      this.sampleRateHz = hz;
      if (this.isStreaming) {
        this.markDiscontinuity('sample_rate_change');
      }
    }
  }

  async setGain(name: string, value: number): Promise<void> {
    void name;
    void value;
  }

  private createChunkView(): DataView {
    const out = new Uint8Array(this.chunkSizeBytes);
    const source = this.fixture.iqData;

    for (let i = 0; i < this.chunkSizeBytes; i += 1) {
      out[i] = source[(this.playbackCursor + i) % source.byteLength];
    }

    this.playbackCursor = (this.playbackCursor + this.chunkSizeBytes) % source.byteLength;
    return new DataView(out.buffer);
  }

  async start(onData: SDRDataCallback): Promise<void> {
    if (!this.isOpen) {
      throw new Error('FileDevice must be opened before start().');
    }

    if (this.isStreaming) {
      return;
    }

    this.isStreaming = true;
    this.markDiscontinuity('restart');

    const complexSamplesPerChunk = this.chunkSizeBytes / 2;
    const chunkIntervalMs = Math.max(1, Math.round((complexSamplesPerChunk / this.sampleRateHz) * 1000));
    this.lastTickWallClockMs = Date.now();

    this.intervalId = setInterval(() => {
      if (!this.isStreaming) {
        return;
      }

      const nowMs = Date.now();
      const elapsedMs = Math.max(0, nowMs - this.lastTickWallClockMs);
      this.lastTickWallClockMs = nowMs;

      const elapsedChunks = Math.max(1, Math.round(elapsedMs / chunkIntervalMs));
      const droppedSamples = (elapsedChunks - 1) * complexSamplesPerChunk;
      if (droppedSamples > 0) {
        this.sampleIndex += droppedSamples;
        this.timestampNs += Math.floor((droppedSamples * 1_000_000_000) / this.sampleRateHz);
      }

      const sequence = this.sequence;
      const sampleIndex = this.sampleIndex;
      const timestampNs = this.timestampNs;

      let discontinuity: SDRDiscontinuityEvent | undefined;
      const cause = this.pendingDiscontinuity ?? (droppedSamples > 0 ? 'dropped_samples' : null);
      if (cause) {
        discontinuity = {
          cause,
          sequence,
          sampleIndex,
          wallClockMs: nowMs,
          droppedSamples: droppedSamples > 0 ? droppedSamples : undefined
        };
        this.pendingDiscontinuity = null;
      }

      const frame: SDRStreamFrame = {
        sequence,
        sampleIndex,
        sampleCount: complexSamplesPerChunk,
        timestampNs,
        sampleRate: this.sampleRateHz,
        droppedSamples,
        discontinuity,
        sampleClock: {
          truthMode: 'unknown'
        }
      };

      onData(this.createChunkView(), frame);

      this.sequence += 1;
      this.sampleIndex += complexSamplesPerChunk;
      this.timestampNs += Math.floor((complexSamplesPerChunk * 1_000_000_000) / this.sampleRateHz);
    }, chunkIntervalMs);
  }

  async stop(): Promise<void> {
    this.isStreaming = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
