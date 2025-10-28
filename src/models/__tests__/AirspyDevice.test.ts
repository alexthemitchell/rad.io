/**
 * Airspy Device Tests
 *
 * Tests for Airspy R2/Mini WebUSB device implementation
 */

import { AirspyDevice } from "../AirspyDevice";
import { AirspyDeviceAdapter } from "../AirspyDeviceAdapter";
import type { IQSample } from "../SDRDevice";

// Mock USB device
class MockUSBDevice implements USBDevice {
  opened = false;
  productId = 0x60a1;
  vendorId = 0x1d50;
  productName = "Airspy";
  manufacturerName = "Airspy";
  serialNumber?: string;
  usbVersionMajor = 2;
  usbVersionMinor = 0;
  usbVersionSubminor = 0;
  deviceClass = 0xff;
  deviceSubclass = 0;
  deviceProtocol = 0;
  deviceVersionMajor = 1;
  deviceVersionMinor = 0;
  deviceVersionSubminor = 0;
  configurations: USBConfiguration[] = [];
  configuration?: USBConfiguration;

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async selectConfiguration(_configurationValue: number): Promise<void> {
    // Mock implementation
  }

  async claimInterface(_interfaceNumber: number): Promise<void> {
    // Mock implementation
  }

  async releaseInterface(_interfaceNumber: number): Promise<void> {
    // Mock implementation
  }

  async selectAlternateInterface(
    _interfaceNumber: number,
    _alternateSetting: number,
  ): Promise<void> {
    // Mock implementation
  }

  async controlTransferIn(
    _setup: USBControlTransferParameters,
    _length: number,
  ): Promise<USBInTransferResult> {
    return {
      data: new DataView(new ArrayBuffer(0)),
      status: "ok",
    };
  }

  async controlTransferOut(
    _setup: USBControlTransferParameters,
    _data?: BufferSource,
  ): Promise<USBOutTransferResult> {
    return {
      bytesWritten: 0,
      status: "ok",
    };
  }

  async clearHalt(_direction: USBDirection, _endpointNumber: number): Promise<void> {
    // Mock implementation
  }

  async transferIn(
    _endpointNumber: number,
    _length: number,
  ): Promise<USBInTransferResult> {
    // Generate mock IQ samples (Int16 interleaved)
    const buffer = new ArrayBuffer(1024 * 4); // 1024 samples
    const view = new DataView(buffer);

    for (let i = 0; i < 1024; i++) {
      // Simple sine wave
      const angle = (i / 1024) * 2 * Math.PI;
      const I = Math.sin(angle) * 16384; // Half scale
      const Q = Math.cos(angle) * 16384;

      view.setInt16(i * 4, I, true);
      view.setInt16(i * 4 + 2, Q, true);
    }

    return {
      data: view,
      status: "ok",
    };
  }

  async transferOut(
    _endpointNumber: number,
    _data: BufferSource,
  ): Promise<USBOutTransferResult> {
    return {
      bytesWritten: 0,
      status: "ok",
    };
  }

  async isochronousTransferIn(
    _endpointNumber: number,
    _packetLengths: number[],
  ): Promise<USBIsochronousInTransferResult> {
    return {
      data: new DataView(new ArrayBuffer(0)),
      packets: [],
    };
  }

  async isochronousTransferOut(
    _endpointNumber: number,
    _data: BufferSource,
    _packetLengths: number[],
  ): Promise<USBIsochronousOutTransferResult> {
    return {
      packets: [],
    };
  }

  async reset(): Promise<void> {
    // Mock implementation
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}

describe("AirspyDevice", () => {
  let mockUSB: MockUSBDevice;
  let device: AirspyDevice;

  beforeEach(() => {
    mockUSB = new MockUSBDevice();
    device = new AirspyDevice(mockUSB);
  });

  describe("Device Lifecycle", () => {
    it("should open device successfully", async () => {
      await device.open();
      expect(mockUSB.opened).toBe(true);
      expect(device.isOpen()).toBe(true);
    });

    it("should close device successfully", async () => {
      await device.open();
      await device.close();
      expect(mockUSB.opened).toBe(false);
      expect(device.isOpen()).toBe(false);
    });

    it("should handle multiple close calls", async () => {
      await device.open();
      await device.close();
      await device.close(); // Should not throw
      expect(mockUSB.opened).toBe(false);
    });
  });

  describe("Frequency Configuration", () => {
    beforeEach(async () => {
      await device.open();
    });

    it("should set valid frequency", async () => {
      await device.setFrequency(100e6); // 100 MHz
      expect(device.getFrequency()).toBe(100e6);
    });

    it("should set frequency at minimum range", async () => {
      await device.setFrequency(24e6); // 24 MHz
      expect(device.getFrequency()).toBe(24e6);
    });

    it("should set frequency at maximum range", async () => {
      await device.setFrequency(1800e6); // 1.8 GHz
      expect(device.getFrequency()).toBe(1800e6);
    });

    it("should reject frequency below minimum", async () => {
      await expect(device.setFrequency(10e6)).rejects.toThrow(
        "out of range",
      );
    });

    it("should reject frequency above maximum", async () => {
      await expect(device.setFrequency(2e9)).rejects.toThrow("out of range");
    });
  });

  describe("Sample Rate Configuration", () => {
    beforeEach(async () => {
      await device.open();
    });

    it("should set 2.5 MS/s sample rate", async () => {
      await device.setSampleRate(2.5e6);
      expect(device.getSampleRate()).toBe(2.5e6);
    });

    it("should set 10 MS/s sample rate", async () => {
      await device.setSampleRate(10e6);
      expect(device.getSampleRate()).toBe(10e6);
    });

    it("should reject unsupported sample rate", async () => {
      await expect(device.setSampleRate(5e6)).rejects.toThrow(
        "not supported",
      );
    });
  });

  describe("Gain Configuration", () => {
    beforeEach(async () => {
      await device.open();
    });

    it("should set LNA gain within range", async () => {
      await device.setLNAGain(10);
      // No error expected
    });

    it("should clamp LNA gain to valid range", async () => {
      await device.setLNAGain(20); // Above max (15)
      // Should clamp to 15
    });

    it("should set mixer gain", async () => {
      await device.setMixerGain(8);
      // No error expected
    });

    it("should set VGA gain", async () => {
      await device.setVGAGain(10);
      // No error expected
    });

    it("should enable LNA AGC", async () => {
      await device.setLNAAGC(true);
      // No error expected
    });

    it("should enable Mixer AGC", async () => {
      await device.setMixerAGC(true);
      // No error expected
    });
  });

  describe("Sample Parsing", () => {
    it("should parse Int16 IQ samples correctly", () => {
      const buffer = new ArrayBuffer(8); // 2 samples
      const view = new DataView(buffer);

      // Sample 1: I=16384, Q=-16384
      view.setInt16(0, 16384, true);
      view.setInt16(2, -16384, true);

      // Sample 2: I=-8192, Q=8192
      view.setInt16(4, -8192, true);
      view.setInt16(6, 8192, true);

      const samples = device.parseSamples(view);

      expect(samples.length).toBe(2);
      expect(samples[0]?.I).toBeCloseTo(0.5, 2);
      expect(samples[0]?.Q).toBeCloseTo(-0.5, 2);
      expect(samples[1]?.I).toBeCloseTo(-0.25, 2);
      expect(samples[1]?.Q).toBeCloseTo(0.25, 2);
    });

    it("should handle maximum positive values", () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);

      view.setInt16(0, 32767, true); // Max positive
      view.setInt16(2, 32767, true);

      const samples = device.parseSamples(view);

      expect(samples[0]?.I).toBeCloseTo(1.0, 2);
      expect(samples[0]?.Q).toBeCloseTo(1.0, 2);
    });

    it("should handle maximum negative values", () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);

      view.setInt16(0, -32768, true); // Max negative
      view.setInt16(2, -32768, true);

      const samples = device.parseSamples(view);

      expect(samples[0]?.I).toBeCloseTo(-1.0, 2);
      expect(samples[0]?.Q).toBeCloseTo(-1.0, 2);
    });
  });

  describe("Streaming", () => {
    beforeEach(async () => {
      await device.open();
      await device.setFrequency(100e6);
      await device.setSampleRate(2.5e6);
    });

    it("should start receiving", async () => {
      expect(device.isReceiving()).toBe(false);

      const samples: IQSample[] = [];
      const receivePromise = device.receive((chunk) => {
        samples.push(...chunk);
        // Stop after receiving some samples
        if (samples.length > 100) {
          void device.stopRx();
        }
      });

      // Wait a bit for samples
      await new Promise((resolve) => setTimeout(resolve, 100));
      await device.stopRx();
      await receivePromise;

      expect(samples.length).toBeGreaterThan(0);
    });

    it("should stop receiving", async () => {
      const receivePromise = device.receive(() => {
        // Callback
      });

      expect(device.isReceiving()).toBe(true);

      await device.stopRx();
      await receivePromise;

      expect(device.isReceiving()).toBe(false);
    });
  });
});

describe("AirspyDeviceAdapter", () => {
  let mockUSB: MockUSBDevice;
  let adapter: AirspyDeviceAdapter;

  beforeEach(() => {
    mockUSB = new MockUSBDevice();
    adapter = new AirspyDeviceAdapter(mockUSB);
  });

  describe("Device Info", () => {
    it("should return device info", async () => {
      const info = await adapter.getDeviceInfo();

      expect(info.vendorId).toBe(0x1d50);
      expect(info.productId).toBe(0x60a1);
      expect(info.hardwareRevision).toBe("Airspy R2/Mini");
    });
  });

  describe("Capabilities", () => {
    it("should return device capabilities", () => {
      const caps = adapter.getCapabilities();

      expect(caps.minFrequency).toBe(24e6);
      expect(caps.maxFrequency).toBe(1800e6);
      expect(caps.supportedSampleRates).toEqual([2.5e6, 10e6]);
      expect(caps.maxLNAGain).toBe(45);
    });
  });

  describe("ISDRDevice Interface", () => {
    beforeEach(async () => {
      await adapter.open();
    });

    it("should implement open/close", async () => {
      expect(adapter.isOpen()).toBe(true);
      await adapter.close();
      expect(adapter.isOpen()).toBe(false);
    });

    it("should implement frequency control", async () => {
      await adapter.setFrequency(145e6);
      const freq = await adapter.getFrequency();
      expect(freq).toBe(145e6);
    });

    it("should implement sample rate control", async () => {
      await adapter.setSampleRate(10e6);
      const rate = await adapter.getSampleRate();
      expect(rate).toBe(10e6);
    });

    it("should calculate usable bandwidth", async () => {
      await adapter.setSampleRate(10e6);
      const bandwidth = await adapter.getUsableBandwidth();
      expect(bandwidth).toBe(9e6); // 90% of 10 MS/s
    });

    it("should implement LNA gain control", async () => {
      await adapter.setLNAGain(30); // 30 dB = index 10
      // No error expected
    });

    it("should implement VGA gain control", async () => {
      await adapter.setVGAGain(12);
      // No error expected
    });

    it("should implement amp control (AGC)", async () => {
      await adapter.setAmpEnable(true);
      // No error expected
    });
  });

  describe("Memory Management", () => {
    beforeEach(async () => {
      await adapter.open();
    });

    it("should track memory usage", () => {
      const info = adapter.getMemoryInfo();

      expect(info.totalBufferSize).toBe(0);
      expect(info.usedBufferSize).toBe(0);
      expect(info.activeBuffers).toBe(0);
    });

    it("should clear buffers", () => {
      adapter.clearBuffers();
      const info = adapter.getMemoryInfo();

      expect(info.activeBuffers).toBe(0);
      expect(info.totalBufferSize).toBe(0);
    });
  });

  describe("Reset", () => {
    it("should reset device", async () => {
      await adapter.open();
      await adapter.reset();
      expect(adapter.isOpen()).toBe(true);
    });
  });
});
