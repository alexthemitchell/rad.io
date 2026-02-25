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
} from '../ISDRDevice';
import { defaultCapabilityModel, type DeviceCapabilityModel, type SdrSourceType } from '../CapabilityModel';
import type { SDRDiscontinuityCause, SDRDiscontinuityEvent, SDRStreamFrame } from '../streamFrame';
import {
  acknowledgeBridgeFrames,
  canSendBridgeFrame,
  enqueueBridgeFrame,
  negotiateBridgeRate,
  type BridgeFlowWindow,
  type BridgeRateNegotiationResult
} from './bridgeBackpressure';
import {
  buildHandshakeResponse,
  createHandshakeRequest,
  type BridgeCapabilityDescriptor,
  type BridgeTransportSecurityMode
} from './bridgeProtocol';
import { issueBridgeToken, validateBridgeToken } from './bridgeAuth';

export type BridgeDeviceConfig = {
  sourceType: SdrSourceType;
  name: string;
  bridgePeerId: string;
  secret: string;
  capabilityDescriptors: BridgeCapabilityDescriptor[];
  requestedCapabilities: string[];
  supportedSampleRatesHz: number[];
  supportedAnalogBandwidthsHz: number[];
  gainStages: SDRGainStage[];
  capabilityModelPatch?: Omit<
    Partial<DeviceCapabilityModel>,
    'sourceType' | 'deviceName' | 'supportedSampleRatesHz' | 'supportedAnalogBandwidthsHz' | 'gainStages'
  >;
  initialFrequencyHz: number;
  initialSampleRateHz: number;
  dataPlaneLatencyMs?: number;
  availableBufferFrames?: number;
  securityMode?: BridgeTransportSecurityMode;
  sampleType?: DeviceCapabilityModel['sampleFormat']['sampleType'];
  iqOrder?: DeviceCapabilityModel['sampleFormat']['iqOrder'];
};

export abstract class BridgeBackedDevice implements ISDRDevice {
  readonly name: string;

  private readonly config: BridgeDeviceConfig;
  private readonly blockIntervalMs: number;

  private isOpen = false;
  private isStreaming = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private frequencyHz: number;
  private sampleRateHz: number;
  private gainState: Record<string, number>;

  private sequence = 0;
  private sampleIndex = 0;
  private timestampNs = 0;
  private pendingDiscontinuity: SDRDiscontinuityCause | null = null;
  private lastTickWallClockMs = 0;

  private bridgeAuthenticated = false;
  private flowWindow: BridgeFlowWindow = { capacityFrames: 4, inFlightFrames: 0 };
  private negotiated: BridgeRateNegotiationResult | null = null;
  private tokenExpiresAt = 0;
  private trace: string[] = [];

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

  protected constructor(config: BridgeDeviceConfig) {
    this.config = config;
    this.name = config.name;
    this.frequencyHz = config.initialFrequencyHz;
    this.sampleRateHz = config.initialSampleRateHz;
    this.blockIntervalMs = Math.max(5, Math.round(config.dataPlaneLatencyMs ?? 25));
    this.gainState = Object.fromEntries(config.gainStages.map((stage) => [stage.name, stage.value]));
  }

  protected getBridgeSecurityMode(): BridgeTransportSecurityMode {
    return this.config.securityMode ?? 'paired-token';
  }

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

    if (this.pendingDiscontinuity === 'sample_rate_change' && cause === 'retune') {
      return;
    }

    this.pendingDiscontinuity = cause;
  }

  private negotiateDataPlane(): void {
    this.negotiated = negotiateBridgeRate({
      requestedIqRateHz: this.sampleRateHz,
      maxLatencyMs: this.blockIntervalMs,
      availableBufferFrames: this.config.availableBufferFrames ?? 8
    });
    this.flowWindow = {
      capacityFrames: this.negotiated.frameBatchSize,
      inFlightFrames: 0
    };
    this.trace.push(`rate-negotiated:${this.negotiated.selectedIqRateHz}:${this.negotiated.recommendation}`);
  }

  getGainStages(): SDRGainStage[] {
    return this.config.gainStages.map((stage) => ({
      ...stage,
      value: this.gainState[stage.name] ?? stage.value
    }));
  }

  getCapabilityModel(): DeviceCapabilityModel {
    const sampleType = this.config.sampleType ?? 'i16';
    const iqOrder = this.config.iqOrder ?? 'iq';

    return {
      ...defaultCapabilityModel(this.config.sourceType, this.name),
      supportedSampleRatesHz: [...this.config.supportedSampleRatesHz],
      supportedAnalogBandwidthsHz: [...this.config.supportedAnalogBandwidthsHz],
      gainStages: this.config.gainStages.map((stage, index) => ({
        name: stage.name,
        min: stage.min,
        max: stage.max,
        step: stage.step,
        order: index + 1
      })),
      sampleFormat: {
        iqOrder,
        sampleType,
        interleaved: true,
        normalizedToUnitRange: sampleType === 'f32',
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
      },
      ...(this.config.capabilityModelPatch ?? {})
    };
  }

  async open(): Promise<void> {
    if (this.isOpen) {
      return;
    }

    this.transitionState('opening', 'open-begin');

    const handshake = createHandshakeRequest(
      `${this.name} adapter`,
      this.config.requestedCapabilities,
      this.getBridgeSecurityMode()
    );
    const response = buildHandshakeResponse(handshake, this.config.capabilityDescriptors);
    if (!response.accepted) {
      this.transitionState('error', 'handshake-rejected');
      throw new Error(`Bridge handshake rejected: ${response.reason ?? 'unknown'}`);
    }
    this.trace.push(`handshake-accepted:v${response.version}`);

    const now = Date.now();
    if (response.requiresToken) {
      const token = issueBridgeToken({
        peerId: this.config.bridgePeerId,
        nowUnixMs: now,
        ttlMs: 30_000,
        secret: this.config.secret
      });
      const verdict = validateBridgeToken(token, now, this.config.secret);
      if (!verdict.valid) {
        this.transitionState('error', 'token-invalid');
        throw new Error(`Bridge token rejected: ${verdict.reason ?? 'unknown'}`);
      }
      this.bridgeAuthenticated = true;
      this.tokenExpiresAt = token.expiresAtUnixMs;
      this.trace.push('token-valid');
    } else {
      this.bridgeAuthenticated = true;
      this.tokenExpiresAt = now + 30_000;
      this.trace.push('token-not-required');
    }

    this.negotiateDataPlane();

    this.isOpen = true;
    this.state = {
      ...this.state,
      opened: true,
      streaming: false
    };
    this.transitionState('open', 'open-complete');
  }

  async close(): Promise<void> {
    if (!this.isOpen && !this.isStreaming) {
      return;
    }

    this.transitionState('closing', 'close-begin');
    await this.stop();
    this.isOpen = false;
    this.bridgeAuthenticated = false;
    this.state = {
      ...this.state,
      opened: false,
      streaming: false
    };
    this.transitionState('idle', 'close-complete');
  }

  async setFrequency(hz: number): Promise<void> {
    this.frequencyHz = Math.max(1, Math.round(hz));
    if (this.isStreaming) {
      this.markDiscontinuity('retune');
    }
  }

  async setSampleRate(hz: number): Promise<void> {
    if (!Number.isFinite(hz) || hz <= 0) {
      throw new Error(`Invalid sample rate: ${hz}`);
    }

    this.sampleRateHz = Math.round(hz);
    this.negotiateDataPlane();
    if (this.isStreaming) {
      this.markDiscontinuity('sample_rate_change');
    }
  }

  async setGain(name: string, value: number): Promise<void> {
    const stage = this.config.gainStages.find((entry) => entry.name === name);
    if (!stage) {
      throw new Error(`Unknown gain stage: ${name}`);
    }

    const clamped = Math.max(stage.min, Math.min(stage.max, value));
    this.gainState[name] = clamped;
  }

  private samplePayloadBytesPerComplexSample(): number {
    switch (this.config.sampleType ?? 'i16') {
      case 'i8':
      case 'u8':
        return 2;
      case 'f32':
        return 8;
      case 'i16':
      default:
        return 4;
    }
  }

  private buildPayload(complexSamples: number): DataView {
    const bytesPerComplexSample = this.samplePayloadBytesPerComplexSample();
    const payload = new Uint8Array(complexSamples * bytesPerComplexSample);

    for (let sample = 0; sample < complexSamples; sample += 1) {
      const t = (this.sampleIndex + sample) / this.sampleRateHz;
      const tone = Math.sin(2 * Math.PI * 1_500 * t + this.frequencyHz / 1_000_000);
      const quadrature = Math.cos(2 * Math.PI * 1_500 * t + this.frequencyHz / 1_000_000);

      if ((this.config.sampleType ?? 'i16') === 'i8') {
        payload[sample * 2] = (Math.round((tone * 0.6 + 1) * 127.5) & 0xff);
        payload[sample * 2 + 1] = (Math.round((quadrature * 0.6 + 1) * 127.5) & 0xff);
        continue;
      }

      if ((this.config.sampleType ?? 'i16') === 'u8') {
        payload[sample * 2] = Math.round((tone * 0.5 + 0.5) * 255);
        payload[sample * 2 + 1] = Math.round((quadrature * 0.5 + 0.5) * 255);
        continue;
      }

      if ((this.config.sampleType ?? 'i16') === 'f32') {
        const view = new DataView(payload.buffer);
        view.setFloat32(sample * 8, tone, true);
        view.setFloat32(sample * 8 + 4, quadrature, true);
        continue;
      }

      const view = new DataView(payload.buffer);
      view.setInt16(sample * 4, Math.round(tone * 12_000), true);
      view.setInt16(sample * 4 + 2, Math.round(quadrature * 12_000), true);
    }

    return new DataView(payload.buffer);
  }

  async start(onData: SDRDataCallback): Promise<void> {
    if (!this.isOpen) {
      throw new Error(`${this.name} bridge must be open before start().`);
    }

    if (!this.bridgeAuthenticated || Date.now() >= this.tokenExpiresAt) {
      this.transitionState('error', 'auth-expired');
      throw new Error('Bridge session authentication expired. Re-open device.');
    }

    if (this.isStreaming) {
      return;
    }

    if (!this.negotiated) {
      this.negotiateDataPlane();
    }

    this.isStreaming = true;
    this.state = {
      ...this.state,
      streaming: true
    };
    this.transitionState('streaming', 'stream-start');
    this.markDiscontinuity('restart');
    this.lastTickWallClockMs = Date.now();

    const complexSamplesPerFrame = Math.max(
      64,
      Math.round((this.sampleRateHz * this.blockIntervalMs) / 1000)
    );

    this.intervalId = setInterval(() => {
      if (!this.isStreaming) {
        return;
      }

      const nowMs = Date.now();
      const elapsedMs = Math.max(0, nowMs - this.lastTickWallClockMs);
      this.lastTickWallClockMs = nowMs;

      const elapsedFrames = Math.max(1, Math.round(elapsedMs / this.blockIntervalMs));
      const droppedSamples = (elapsedFrames - 1) * complexSamplesPerFrame;
      if (droppedSamples > 0) {
        this.sampleIndex += droppedSamples;
        this.timestampNs += Math.floor((droppedSamples * 1_000_000_000) / this.sampleRateHz);
      }

      if (!canSendBridgeFrame(this.flowWindow)) {
        this.markDiscontinuity('overflow');
        this.sampleIndex += complexSamplesPerFrame;
        this.timestampNs += Math.floor((complexSamplesPerFrame * 1_000_000_000) / this.sampleRateHz);
        return;
      }

      this.flowWindow = enqueueBridgeFrame(this.flowWindow);
      this.flowWindow = acknowledgeBridgeFrames(this.flowWindow, 1);

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
        sampleCount: complexSamplesPerFrame,
        timestampNs,
        sampleRate: this.sampleRateHz,
        droppedSamples,
        discontinuity,
        sampleClock: {
          truthMode: 'unknown'
        }
      };

      onData(this.buildPayload(complexSamplesPerFrame), frame);

      this.sequence += 1;
      this.sampleIndex += complexSamplesPerFrame;
      this.timestampNs += Math.floor((complexSamplesPerFrame * 1_000_000_000) / this.sampleRateHz);
    }, this.blockIntervalMs);
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
      emittedDiscontinuityCauses: ['restart', 'retune', 'sample_rate_change', 'dropped_samples', 'overflow']
    };
  }

  private redactTraceEntry(entry: string): string {
    let redacted = entry;

    const secretHints = [
      this.config.secret,
      this.config.bridgePeerId,
      this.config.name,
      this.name
    ].filter((hint) => hint.length > 0);

    for (const hint of secretHints) {
      redacted = redacted.split(hint).join('[REDACTED]');
    }

    // Redact key-value diagnostics tokens to avoid leaking auth/session details.
    redacted = redacted.replace(
      /\b(token|secret|credential|auth|peerId|peer_id)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]'
    );

    return redacted;
  }

  protected getBridgeTrace(): string[] {
    return this.trace.map((entry) => this.redactTraceEntry(entry));
  }
}
