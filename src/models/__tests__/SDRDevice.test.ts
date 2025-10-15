/**
 * Comprehensive SDR Device Interface Tests
 *
 * Tests ensure that arbitrary WebUSB devices can fulfill the requirements
 * of our SDR interface and accurately feed data to visualizations.
 */

import {
  ISDRDevice,
  SDRDeviceType,
  SDRCapabilities,
  SDRDeviceInfo,
  IQSample,
  DeviceMemoryInfo,
  convertInt8ToIQ,
  convertUint8ToIQ,
  convertInt16ToIQ,
  validateFrequency,
  validateSampleRate,
  SDR_USB_DEVICES,
} from "../SDRDevice";

/**
 * Mock SDR Device for testing
 * Simulates realistic SDR behavior with proper IQ sample generation
 */
class MockSDRDevice implements ISDRDevice {
  private _isOpen = false;
  private _isReceiving = false;
  private _frequency = 100e6; // 100 MHz default
  private _sampleRate = 10e6; // 10 MSPS default
  private _lnaGain = 16;
  private _ampEnabled = false;
  private receiveInterval?: NodeJS.Timeout;

  // Memory management
  private sampleBuffers: DataView[] = [];
  private totalBufferSize = 0;
  private readonly maxBufferSize = 8 * 1024 * 1024; // 8 MB for testing

  private deviceInfo: SDRDeviceInfo = {
    type: SDRDeviceType.GENERIC,
    vendorId: 0x1d50,
    productId: 0x6089,
    serialNumber: "TEST-DEVICE-001",
    firmwareVersion: "1.0.0",
    hardwareRevision: "r9",
  };

  private capabilities: SDRCapabilities = {
    minFrequency: 10e3, // 10 kHz (support AM band)
    maxFrequency: 6000e6, // 6 GHz
    supportedSampleRates: [8e6, 10e6, 12.5e6, 16e6, 20e6],
    maxLNAGain: 40,
    maxVGAGain: 62,
    supportsAmpControl: true,
    supportsAntennaControl: true,
    supportedBandwidths: [
      1.75e6, 2.5e6, 3.5e6, 5e6, 5.5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6, 14e6,
      15e6, 20e6, 24e6, 28e6,
    ],
  };

  async getDeviceInfo(): Promise<SDRDeviceInfo> {
    return this.deviceInfo;
  }

  getCapabilities(): SDRCapabilities {
    return this.capabilities;
  }

  async open(): Promise<void> {
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
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (!validateFrequency(frequencyHz, this.capabilities)) {
      throw new Error(`Frequency ${frequencyHz} Hz out of range`);
    }
    this._frequency = frequencyHz;
  }

  async getFrequency(): Promise<number> {
    return this._frequency;
  }

  async setSampleRate(sampleRateHz: number): Promise<void> {
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (!validateSampleRate(sampleRateHz, this.capabilities)) {
      throw new Error(`Sample rate ${sampleRateHz} Hz not supported`);
    }
    this._sampleRate = sampleRateHz;
  }

  async getSampleRate(): Promise<number> {
    return this._sampleRate;
  }

  async setLNAGain(gainDb: number): Promise<void> {
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (gainDb < 0 || gainDb > (this.capabilities.maxLNAGain ?? 40)) {
      throw new Error(`LNA gain ${gainDb} dB out of range`);
    }
    this._lnaGain = gainDb;
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    this._ampEnabled = enabled;
  }

  async receive(callback: (data: DataView) => void): Promise<void> {
    if (!this._isOpen) {
      throw new Error("Device not open");
    }
    if (this._isReceiving) {
      throw new Error("Already receiving");
    }

    this._isReceiving = true;

    // Simulate receiving IQ samples at the configured sample rate
    // Generate realistic FM signal at center frequency
    this.receiveInterval = setInterval(() => {
      if (!this._isReceiving) {
        return;
      }

      const samplesPerChunk = 16384; // Reduced for testing (typical is 262144)
      const samples = this.generateRealisticSamples(samplesPerChunk);

      // Convert to Int8 format (typical for HackRF)
      const buffer = new ArrayBuffer(samplesPerChunk * 2);
      const view = new DataView(buffer);

      for (let i = 0; i < samplesPerChunk; i++) {
        const sample = samples[i];
        if (sample) {
          view.setInt8(i * 2, Math.round(sample.I * 127));
          view.setInt8(i * 2 + 1, Math.round(sample.Q * 127));
        }
      }

      callback(view);
    }, 100); // Every 100ms
  }

  async stopRx(): Promise<void> {
    this._isReceiving = false;
    if (this.receiveInterval) {
      clearInterval(this.receiveInterval);
      this.receiveInterval = undefined;
    }
  }

  isReceiving(): boolean {
    return this._isReceiving;
  }

  parseSamples(data: DataView): IQSample[] {
    return convertInt8ToIQ(data);
  }

  getMemoryInfo(): DeviceMemoryInfo {
    const maxSamples = this.maxBufferSize / 2; // 2 bytes per IQ pair
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

  /**
   * Generate realistic IQ samples simulating an FM signal
   * This represents what a real SDR would capture
   */
  private generateRealisticSamples(count: number): IQSample[] {
    const samples: IQSample[] = [];
    const signalFreq = 100e3; // 100 kHz offset from center
    const carrierAmp = 0.3;
    const noiseLevel = 0.05;

    for (let n = 0; n < count; n++) {
      // FM carrier
      const phase = (2 * Math.PI * signalFreq * n) / this._sampleRate;

      // Add some frequency modulation
      const modulation =
        0.05 * Math.sin((2 * Math.PI * 15e3 * n) / this._sampleRate);
      const modulatedPhase = phase + modulation;

      // IQ components
      let I = carrierAmp * Math.cos(modulatedPhase);
      let Q = carrierAmp * Math.sin(modulatedPhase);

      // Add realistic noise
      I += (Math.random() - 0.5) * noiseLevel;
      Q += (Math.random() - 0.5) * noiseLevel;

      // Add gain effect
      const gainFactor = 1 + this._lnaGain / 40;
      I *= gainFactor;
      Q *= gainFactor;

      // Clip to realistic range
      I = Math.max(-1, Math.min(1, I));
      Q = Math.max(-1, Math.min(1, Q));

      samples.push({ I, Q });
    }

    return samples;
  }
}

describe("SDRDevice Interface", () => {
  describe("Device Lifecycle", () => {
    it("should open and close device successfully", async () => {
      const device = new MockSDRDevice();

      expect(device.isOpen()).toBe(false);

      await device.open();
      expect(device.isOpen()).toBe(true);

      await device.close();
      expect(device.isOpen()).toBe(false);
    });

    it("should prevent double open", async () => {
      const device = new MockSDRDevice();
      await device.open();

      await expect(device.open()).rejects.toThrow("already open");

      await device.close();
    });

    it("should return device info", async () => {
      const device = new MockSDRDevice();
      const info = await device.getDeviceInfo();

      expect(info).toBeDefined();
      expect(info.vendorId).toBe(0x1d50);
      expect(info.serialNumber).toBeDefined();
      expect(info.firmwareVersion).toBeDefined();
    });

    it("should return device capabilities", () => {
      const device = new MockSDRDevice();
      const caps = device.getCapabilities();

      expect(caps).toBeDefined();
      expect(caps.minFrequency).toBeGreaterThan(0);
      expect(caps.maxFrequency).toBeGreaterThan(caps.minFrequency);
      expect(caps.supportedSampleRates).toHaveLength(5);
      expect(caps.supportsAmpControl).toBe(true);
    });
  });

  describe("Frequency Control", () => {
    let device: MockSDRDevice;

    beforeEach(async () => {
      device = new MockSDRDevice();
      await device.open();
    });

    afterEach(async () => {
      await device.close();
    });

    it("should set and get frequency", async () => {
      await device.setFrequency(100.3e6); // FM station
      const freq = await device.getFrequency();
      expect(freq).toBe(100.3e6);
    });

    it("should reject frequency below minimum", async () => {
      const caps = device.getCapabilities();
      await expect(
        device.setFrequency(caps.minFrequency - 1000),
      ).rejects.toThrow("out of range");
    });

    it("should reject frequency above maximum", async () => {
      const caps = device.getCapabilities();
      await expect(
        device.setFrequency(caps.maxFrequency + 1000),
      ).rejects.toThrow("out of range");
    });

    it("should accept valid FM frequencies", async () => {
      const fmFrequencies = [88.1e6, 95.5e6, 100.3e6, 107.9e6];

      for (const freq of fmFrequencies) {
        await device.setFrequency(freq);
        const setFreq = await device.getFrequency();
        expect(setFreq).toBe(freq);
      }
    });

    it("should accept valid AM frequencies", async () => {
      const amFrequencies = [530e3, 710e3, 1010e3, 1700e3];

      for (const freq of amFrequencies) {
        await device.setFrequency(freq);
        const setFreq = await device.getFrequency();
        expect(setFreq).toBe(freq);
      }
    });
  });

  describe("Sample Rate Control", () => {
    let device: MockSDRDevice;

    beforeEach(async () => {
      device = new MockSDRDevice();
      await device.open();
    });

    afterEach(async () => {
      await device.close();
    });

    it("should set and get sample rate", async () => {
      await device.setSampleRate(10e6);
      const rate = await device.getSampleRate();
      expect(rate).toBe(10e6);
    });

    it("should accept all supported sample rates", async () => {
      const caps = device.getCapabilities();

      for (const rate of caps.supportedSampleRates) {
        await device.setSampleRate(rate);
        const setRate = await device.getSampleRate();
        expect(setRate).toBe(rate);
      }
    });

    it("should reject unsupported sample rate", async () => {
      await expect(device.setSampleRate(999e6)).rejects.toThrow(
        "not supported",
      );
    });
  });

  describe("Gain Control", () => {
    let device: MockSDRDevice;

    beforeEach(async () => {
      device = new MockSDRDevice();
      await device.open();
    });

    afterEach(async () => {
      await device.close();
    });

    it("should set LNA gain", async () => {
      await device.setLNAGain(16);
      // Gain setting doesn't have a getter, but shouldn't throw
      expect(true).toBe(true);
    });

    it("should reject negative LNA gain", async () => {
      await expect(device.setLNAGain(-5)).rejects.toThrow("out of range");
    });

    it("should reject LNA gain above maximum", async () => {
      const caps = device.getCapabilities();
      await expect(
        device.setLNAGain((caps.maxLNAGain ?? 40) + 10),
      ).rejects.toThrow("out of range");
    });

    it("should accept valid LNA gain steps", async () => {
      const validGains = [0, 8, 16, 24, 32, 40];

      for (const gain of validGains) {
        await device.setLNAGain(gain);
      }
    });
  });

  describe("Amplifier Control", () => {
    let device: MockSDRDevice;

    beforeEach(async () => {
      device = new MockSDRDevice();
      await device.open();
    });

    afterEach(async () => {
      await device.close();
    });

    it("should enable amplifier", async () => {
      await device.setAmpEnable(true);
      expect(true).toBe(true);
    });

    it("should disable amplifier", async () => {
      await device.setAmpEnable(false);
      expect(true).toBe(true);
    });
  });

  describe("Sample Reception", () => {
    let device: MockSDRDevice;

    beforeEach(async () => {
      device = new MockSDRDevice();
      await device.open();
    });

    afterEach(async () => {
      if (device.isReceiving()) {
        await device.stopRx();
      }
      await device.close();
    });

    it("should start receiving samples", async () => {
      const samples: DataView[] = [];

      await device.receive((data) => {
        samples.push(data);
      });

      expect(device.isReceiving()).toBe(true);

      // Wait for some samples
      await new Promise((resolve) => setTimeout(resolve, 250));

      await device.stopRx();

      expect(samples.length).toBeGreaterThan(0);
    });

    it("should stop receiving samples", async () => {
      await device.receive(() => {});
      expect(device.isReceiving()).toBe(true);

      await device.stopRx();
      expect(device.isReceiving()).toBe(false);
    });

    it("should provide properly formatted IQ samples", async () => {
      let receivedData: DataView | null = null;

      await device.receive((data) => {
        if (!receivedData) {
          receivedData = data;
        }
      });

      // Wait for samples
      await new Promise((resolve) => setTimeout(resolve, 150));

      await device.stopRx();

      expect(receivedData).not.toBeNull();
      expect(receivedData!.byteLength).toBeGreaterThan(0);
      expect(receivedData!.byteLength % 2).toBe(0); // Should be pairs of I/Q
    });

    it("should generate realistic signal characteristics", async () => {
      let receivedData: DataView | null = null;

      await device.receive((data) => {
        if (!receivedData) {
          receivedData = data;
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      await device.stopRx();

      const samples = device.parseSamples(receivedData!);

      // Check sample properties
      expect(samples.length).toBeGreaterThan(1000);

      // All samples should be in valid range
      for (const sample of samples.slice(0, 100)) {
        expect(sample.I).toBeGreaterThanOrEqual(-1);
        expect(sample.I).toBeLessThanOrEqual(1);
        expect(sample.Q).toBeGreaterThanOrEqual(-1);
        expect(sample.Q).toBeLessThanOrEqual(1);
      }
    });

    it("should prevent concurrent receive operations", async () => {
      await device.receive(() => {});

      await expect(device.receive(() => {})).rejects.toThrow(
        "Already receiving",
      );

      await device.stopRx();
    });
  });

  describe("Sample Format Conversion", () => {
    it("should convert Int8 samples to IQ", () => {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);

      // Set some sample values
      view.setInt8(0, 64); // I = 0.5
      view.setInt8(1, -64); // Q = -0.5
      view.setInt8(2, 127); // I = ~1.0
      view.setInt8(3, -128); // Q = -1.0
      view.setInt8(4, 0); // I = 0.0
      view.setInt8(5, 0); // Q = 0.0

      const samples = convertInt8ToIQ(view);

      expect(samples).toHaveLength(5);
      expect(samples[0]?.I).toBeCloseTo(0.5, 1);
      expect(samples[0]?.Q).toBeCloseTo(-0.5, 1);
      expect(samples[1]?.I).toBeCloseTo(1.0, 1);
      expect(samples[1]?.Q).toBeCloseTo(-1.0, 1);
      expect(samples[2]?.I).toBe(0);
      expect(samples[2]?.Q).toBe(0);
    });

    it("should convert Uint8 samples to IQ", () => {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);

      // RTL-SDR format: 127.5 is zero
      view.setUint8(0, 191); // I = 0.5
      view.setUint8(1, 64); // Q = -0.5
      view.setUint8(2, 255); // I = 1.0
      view.setUint8(3, 0); // Q = -1.0
      view.setUint8(4, 127); // I ~ 0.0
      view.setUint8(5, 128); // Q ~ 0.0

      const samples = convertUint8ToIQ(view);

      expect(samples).toHaveLength(3);
      expect(samples[0]?.I).toBeCloseTo(0.5, 1);
      expect(samples[0]?.Q).toBeCloseTo(-0.5, 1);
    });

    it("should convert Int16 samples to IQ", () => {
      const buffer = new ArrayBuffer(12);
      const view = new DataView(buffer);

      // 16-bit signed format
      view.setInt16(0, 16384, true); // I = 0.5
      view.setInt16(2, -16384, true); // Q = -0.5
      view.setInt16(4, 32767, true); // I = ~1.0
      view.setInt16(6, -32768, true); // Q = -1.0
      view.setInt16(8, 0, true); // I = 0.0
      view.setInt16(10, 0, true); // Q = 0.0

      const samples = convertInt16ToIQ(view);

      expect(samples).toHaveLength(3);
      expect(samples[0]?.I).toBeCloseTo(0.5, 1);
      expect(samples[0]?.Q).toBeCloseTo(-0.5, 1);
      expect(samples[1]?.I).toBeCloseTo(1.0, 1);
      expect(samples[1]?.Q).toBeCloseTo(-1.0, 1);
      expect(samples[2]?.I).toBe(0);
      expect(samples[2]?.Q).toBe(0);
    });
  });

  describe("Validation Functions", () => {
    const mockCapabilities: SDRCapabilities = {
      minFrequency: 10e3,
      maxFrequency: 6000e6,
      supportedSampleRates: [8e6, 10e6, 20e6],
      supportsAmpControl: true,
      supportsAntennaControl: false,
    };

    it("should validate frequency in range", () => {
      expect(validateFrequency(100e6, mockCapabilities)).toBe(true);
      expect(validateFrequency(10e3, mockCapabilities)).toBe(true);
      expect(validateFrequency(6000e6, mockCapabilities)).toBe(true);
    });

    it("should reject frequency out of range", () => {
      expect(validateFrequency(5e3, mockCapabilities)).toBe(false);
      expect(validateFrequency(7000e6, mockCapabilities)).toBe(false);
    });

    it("should validate supported sample rate", () => {
      expect(validateSampleRate(8e6, mockCapabilities)).toBe(true);
      expect(validateSampleRate(10e6, mockCapabilities)).toBe(true);
      expect(validateSampleRate(20e6, mockCapabilities)).toBe(true);
    });

    it("should reject unsupported sample rate", () => {
      expect(validateSampleRate(5e6, mockCapabilities)).toBe(false);
      expect(validateSampleRate(15e6, mockCapabilities)).toBe(false);
    });
  });

  describe("Known SDR Devices", () => {
    it("should have HackRF One definition", () => {
      const hackrf = SDR_USB_DEVICES.HACKRF_ONE;
      expect(hackrf).toBeDefined();
      expect(hackrf.vendorId).toBe(0x1d50);
      expect(hackrf.productId).toBe(0x6089);
      expect(hackrf.name).toBe("HackRF One");
    });

    it("should have RTL-SDR definitions", () => {
      const rtlsdr = SDR_USB_DEVICES.RTLSDR_GENERIC;
      expect(rtlsdr).toBeDefined();
      expect(rtlsdr.vendorId).toBe(0x0bda);
      expect(rtlsdr.productId).toBe(0x2838);
    });

    it("should have Airspy definitions", () => {
      const airspy = SDR_USB_DEVICES.AIRSPY_MINI;
      expect(airspy).toBeDefined();
      expect(airspy.vendorId).toBe(0x1d50);
    });
  });
});

describe("Visualization Data Compatibility", () => {
  let device: MockSDRDevice;

  beforeEach(async () => {
    device = new MockSDRDevice();
    await device.open();
  });

  afterEach(async () => {
    if (device.isReceiving()) {
      await device.stopRx();
    }
    await device.close();
  });

  it("should provide samples suitable for IQ Constellation", async () => {
    let samples: IQSample[] = [];

    await device.receive((data) => {
      samples = device.parseSamples(data);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    await device.stopRx();

    // IQ Constellation needs samples with I and Q components
    expect(samples.length).toBeGreaterThan(0);

    const firstBatch = samples.slice(0, 1000);
    for (const sample of firstBatch) {
      expect(sample).toHaveProperty("I");
      expect(sample).toHaveProperty("Q");
      expect(typeof sample.I).toBe("number");
      expect(typeof sample.Q).toBe("number");
    }
  });

  it("should provide samples suitable for FFT/Spectrogram", async () => {
    let samples: IQSample[] = [];

    await device.receive((data) => {
      samples = device.parseSamples(data);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    await device.stopRx();

    // FFT typically needs 1024 or 2048 samples
    expect(samples.length).toBeGreaterThanOrEqual(1024);

    // Samples should be continuous
    const batch = samples.slice(0, 1024);
    expect(batch.length).toBe(1024);
  });

  it("should provide samples suitable for Waveform visualization", async () => {
    let samples: IQSample[] = [];

    await device.receive((data) => {
      samples = device.parseSamples(data);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    await device.stopRx();

    // Calculate amplitude envelope
    const amplitudes = samples
      .slice(0, 2000)
      .map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));

    expect(amplitudes.length).toBe(2000);

    // Amplitudes should vary (signal present)
    const maxAmp = Math.max(...amplitudes);
    const minAmp = Math.min(...amplitudes);
    expect(maxAmp).toBeGreaterThan(minAmp);
  });

  it("should generate samples with signal characteristics", async () => {
    let samples: IQSample[] = [];

    // Set realistic FM parameters
    await device.setFrequency(100.3e6);
    await device.setSampleRate(10e6);
    await device.setLNAGain(16);

    await device.receive((data) => {
      samples = device.parseSamples(data);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    await device.stopRx();

    const batch = samples.slice(0, 1024);

    // Calculate RMS (root mean square) - should be > 0 for signal
    const rms = Math.sqrt(
      batch.reduce((sum, s) => sum + s.I * s.I + s.Q * s.Q, 0) / batch.length,
    );

    expect(rms).toBeGreaterThan(0.1); // Significant signal present
  });

  it("should reflect gain changes in signal amplitude", async () => {
    await device.setFrequency(100e6);
    await device.setSampleRate(10e6);

    // Low gain
    await device.setLNAGain(0);
    let lowGainSamples: IQSample[] = [];
    await device.receive((data) => {
      lowGainSamples = device.parseSamples(data);
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await device.stopRx();

    const lowRMS = Math.sqrt(
      lowGainSamples
        .slice(0, 1024)
        .reduce((sum, s) => sum + s.I * s.I + s.Q * s.Q, 0) / 1024,
    );

    // High gain
    await device.setLNAGain(32);
    let highGainSamples: IQSample[] = [];
    await device.receive((data) => {
      highGainSamples = device.parseSamples(data);
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await device.stopRx();

    const highRMS = Math.sqrt(
      highGainSamples
        .slice(0, 1024)
        .reduce((sum, s) => sum + s.I * s.I + s.Q * s.Q, 0) / 1024,
    );

    // Higher gain should produce higher amplitude
    expect(highRMS).toBeGreaterThan(lowRMS);
  });

  describe("Device Memory Management", () => {
    it("should provide memory information", async () => {
      const device = new MockSDRDevice();
      await device.open();

      const memInfo = device.getMemoryInfo();

      expect(memInfo).toHaveProperty("totalBufferSize");
      expect(memInfo).toHaveProperty("usedBufferSize");
      expect(memInfo).toHaveProperty("activeBuffers");
      expect(memInfo).toHaveProperty("maxSamples");
      expect(memInfo).toHaveProperty("currentSamples");

      expect(memInfo.totalBufferSize).toBeGreaterThan(0);
      expect(memInfo.usedBufferSize).toBeGreaterThanOrEqual(0);
      expect(memInfo.activeBuffers).toBeGreaterThanOrEqual(0);

      await device.close();
    });

    it("should clear buffers", async () => {
      const device = new MockSDRDevice();
      await device.open();

      // Clear buffers
      device.clearBuffers();

      const memInfo = device.getMemoryInfo();
      expect(memInfo.usedBufferSize).toBe(0);
      expect(memInfo.activeBuffers).toBe(0);
      expect(memInfo.currentSamples).toBe(0);

      await device.close();
    });

    it("should track memory usage correctly", async () => {
      const device = new MockSDRDevice();
      await device.open();

      const initialMemInfo = device.getMemoryInfo();

      // Memory should start clean
      expect(initialMemInfo.usedBufferSize).toBe(0);
      expect(initialMemInfo.activeBuffers).toBe(0);

      // Calculate max samples correctly
      expect(initialMemInfo.maxSamples).toBe(
        initialMemInfo.totalBufferSize / 2,
      );

      await device.close();
    });
  });
});
