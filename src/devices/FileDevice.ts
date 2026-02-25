import {
  DeviceGpioPatch,
  DeviceGpioState,
  DeviceFrontEndCorrectionPatch,
  DeviceFrontEndCorrectionState,
  DeviceIqControlPatch,
  DeviceIqControlState,
  DeviceRfPowerPatch,
  DeviceRfPowerState,
  DeviceStateMachineSnapshot,
  DeviceStreamContinuityContract,
  ISDRDevice,
  SDRDataCallback,
  SDRGainStage
} from './ISDRDevice';
import { type SigmfFixtureBundle } from '../fixtures/sigmf/schema';
import { SDRDiscontinuityCause, SDRDiscontinuityEvent, SDRStreamFrame } from './streamFrame';
import { defaultCapabilityModel, type DeviceCapabilityModel } from './CapabilityModel';

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
  private iqControlState: DeviceIqControlState = {
    swapEnabled: false,
    invertEnabled: false,
    implementation: 'dsp'
  };
  private frontEndCorrectionState: DeviceFrontEndCorrectionState = {
    dcOffsetEnabled: false,
    iqBalanceEnabled: false,
    implementation: 'dsp'
  };
  private rfPowerState: DeviceRfPowerState = {
    biasTeeEnabled: false,
    ampEnabled: false
  };
  private gpioState: DeviceGpioState = {
    outputPins: {}
  };
  private state: DeviceStateMachineSnapshot = {
    state: 'idle',
    opened: false,
    streaming: false,
    transitionCount: 0,
    lastEvent: 'init',
    lastTransitionAtIso: new Date(0).toISOString()
  };

  private transitionState(next: DeviceStateMachineSnapshot['state'], event: string): void {
    this.state = {
      ...this.state,
      state: next,
      transitionCount: this.state.transitionCount + 1,
      lastEvent: event,
      lastTransitionAtIso: new Date().toISOString()
    };
  }

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

  getCapabilityModel(): DeviceCapabilityModel {
    return {
      ...defaultCapabilityModel('FILE', this.name),
      supportedSampleRatesHz: [this.fixture.metadata.sampleRateHz],
      supportedAnalogBandwidthsHz: [Math.floor(this.fixture.metadata.sampleRateHz * 0.875)],
      gainStages: [],
      agcControl: 'unsupported',
      loOffsetControl: 'supported',
      basebandFilterControl: 'supported',
      sampleFormat: {
        iqOrder: 'iq',
        sampleType: 'u8',
        interleaved: true,
        normalizedToUnitRange: false,
        invertIQSupported: 'supported',
        swapIQSupported: 'supported'
      },
      iqControl: {
        swap: 'supported',
        invert: 'supported',
        implementation: 'dsp'
      },
      frontEndCorrection: {
        dcOffset: 'supported',
        iqBalance: 'supported',
        implementation: 'dsp'
      }
    };
  }

  getFixtureMetadata(): SigmfFixtureBundle['metadata'] {
    return this.fixture.metadata;
  }

  async open(): Promise<void> {
    this.transitionState('opening', 'open-begin');
    this.isOpen = true;
    this.playbackCursor = 0;
    this.sequence = 0;
    this.sampleIndex = 0;
    this.timestampNs = 0;
    this.state = {
      ...this.state,
      opened: true,
      streaming: false
    };
    this.transitionState('open', 'open-complete');
  }

  async close(): Promise<void> {
    this.transitionState('closing', 'close-begin');
    await this.stop();
    this.isOpen = false;
    this.state = {
      ...this.state,
      opened: false,
      streaming: false
    };
    this.transitionState('idle', 'close-complete');
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
    this.state = {
      ...this.state,
      streaming: true
    };
    this.transitionState('streaming', 'stream-start');
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
    this.state = {
      ...this.state,
      streaming: false
    };
    this.transitionState(this.state.opened ? 'open' : 'idle', 'stream-stop');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getIqControlState(): DeviceIqControlState {
    return { ...this.iqControlState };
  }

  async setIqControlState(patch: DeviceIqControlPatch): Promise<void> {
    this.iqControlState = {
      ...this.iqControlState,
      ...(patch.swapEnabled !== undefined ? { swapEnabled: patch.swapEnabled } : {}),
      ...(patch.invertEnabled !== undefined ? { invertEnabled: patch.invertEnabled } : {})
    };
  }

  getFrontEndCorrectionState(): DeviceFrontEndCorrectionState {
    return { ...this.frontEndCorrectionState };
  }

  async setFrontEndCorrectionState(patch: DeviceFrontEndCorrectionPatch): Promise<void> {
    this.frontEndCorrectionState = {
      ...this.frontEndCorrectionState,
      ...(patch.dcOffsetEnabled !== undefined ? { dcOffsetEnabled: patch.dcOffsetEnabled } : {}),
      ...(patch.iqBalanceEnabled !== undefined ? { iqBalanceEnabled: patch.iqBalanceEnabled } : {})
    };
  }

  getRfPowerState(): DeviceRfPowerState {
    return { ...this.rfPowerState };
  }

  async setRfPowerState(patch: DeviceRfPowerPatch): Promise<void> {
    this.rfPowerState = {
      ...this.rfPowerState,
      ...(patch.biasTeeEnabled !== undefined ? { biasTeeEnabled: patch.biasTeeEnabled } : {}),
      ...(patch.ampEnabled !== undefined ? { ampEnabled: patch.ampEnabled } : {})
    };
  }

  getGpioState(): DeviceGpioState {
    return {
      outputPins: { ...this.gpioState.outputPins }
    };
  }

  async setGpioState(patch: DeviceGpioPatch): Promise<void> {
    if (!patch.outputPins) {
      return;
    }

    this.gpioState = {
      outputPins: {
        ...this.gpioState.outputPins,
        ...patch.outputPins
      }
    };
  }

  getStateMachineSnapshot(): DeviceStateMachineSnapshot {
    return { ...this.state };
  }

  getStreamContinuityContract(): DeviceStreamContinuityContract {
    return {
      timestampModel: 'monotonic-with-explicit-gaps',
      sampleIndexModel: 'continuous-with-gap-accounting',
      glitchlessOperations: ['gain_change'],
      discontinuityOperations: [
        { operation: 'start', cause: 'restart' },
        { operation: 'retune', cause: 'retune' },
        { operation: 'sample_rate_change', cause: 'sample_rate_change' }
      ],
      emittedDiscontinuityCauses: ['restart', 'retune', 'sample_rate_change', 'dropped_samples']
    };
  }
}
