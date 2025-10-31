import {
  type ISDRDevice,
  type SDRDeviceInfo,
  SDRDeviceType,
  type SDRCapabilities,
  type IQSample,
  type DeviceMemoryInfo,
  validateFrequency,
  validateSampleRate,
  convertInt8ToIQ,
} from "./SDRDevice";

/**
 * Lightweight mock SDR device for E2E/CI runs
 *
 * - Generates deterministic-but-noisy IQ samples suitable for visualizers
 * - Implements a minimal subset of device behavior used by the app
 * - Avoids any WebUSB dependency so it runs in headless CI reliably
 */

// Maximum number of sample buffers to retain in memory
const MAX_BUFFER_COUNT = 10;

export class MockSDRDevice implements ISDRDevice {
  private _isOpen = false;
  private _isReceiving = false;
  private _frequency = 100e6; // Hz
  private _sampleRate = 2e6; // Hz
  private _lnaGain = 16; // dB
  private _bandwidth = 2.5e6; // Hz
  private receiveInterval?: NodeJS.Timeout;

  // Memory tracking
  private sampleBuffers: DataView[] = [];
  private totalBufferSize = 0;
  private readonly maxBufferSize = 2 * 1024 * 1024; // 2 MB (reduced from 8MB)

  private readonly deviceInfo: SDRDeviceInfo = {
    type: SDRDeviceType.GENERIC,
    vendorId: 0x1d50,
    productId: 0x6089,
    serialNumber: "E2E-MOCK-001",
    firmwareVersion: "mock-1.0.0",
    hardwareRevision: "mock",
  };

  private readonly capabilities: SDRCapabilities = {
    minFrequency: 10e3,
    maxFrequency: 6e9,
    supportedSampleRates: [2e6, 4e6, 8e6, 10e6, 12.5e6, 16e6, 20e6],
    maxLNAGain: 40,
    maxVGAGain: 62,
    supportsAmpControl: true,
    supportsAntennaControl: true,
    supportedBandwidths: [
      1.75e6, 2.5e6, 3.5e6, 5e6, 5.5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6, 14e6,
      15e6, 20e6, 24e6, 28e6,
    ],
    maxBandwidth: 20e6,
  };

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    await Promise.resolve();
    return this.deviceInfo;
  }

  getCapabilities(): SDRCapabilities {
    return this.capabilities;
  }

  async open(): Promise<void> {
    await Promise.resolve();
    if (this._isOpen) {
      throw new Error("Device already open");
    }
    this._isOpen = true;
  }

  async close(): Promise<void> {
    if (this._isReceiving) {
      await this.stopRx();
    }
    this._isOpen = false;
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  async setFrequency(frequencyHz: number): Promise<void> {
    await Promise.resolve();
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (!validateFrequency(frequencyHz, this.capabilities)) {
      throw new Error("Frequency out of range");
    }
    this._frequency = frequencyHz;
  }

  async getFrequency(): Promise<number> {
    await Promise.resolve();
    return this._frequency;
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    await Promise.resolve();
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (!validateSampleRate(sampleRateHz, this.capabilities)) {
      throw new Error("Sample rate not supported");
    }
    this._sampleRate = sampleRateHz;
  }

  async getSampleRate(): Promise<number> {
    await Promise.resolve();
    return this._sampleRate;
  }

  async getUsableBandwidth(): Promise<number> {
    await Promise.resolve();
    return this._sampleRate * 0.8;
  }

  async setLNAGain(gainDb: number): Promise<void> {
    await Promise.resolve();
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (gainDb < 0 || gainDb > (this.capabilities.maxLNAGain ?? 40)) {
      throw new Error("LNA gain out of range");
    }
    this._lnaGain = gainDb;
  }

  async setVGAGain(): Promise<void> {
    // Not used in app; no-op
    await Promise.resolve();
  }

  async setAmpEnable(): Promise<void> {
    // No-op for mock
    await Promise.resolve();
  }

  async setBandwidth(bandwidthHz: number): Promise<void> {
    await Promise.resolve();
    const supported = this.capabilities.supportedBandwidths ?? [];
    if (supported.length && !supported.includes(bandwidthHz)) {
      throw new Error("Bandwidth not supported");
    }
    this._bandwidth = bandwidthHz;
  }

  async getBandwidth(): Promise<number> {
    await Promise.resolve();
    return this._bandwidth;
  }

  async receive(
    callback: (data: DataView) => void,
  ): Promise<void> {
    await Promise.resolve();
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (this._isReceiving) {
      throw new Error("Already receiving");
    }
    this._isReceiving = true;

    // Generate IQ sample chunks periodically
    // Reduced frequency and size to prevent memory accumulation
    this.receiveInterval = setInterval(() => {
      if (!this._isReceiving) {
        return;
      }

      // Reduced from 16384 to limit memory.
      // Rationale: 8192 is chosen to balance memory usage and FFT processing.
      // Typical FFT size is 4096, so this provides ~2 FFT windows per chunk.
      // Each buffer is ~16KB (8192 samples × 2 bytes), which helps prevent memory accumulation in CI/E2E runs.
      const samplesPerChunk = 8192;
      const buffer = new ArrayBuffer(samplesPerChunk * 2);
      const view = new DataView(buffer);

      // Simulate a modest FM-like tone plus noise; deterministic-ish using Math.sin
      const tone = 75e3; // 75 kHz offset
      for (let i = 0; i < samplesPerChunk; i++) {
        const phase = (2 * Math.PI * tone * i) / this._sampleRate;
        const gain =
          0.25 + (this._lnaGain / (this.capabilities.maxLNAGain ?? 40)) * 0.5;
        const I = Math.max(
          -1,
          Math.min(1, gain * Math.cos(phase) + (Math.random() - 0.5) * 0.05),
        );
        const Q = Math.max(
          -1,
          Math.min(1, gain * Math.sin(phase) + (Math.random() - 0.5) * 0.05),
        );
        view.setInt8(i * 2, Math.round(I * 127));
        view.setInt8(i * 2 + 1, Math.round(Q * 127));
      }

      // Track memory (trim aggressively to prevent OOM)
      this.sampleBuffers.push(view);
      this.totalBufferSize += view.byteLength;
      // Keep only last 10 buffers (10 × 8192 samples × 2 bytes = ~163KB) to prevent memory accumulation
      while (this.sampleBuffers.length > MAX_BUFFER_COUNT) {
        const old = this.sampleBuffers.shift();
        if (old) {
          this.totalBufferSize -= old.byteLength;
        }
      }

      // Emit raw interleaved IQ bytes; downstream layers convert via parseSamples()
      callback(view);
    }, 200); // Reduced frequency from 10Hz (100ms) to 5Hz (200ms) to reduce memory pressure
  }

  async stopRx(): Promise<void> {
    this._isReceiving = false;
    if (this.receiveInterval) {
      clearInterval(this.receiveInterval);
      this.receiveInterval = undefined;
    }
    // Clear sample buffers to free memory
    this.sampleBuffers = [];
    this.totalBufferSize = 0;
    await Promise.resolve();
  }

  isReceiving(): boolean {
    return this._isReceiving;
  }

  parseSamples(data: DataView): IQSample[] {
    return convertInt8ToIQ(data);
  }

  getMemoryInfo(): DeviceMemoryInfo {
    const maxSamples = this.maxBufferSize / 2;
    const currentSamples = this.totalBufferSize / 2;
    return {
      totalBufferSize: this.maxBufferSize,
      usedBufferSize: this.totalBufferSize,
      activeBuffers: this.sampleBuffers.length,
      maxSamples,
      currentSamples,
    };
  }

  clearBuffers(): void {
    this.sampleBuffers = [];
    this.totalBufferSize = 0;
  }

  async reset(): Promise<void> {
    // No-op for mock
    await Promise.resolve();
  }
}
