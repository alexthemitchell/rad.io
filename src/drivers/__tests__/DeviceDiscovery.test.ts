/**
 * Tests for Device Discovery
 */

import { ISDRDevice, SDRDeviceType } from "../../models/SDRDevice";
import { DeviceDiscovery } from "../DeviceDiscovery";
import { SDRDriverRegistry } from "../SDRDriverRegistry";
import { WebUSBDeviceSelector } from "../WebUSBDeviceSelector";

// Mock WebUSBDeviceSelector
jest.mock("../WebUSBDeviceSelector");

describe("DeviceDiscovery", () => {
  let discovery: DeviceDiscovery;
  let mockSelector: jest.Mocked<WebUSBDeviceSelector>;
  let mockUSBDevice: USBDevice;
  let mockSDRDevice: jest.Mocked<ISDRDevice>;

  beforeEach(() => {
    // Clear registry
    SDRDriverRegistry.clear();

    // Create mock USB device
    mockUSBDevice = {
      vendorId: 0x1234,
      productId: 0x5678,
      productName: "Test Device",
      opened: false,
    } as USBDevice;

    // Create mock SDR device
    mockSDRDevice = {
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      isOpen: jest.fn().mockReturnValue(false),
      getDeviceInfo: jest.fn().mockResolvedValue({
        type: SDRDeviceType.GENERIC,
        vendorId: 0x1234,
        productId: 0x5678,
      }),
    } as unknown as jest.Mocked<ISDRDevice>;

    // Setup mock selector
    mockSelector = {
      isSupported: jest.fn().mockReturnValue(true),
      getDevices: jest.fn().mockResolvedValue([mockUSBDevice]),
      setupEventListeners: jest.fn(),
      removeEventListeners: jest.fn(),
    } as unknown as jest.Mocked<WebUSBDeviceSelector>;

    (WebUSBDeviceSelector as jest.Mock).mockImplementation(() => mockSelector);

    discovery = new DeviceDiscovery();
  });

  afterEach(() => {
    SDRDriverRegistry.clear();
  });

  describe("isSupported", () => {
    it("should return true when WebUSB is supported", () => {
      mockSelector.isSupported.mockReturnValue(true);
      expect(discovery.isSupported()).toBe(true);
    });

    it("should return false when WebUSB is not supported", () => {
      mockSelector.isSupported.mockReturnValue(false);
      expect(discovery.isSupported()).toBe(false);
    });
  });

  describe("discoverDevices", () => {
    beforeEach(() => {
      // Register a test driver
      SDRDriverRegistry.register({
        metadata: {
          id: "test-driver",
          name: "Test Driver",
          deviceType: SDRDeviceType.GENERIC,
          version: "1.0.0",
          description: "Test driver",
          usbFilters: [{ vendorId: 0x1234, productId: 0x5678 }],
          capabilities: {
            minFrequency: 1e6,
            maxFrequency: 6e9,
            supportedSampleRates: [1e6],
            supportsAmpControl: false,
            supportsAntennaControl: false,
          },
          requiresWebUSB: true,
        },
        factory: async () => mockSDRDevice,
      });
    });

    it("should return not supported when WebUSB is unavailable", async () => {
      mockSelector.isSupported.mockReturnValue(false);

      const result = await discovery.discoverDevices();

      expect(result.supported).toBe(false);
      expect(result.devices).toEqual([]);
    });

    it("should discover paired devices", async () => {
      const result = await discovery.discoverDevices();

      expect(result.supported).toBe(true);
      expect(result.devices).toHaveLength(1);
      expect(result.devices[0]).toBe(mockSDRDevice);
      expect(result.failedDevices).toHaveLength(0);
    });

    it("should open devices when autoOpen is true", async () => {
      await discovery.discoverDevices({ autoOpen: true });

      expect(mockSDRDevice.open).toHaveBeenCalled();
    });

    it("should not open devices when autoOpen is false", async () => {
      await discovery.discoverDevices({ autoOpen: false });

      expect(mockSDRDevice.open).not.toHaveBeenCalled();
    });

    it("should invoke onDeviceDiscovered callback", async () => {
      const onDiscovered = jest.fn();

      await discovery.discoverDevices({ onDeviceDiscovered: onDiscovered });

      expect(onDiscovered).toHaveBeenCalledWith(mockSDRDevice, mockUSBDevice);
    });

    it("should handle device initialization errors", async () => {
      const error = new Error("Init failed");
      SDRDriverRegistry.clear();
      SDRDriverRegistry.register({
        metadata: {
          id: "failing-driver",
          name: "Failing Driver",
          deviceType: SDRDeviceType.GENERIC,
          version: "1.0.0",
          description: "Failing driver",
          usbFilters: [{ vendorId: 0x1234, productId: 0x5678 }],
          capabilities: {
            minFrequency: 1e6,
            maxFrequency: 6e9,
            supportedSampleRates: [1e6],
            supportsAmpControl: false,
            supportsAntennaControl: false,
          },
          requiresWebUSB: true,
        },
        factory: async () => {
          throw error;
        },
      });

      const onError = jest.fn();

      const result = await discovery.discoverDevices({ onDeviceError: onError });

      expect(result.devices).toHaveLength(0);
      expect(result.failedDevices).toHaveLength(1);
      expect(result.failedDevices[0].error).toBe(error);
      expect(onError).toHaveBeenCalledWith(mockUSBDevice, error);
    });

    it("should skip devices with no registered driver", async () => {
      SDRDriverRegistry.clear();

      const result = await discovery.discoverDevices();

      expect(result.devices).toHaveLength(0);
      expect(result.failedDevices).toHaveLength(0);
    });
  });

  describe("discoverMatchingDevices", () => {
    beforeEach(() => {
      SDRDriverRegistry.register({
        metadata: {
          id: "test-driver",
          name: "Test Driver",
          deviceType: SDRDeviceType.GENERIC,
          version: "1.0.0",
          description: "Test driver",
          usbFilters: [{ vendorId: 0x1234, productId: 0x5678 }],
          capabilities: {
            minFrequency: 1e6,
            maxFrequency: 6e9,
            supportedSampleRates: [1e6],
            supportsAmpControl: false,
            supportsAntennaControl: false,
          },
          requiresWebUSB: true,
        },
        factory: async () => mockSDRDevice,
      });
    });

    it("should filter devices by predicate", async () => {
      const predicate = (device: ISDRDevice, usb: USBDevice): boolean => {
        return usb.vendorId === 0x1234;
      };

      const result = await discovery.discoverMatchingDevices(predicate);

      expect(result.devices).toHaveLength(1);
    });

    it("should exclude non-matching devices", async () => {
      const predicate = (): boolean => false;

      const result = await discovery.discoverMatchingDevices(predicate);

      expect(result.devices).toHaveLength(0);
    });

    it("should invoke callback only for matching devices", async () => {
      const onDiscovered = jest.fn();
      const predicate = (): boolean => true;

      await discovery.discoverMatchingDevices(predicate, {
        onDeviceDiscovered: onDiscovered,
      });

      expect(onDiscovered).toHaveBeenCalledTimes(1);
    });
  });

  describe("watchDevices", () => {
    it("should setup event listeners", () => {
      const onConnect = jest.fn();
      const onDisconnect = jest.fn();

      discovery.watchDevices(onConnect, onDisconnect);

      expect(mockSelector.setupEventListeners).toHaveBeenCalledWith(
        onConnect,
        onDisconnect,
      );
    });
  });

  describe("stopWatching", () => {
    it("should remove event listeners", () => {
      discovery.stopWatching();

      expect(mockSelector.removeEventListeners).toHaveBeenCalled();
    });
  });
});
