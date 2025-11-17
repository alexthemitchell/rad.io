/**
 * Driver Conformance Tests
 *
 * This test suite validates that all SDR drivers properly implement the ISDRDevice
 * interface and conform to the Hardware Abstraction Layer (HAL) contract.
 *
 * Every driver MUST pass these conformance tests to ensure consistent behavior
 * across different hardware implementations.
 */

import type { ISDRDevice, SDRCapabilities } from "../../models/SDRDevice";
import { HackRFOneAdapter } from "../hackrf/HackRFOneAdapter";
import { RTLSDRDeviceAdapter } from "../../models/RTLSDRDeviceAdapter";

/**
 * Create a mock USB device for testing
 */
function createMockUSBDevice(
  vendorId: number,
  productId: number,
): USBDevice {
  // Create mock endpoints for bulk transfers
  const mockEndpointIn: USBEndpoint = {
    endpointNumber: 1,
    direction: "in",
    type: "bulk",
    packetSize: 16384,
  };

  const mockEndpointOut: USBEndpoint = {
    endpointNumber: 2,
    direction: "out",
    type: "bulk",
    packetSize: 16384,
  };

  // Create a mock interface with both endpoints
  const mockInterface: USBInterface = {
    interfaceNumber: 0,
    alternate: {
      alternateSetting: 0,
      interfaceClass: 0xff, // Vendor-specific
      interfaceSubclass: 0,
      interfaceProtocol: 0,
      interfaceName: "HackRF Interface",
      endpoints: [mockEndpointIn, mockEndpointOut],
    },
    alternates: [],
    claimed: true, // Pre-claimed for testing
  };

  const mockConfiguration: USBConfiguration = {
    configurationValue: 1,
    configurationName: "HackRF Configuration",
    interfaces: [mockInterface],
  };

  const mockDevice = {
    opened: true, // Pre-opened for testing
    vendorId,
    productId,
    productName: "Mock Device",
    manufacturerName: "Mock",
    serialNumber: "TEST123",
    usbVersionMajor: 2,
    usbVersionMinor: 0,
    usbVersionSubminor: 0,
    deviceClass: 0xff,
    deviceSubclass: 0,
    deviceProtocol: 0,
    deviceVersionMajor: 1,
    deviceVersionMinor: 0,
    deviceVersionSubminor: 0,
    configurations: [mockConfiguration],
    configuration: mockConfiguration,
    controlTransferOut: jest.fn().mockResolvedValue({
      status: "ok",
      bytesWritten: 0,
    } as USBOutTransferResult),
    controlTransferIn: jest.fn().mockResolvedValue({
      data: new DataView(new ArrayBuffer(256)),
      status: "ok",
    } as USBInTransferResult),
    transferIn: jest.fn().mockResolvedValue({
      data: new DataView(new ArrayBuffer(4096)),
      status: "ok",
    } as USBInTransferResult),
    transferOut: jest.fn().mockResolvedValue({
      status: "ok",
      bytesWritten: 4096,
    } as USBOutTransferResult),
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    clearHalt: jest.fn().mockResolvedValue(undefined),
    selectConfiguration: jest.fn().mockResolvedValue(undefined),
    selectAlternateInterface: jest.fn().mockResolvedValue(undefined),
    claimInterface: jest.fn().mockResolvedValue(undefined),
    releaseInterface: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
  } as unknown as USBDevice;

  return mockDevice;
}

/**
 * Test suite factory for driver conformance tests
 */
function createDriverConformanceTests(
  driverName: string,
  createDriver: (usbDevice: USBDevice) => ISDRDevice,
  vendorId: number,
  productId: number,
): void {
  describe(`${driverName} HAL Conformance`, () => {
    let device: ISDRDevice;
    let mockUSBDevice: USBDevice;

    beforeEach(() => {
      mockUSBDevice = createMockUSBDevice(vendorId, productId);
      device = createDriver(mockUSBDevice);
    });

    afterEach(async () => {
      if (device.isOpen()) {
        await device.close();
      }
    });

    describe("Device Information", () => {
      it("should provide device info", async () => {
        const info = await device.getDeviceInfo();
        expect(info).toBeDefined();
        expect(info.type).toBeDefined();
        expect(info.vendorId).toBe(vendorId);
        expect(info.productId).toBe(productId);
      });

      it("should provide device capabilities", () => {
        const capabilities = device.getCapabilities();
        expect(capabilities).toBeDefined();
        expect(capabilities.minFrequency).toBeGreaterThan(0);
        expect(capabilities.maxFrequency).toBeGreaterThan(
          capabilities.minFrequency,
        );
        expect(Array.isArray(capabilities.supportedSampleRates)).toBe(true);
        expect(capabilities.supportedSampleRates.length).toBeGreaterThan(0);
      });
    });

    describe("Device Lifecycle", () => {
      it("should have isOpen method", () => {
        expect(typeof device.isOpen).toBe("function");
        expect(typeof device.isOpen()).toBe("boolean");
      });

      it("should have open and close methods", () => {
        expect(typeof device.open).toBe("function");
        expect(typeof device.close).toBe("function");
      });

      it("should have isReceiving method", () => {
        expect(typeof device.isReceiving).toBe("function");
        expect(typeof device.isReceiving()).toBe("boolean");
      });
    });

    describe("Frequency Control", () => {
      it("should have setFrequency and getFrequency methods", () => {
        expect(typeof device.setFrequency).toBe("function");
        expect(typeof device.getFrequency).toBe("function");
      });

      it("should define valid frequency range in capabilities", () => {
        const capabilities = device.getCapabilities();
        expect(capabilities.minFrequency).toBeGreaterThan(0);
        expect(capabilities.maxFrequency).toBeGreaterThan(capabilities.minFrequency);
      });
    });

    describe("Sample Rate Control", () => {
      it("should have setSampleRate and getSampleRate methods", () => {
        expect(typeof device.setSampleRate).toBe("function");
        expect(typeof device.getSampleRate).toBe("function");
      });

      it("should have getUsableBandwidth method", () => {
        expect(typeof device.getUsableBandwidth).toBe("function");
      });

      it("should define supported sample rates in capabilities", () => {
        const capabilities = device.getCapabilities();
        expect(Array.isArray(capabilities.supportedSampleRates)).toBe(true);
        expect(capabilities.supportedSampleRates.length).toBeGreaterThan(0);
      });
    });

    describe("Gain Control", () => {
      it("should have setLNAGain method", () => {
        expect(typeof device.setLNAGain).toBe("function");
      });

      it("should have setAmpEnable method", () => {
        expect(typeof device.setAmpEnable).toBe("function");
      });

      it("should declare amp and antenna support in capabilities", () => {
        const capabilities = device.getCapabilities();
        expect(typeof capabilities.supportsAmpControl).toBe("boolean");
        expect(typeof capabilities.supportsAntennaControl).toBe("boolean");
      });
    });

    describe("Sample Processing", () => {
      it("should parse samples", () => {
        // Create test data
        const testData = new DataView(new ArrayBuffer(1024));
        
        const samples = device.parseSamples(testData);
        expect(Array.isArray(samples)).toBe(true);
        
        // Each sample should have I and Q components
        if (samples.length > 0) {
          expect(samples[0]).toHaveProperty("I");
          expect(samples[0]).toHaveProperty("Q");
          expect(typeof samples[0].I).toBe("number");
          expect(typeof samples[0].Q).toBe("number");
        }
      });
    });

    describe("Memory Management", () => {
      it("should provide memory info", () => {
        const memInfo = device.getMemoryInfo();
        expect(memInfo).toBeDefined();
        expect(memInfo.totalBufferSize).toBeGreaterThanOrEqual(0);
        expect(memInfo.usedBufferSize).toBeGreaterThanOrEqual(0);
        expect(memInfo.activeBuffers).toBeGreaterThanOrEqual(0);
      });

      it("should clear buffers", () => {
        expect(() => device.clearBuffers()).not.toThrow();
      });
    });

    describe("Device Reset", () => {
      it("should have reset method", () => {
        expect(typeof device.reset).toBe("function");
      });
    });
  });
}

// Run conformance tests for all built-in drivers
describe("Hardware Driver HAL Conformance Tests", () => {
  createDriverConformanceTests(
    "HackRF One",
    (usbDevice) => new HackRFOneAdapter(usbDevice),
    0x1d50, // HackRF vendor ID
    0x6089, // HackRF product ID
  );

  createDriverConformanceTests(
    "RTL-SDR",
    (usbDevice) => new RTLSDRDeviceAdapter(usbDevice),
    0x0bda, // RTL-SDR vendor ID
    0x2838, // RTL-SDR product ID
  );
});

/**
 * Additional HAL interface validation tests
 */
describe("HAL Interface Validation", () => {
  it("should export ISDRDevice interface from drivers module", () => {
    // This is a type-checking test - it validates at compile time
    const checkInterface = (device: ISDRDevice): void => {
      // Required methods
      expect(typeof device.getDeviceInfo).toBe("function");
      expect(typeof device.getCapabilities).toBe("function");
      expect(typeof device.open).toBe("function");
      expect(typeof device.close).toBe("function");
      expect(typeof device.isOpen).toBe("function");
      expect(typeof device.setFrequency).toBe("function");
      expect(typeof device.getFrequency).toBe("function");
      expect(typeof device.setSampleRate).toBe("function");
      expect(typeof device.getSampleRate).toBe("function");
      expect(typeof device.getUsableBandwidth).toBe("function");
      expect(typeof device.setLNAGain).toBe("function");
      expect(typeof device.setAmpEnable).toBe("function");
      expect(typeof device.receive).toBe("function");
      expect(typeof device.stopRx).toBe("function");
      expect(typeof device.isReceiving).toBe("function");
      expect(typeof device.parseSamples).toBe("function");
      expect(typeof device.getMemoryInfo).toBe("function");
      expect(typeof device.clearBuffers).toBe("function");
      expect(typeof device.reset).toBe("function");
    };

    // Create a mock device to test
    const mockDevice = createMockUSBDevice(0x1d50, 0x6089);
    const hackrf = new HackRFOneAdapter(mockDevice);
    checkInterface(hackrf);
  });

  it("should have consistent capabilities structure", () => {
    const mockDevice = createMockUSBDevice(0x1d50, 0x6089);
    const hackrf = new HackRFOneAdapter(mockDevice);
    const caps = hackrf.getCapabilities();

    // Required fields
    expect(caps).toHaveProperty("minFrequency");
    expect(caps).toHaveProperty("maxFrequency");
    expect(caps).toHaveProperty("supportedSampleRates");
    expect(caps).toHaveProperty("supportsAmpControl");
    expect(caps).toHaveProperty("supportsAntennaControl");

    // Type validation
    expect(typeof caps.minFrequency).toBe("number");
    expect(typeof caps.maxFrequency).toBe("number");
    expect(Array.isArray(caps.supportedSampleRates)).toBe(true);
    expect(typeof caps.supportsAmpControl).toBe("boolean");
    expect(typeof caps.supportsAntennaControl).toBe("boolean");
  });
});
