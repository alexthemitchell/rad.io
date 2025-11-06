/**
 * RTL-SDR Device Tests
 *
 * Tests for RTLSDRDevice and RTLSDRDeviceAdapter implementations
 */

import { RTLSDRDeviceAdapter } from "../RTLSDRDeviceAdapter";
import { SDRDeviceType } from "../../../models/SDRDevice";

// Mock USB device for testing
class MockUSBDevice {
  opened = false;
  private tunerType = 5; // R820T
  usbVersionMajor = 2;
  usbVersionMinor = 0;
  usbVersionSubminor = 0;
  deviceClass = 0;
  deviceSubclass = 0;
  deviceProtocol = 0;
  vendorId = 0x0bda;
  productId = 0x2838;
  deviceVersionMajor = 1;
  deviceVersionMinor = 0;
  deviceVersionSubminor = 0;
  manufacturerName = "Realtek";
  productName = "RTL2838";
  serialNumber = "12345";
  configuration: USBConfiguration | undefined;
  configurations: USBConfiguration[] = [];

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async selectConfiguration(_config: number): Promise<void> {
    // Mock implementation
  }

  async claimInterface(_iface: number): Promise<void> {
    // Mock implementation
  }

  async releaseInterface(_iface: number): Promise<void> {
    // Mock implementation
  }

  async controlTransferOut(
    _setup: USBControlTransferParameters,
    data?: BufferSource,
  ): Promise<USBOutTransferResult> {
    return {
      bytesWritten: data ? (data as ArrayBuffer).byteLength : 0,
      status: "ok",
    };
  }

  async controlTransferIn(
    setup: USBControlTransferParameters,
    length: number,
  ): Promise<USBInTransferResult> {
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);

    // Return tuner type for GET_TUNER_TYPE command
    if (setup.request === 0x06) {
      view.setUint8(0, this.tunerType);
    }

    return { data: view, status: "ok" };
  }

  async transferIn(
    _endpoint: number,
    length: number,
  ): Promise<USBInTransferResult> {
    // Add small delay to prevent tight loop in tests
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Return mock I/Q data (alternating pattern for testing)
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < length; i += 2) {
      view[i] = 127; // I = 0
      view[i + 1] = 255; // Q = 1.0
    }
    return { data: new DataView(buffer), status: "ok" };
  }

  // Stub methods to satisfy USBDevice interface
  async reset(): Promise<void> {}
  async selectAlternateInterface(_iface: number, _alt: number): Promise<void> {}
  async transferOut(
    _endpoint: number,
    _data: BufferSource,
  ): Promise<USBOutTransferResult> {
    return { bytesWritten: 0, status: "ok" };
  }
  async isochronousTransferIn(
    _endpoint: number,
    _packetLengths: number[],
  ): Promise<USBIsochronousInTransferResult> {
    return { data: undefined, packets: [] };
  }
  async isochronousTransferOut(
    _endpoint: number,
    _data: BufferSource,
    _packetLengths: number[],
  ): Promise<USBIsochronousOutTransferResult> {
    return { packets: [] };
  }
  async clearHalt(_direction: USBDirection, _endpoint: number): Promise<void> {}
  forget(): Promise<void> {
    return Promise.resolve();
  }
}

describe("RTLSDRDeviceAdapter", () => {
  let device: RTLSDRDeviceAdapter;
  let mockUSB: MockUSBDevice;

  beforeEach(() => {
    mockUSB = new MockUSBDevice();
    device = new RTLSDRDeviceAdapter(mockUSB as unknown as USBDevice);
  });

  afterEach(async () => {
    if (device.isOpen()) {
      await device.close();
    }
  });

  describe("Device Info", () => {
    it("should return correct device type", async () => {
      await device.open();
      const info = await device.getDeviceInfo();
      expect(info.type).toBe(SDRDeviceType.RTLSDR);
      expect(info.hardwareRevision).toContain("RTL2832U");
    });

    it("should include tuner type in hardware revision", async () => {
      await device.open();
      const info = await device.getDeviceInfo();
      // R820T should be in the hardware revision (tuner type 5)
      expect(info.hardwareRevision).toContain("R820T");
    });

    it("should return correct capabilities", () => {
      const caps = device.getCapabilities();

      // Frequency range
      expect(caps.minFrequency).toBe(24e6);
      expect(caps.maxFrequency).toBe(1766e6);

      // Sample rates
      expect(caps.supportedSampleRates).toContain(2.048e6); // Default
      expect(caps.supportedSampleRates).toContain(3.2e6); // Max
      expect(caps.supportedSampleRates).toContain(225e3); // Min

      // Gain range
      expect(caps.maxLNAGain).toBe(49.6);

      // Bandwidth
      expect(caps.maxBandwidth).toBe(3.2e6);
    });
  });

  describe("Lifecycle", () => {
    it("should open device successfully", async () => {
      await device.open();
      expect(device.isOpen()).toBe(true);
      expect(mockUSB.opened).toBe(true);
    });

    it("should close device successfully", async () => {
      await device.open();
      await device.close();
      expect(device.isOpen()).toBe(false);
      expect(mockUSB.opened).toBe(false);
    });

    it("should not be receiving after open", async () => {
      await device.open();
      expect(device.isReceiving()).toBe(false);
    });
  });

  describe("Configuration", () => {
    beforeEach(async () => {
      await device.open();
    });

    it("should set frequency within valid range", async () => {
      const testFreq = 100e6; // 100 MHz
      await device.setFrequency(testFreq);
      const freq = await device.getFrequency();
      expect(freq).toBe(testFreq);
    });

    it("should reject frequency below minimum", async () => {
      await expect(device.setFrequency(10e6)).rejects.toThrow(/out of range/);
    });

    it("should reject frequency above maximum", async () => {
      await expect(device.setFrequency(2000e6)).rejects.toThrow(/out of range/);
    });

    it("should set sample rate within valid range", async () => {
      const testRate = 2.048e6; // 2.048 MSPS
      await device.setSampleRate(testRate);
      const rate = await device.getSampleRate();
      // The actual rate is quantized by the device, so check within 100 kHz
      expect(Math.abs(rate - testRate)).toBeLessThan(100000); // Within 100 kHz
    });

    it("should reject sample rate below minimum", async () => {
      await expect(device.setSampleRate(100e3)).rejects.toThrow(/out of range/);
    });

    it("should reject sample rate above maximum", async () => {
      await expect(device.setSampleRate(5e6)).rejects.toThrow(/out of range/);
    });

    it("should set LNA gain", async () => {
      await expect(device.setLNAGain(20)).resolves.not.toThrow();
      await expect(device.setLNAGain(0)).resolves.not.toThrow();
      await expect(device.setLNAGain(49.6)).resolves.not.toThrow();
    });

    it("should set amp enable (AGC mode)", async () => {
      await expect(device.setAmpEnable(true)).resolves.not.toThrow();
      await expect(device.setAmpEnable(false)).resolves.not.toThrow();
    });

    it("should calculate usable bandwidth as 80% of sample rate", async () => {
      await device.setSampleRate(2.048e6);
      const rate = await device.getSampleRate();
      const bandwidth = await device.getUsableBandwidth();
      const expectedBandwidth = rate * 0.8;
      // The bandwidth is derived from the actual sample rate, so check within 10 kHz
      expect(bandwidth).toBeCloseTo(expectedBandwidth, -2);
    });
  });

  describe("Sample Parsing", () => {
    it("should parse Uint8 samples correctly with 127 offset", () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);

      // Set test values
      view.setUint8(0, 127); // I = 0
      view.setUint8(1, 255); // Q = 1.0
      view.setUint8(2, 0); // I = -1.0
      view.setUint8(3, 127); // Q = 0

      const samples = device.parseSamples(view);

      expect(samples).toHaveLength(2);
      expect(samples).toBeDefined();

      // First sample: I=0, Q=1.0
      expect(samples[0]?.I).toBeCloseTo(0, 2);
      expect(samples[0]?.Q).toBeCloseTo(1.0, 2);

      // Second sample: I=-1.0, Q=0
      expect(samples[1]?.I).toBeCloseTo(-1.0, 2);
      expect(samples[1]?.Q).toBeCloseTo(0, 2);
    });

    it("should handle empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      const view = new DataView(buffer);
      const samples = device.parseSamples(view);
      expect(samples).toHaveLength(0);
    });

    it("should handle single sample", () => {
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 200); // I
      view.setUint8(1, 50); // Q

      const samples = device.parseSamples(view);
      expect(samples).toHaveLength(1);
      // The implementation normalizes using (x - 127.5) / 127.5
      expect(samples[0]?.I).toBeCloseTo((200 - 127.5) / 127.5, 2);
      expect(samples[0]?.Q).toBeCloseTo((50 - 127.5) / 127.5, 2);
    });

    it("should normalize samples to ±1.0 range", () => {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);

      // Test extreme values
      view.setUint8(0, 0); // Min I
      view.setUint8(1, 255); // Max Q
      view.setUint8(2, 255); // Max I
      view.setUint8(3, 0); // Min Q
      view.setUint8(4, 127); // Center I
      view.setUint8(5, 127); // Center Q

      const samples = device.parseSamples(view);

      expect(samples).toHaveLength(3);

      // All values should be within ±1.0
      samples.forEach((sample) => {
        expect(sample.I).toBeGreaterThanOrEqual(-1.0);
        expect(sample.I).toBeLessThanOrEqual(1.0);
        expect(sample.Q).toBeGreaterThanOrEqual(-1.0);
        expect(sample.Q).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe("Memory Management", () => {
    beforeEach(async () => {
      await device.open();
    });

    it("should track memory usage", () => {
      const info = device.getMemoryInfo();
      expect(info.activeBuffers).toBeGreaterThanOrEqual(0);
      expect(info.totalBufferSize).toBeGreaterThanOrEqual(0);
      expect(info.usedBufferSize).toBeGreaterThanOrEqual(0);
      expect(info.maxSamples).toBeGreaterThanOrEqual(0);
      expect(info.currentSamples).toBeGreaterThanOrEqual(0);
    });

    it("should clear buffers", () => {
      device.clearBuffers();
      const info = device.getMemoryInfo();
      expect(info.activeBuffers).toBe(0);
      expect(info.totalBufferSize).toBe(0);
      expect(info.currentSamples).toBe(0);
    });
  });

  describe("Streaming", () => {
    beforeEach(async () => {
      await device.open();
    });

    it("should not be receiving before starting", () => {
      expect(device.isReceiving()).toBe(false);
    });

    it("should call callback with DataView", async () => {
      let callbackCalled = false;
      let receivedData: DataView | undefined;

      const receivePromise = device.receive((data) => {
        callbackCalled = true;
        receivedData = data;
        // Stop immediately after first callback
        device.stopRx();
      });

      // Wait for callback
      await new Promise((resolve) => setTimeout(resolve, 100));
      await receivePromise.catch(() => {}); // Ignore errors

      expect(callbackCalled).toBe(true);
      expect(receivedData).toBeDefined();
      if (receivedData) {
        expect(receivedData.byteLength).toBeGreaterThan(0);
      }
    });

    it("should stop receiving when stopRx is called", async () => {
      const receivePromise = device.receive(() => {});

      // Wait a bit then stop
      await new Promise((resolve) => setTimeout(resolve, 50));
      await device.stopRx();

      await receivePromise.catch(() => {}); // Ignore errors
      expect(device.isReceiving()).toBe(false);
    });
  });

  describe("Reset", () => {
    it("should reset device by closing and reopening", async () => {
      await device.open();
      expect(device.isOpen()).toBe(true);

      await device.reset();

      // Device should be open after reset
      expect(device.isOpen()).toBe(true);
      expect(mockUSB.opened).toBe(true);
    });
  });
});
