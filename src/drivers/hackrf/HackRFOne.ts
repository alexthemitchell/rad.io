import { Config } from "./core/config";
import { MemoryManager } from "./core/memory";
import { Recovery } from "./core/recovery";
import { Stream } from "./core/stream";
import { Transport } from "./core/transport";
import {
  DeviceState,
  type DeviceStateProvider,
  type HackRFConfigurationStatus,
  type HackRFMemoryInfo,
  type HackRFStreamValidation,
} from "./core/types";

export class HackRFOne implements DeviceStateProvider {
  private transport: Transport;
  private config: Config;
  private stream: Stream;
  private recovery: Recovery;
  private memory: MemoryManager;

  private _state: DeviceState = DeviceState.IDLE;

  constructor(usbDevice: USBDevice) {
    this.transport = new Transport(usbDevice, this);
    this.config = new Config(this.transport);
    this.memory = new MemoryManager();
    this.recovery = new Recovery(this.transport, this.config);
    this.stream = new Stream(
      this.transport,
      this.config,
      this.memory,
      this.recovery,
      this,
    );

    const stream = this.stream;
    this.config.setStreamOps({
      get isStreaming() {
        return stream.streaming;
      },
      stopRx: async () => {
        await stream.stopRx();
      },
    });
  }

  get state(): DeviceState {
    return this._state;
  }

  set state(value: DeviceState) {
    this._state = value;
  }

  // Internal state accessors for testing compatibility
  get streaming(): boolean {
    return this.stream.streaming;
  }

  set streaming(value: boolean) {
    this.stream.streaming = value;
  }

  get closing(): boolean {
    return this.transport.closing;
  }

  set closing(value: boolean) {
    this.transport.closing = value;
  }

  async open(): Promise<void> {
    await this.transport.open(this.recovery.wasCleanClosed);
    this.state = DeviceState.CONFIGURING;
    try {
      this.recovery.wasCleanClosed = false;
      await this.config.performInitializationSequence();
    } finally {
      this.state = DeviceState.IDLE;
    }
  }

  async close(): Promise<void> {
    await this.stream.stopRx();
    await this.transport.close();
    this.recovery.wasCleanClosed = true;
  }

  async setFrequency(frequency: number): Promise<void> {
    await this.config.setFrequency(frequency);
  }

  getFrequency(): number | null {
    return this.config.lastFrequency;
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    await this.config.setSampleRate(sampleRate);
  }

  getSampleRate(): number | null {
    return this.config.lastSampleRate;
  }

  async setBandwidth(bandwidthHz: number): Promise<void> {
    await this.config.setBandwidth(bandwidthHz);
  }

  getBandwidth(): number | null {
    return this.config.lastBandwidth;
  }

  async setLNAGain(gain: number): Promise<void> {
    await this.config.setLNAGain(gain);
  }

  getLNAGain(): number | null {
    return this.config.lastLNAGain;
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    await this.config.setAmpEnable(enabled);
  }

  getAmpEnabled(): boolean {
    return this.config.lastAmpEnabled;
  }

  async receive(callback?: (data: DataView) => void): Promise<void> {
    await this.stream.receive(callback);
  }

  async stopRx(): Promise<void> {
    await this.stream.stopRx();
  }

  async reset(): Promise<void> {
    await this.recovery.reset();
  }

  async fastRecovery(): Promise<void> {
    this.state = DeviceState.RECOVERING;
    try {
      await this.recovery.fastRecovery();
    } finally {
      this.state = DeviceState.IDLE;
    }
  }

  getConfigurationStatus(): HackRFConfigurationStatus {
    return {
      isOpen: this.transport.usbDevice.opened,
      isStreaming: this.stream.streaming,
      isClosing: this.transport.closing,
      sampleRate: this.config.lastSampleRate,
      frequency: this.config.lastFrequency,
      bandwidth: this.config.lastBandwidth,
      lnaGain: this.config.lastLNAGain,
      ampEnabled: this.config.lastAmpEnabled,
      isConfigured:
        this.config.lastSampleRate !== null && this.config.configuredOnce,
    };
  }

  validateReadyForStreaming(): HackRFStreamValidation {
    return this.stream.validateReadyForStreaming();
  }

  getMemoryInfo(): HackRFMemoryInfo {
    return this.memory.getMemoryInfo();
  }

  clearBuffers(): void {
    this.memory.clearBuffers();
  }
}
