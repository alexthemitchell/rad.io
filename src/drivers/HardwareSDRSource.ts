import type { ISDRDevice } from "../models/SDRDevice";
import type {
  DataSource,
  Sample,
  DataSourceMetadata,
} from "../visualization/interfaces";

export class HardwareSDRSource implements DataSource {
  private device: ISDRDevice;
  private streaming = false;
  private streamCallback: ((samples: Sample[]) => void) | null = null;

  constructor(device: ISDRDevice) {
    this.device = device;
  }

  async startStreaming(callback: (samples: Sample[]) => void): Promise<void> {
    if (this.streaming) {
      return;
    }

    this.streaming = true;
    this.streamCallback = callback;

    if (!this.device.isOpen()) {
      await this.device.open();
    }

    // Assuming the device has a receive method that takes a callback
    await this.device.receive(this.handleData);
  }

  async stopStreaming(): Promise<void> {
    if (!this.streaming) {
      return;
    }

    this.streaming = false;
    this.streamCallback = null;

    if (this.device.isReceiving()) {
      await this.device.stopRx();
    }
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    const [sampleRate, centerFrequency] = await Promise.all([
      this.device.getSampleRate(),
      this.device.getFrequency(),
    ]);
    return {
      name: this.device.constructor.name,
      sampleRate,
      centerFrequency,
      bandwidth: await this.device.getUsableBandwidth(),
      format: "IQ" as const,
    };
  }

  private handleData = (dataView: DataView): void => {
    if (!this.streaming || !this.streamCallback) {
      return;
    }

    const samples = this.device.parseSamples(dataView);
    this.streamCallback(samples.map((s) => ({ I: s.I, Q: s.Q })));
  };
}
