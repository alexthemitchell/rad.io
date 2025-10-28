/**
 * Tests for SDR Driver Registry
 */

import { ISDRDevice, SDRDeviceType } from "../../models/SDRDevice";
import {
  SDRDriverRegistry,
  SDRDriverRegistration,
} from "../SDRDriverRegistry";

describe("SDRDriverRegistry", () => {
  // Mock USB device
  const createMockUSBDevice = (
    vendorId: number,
    productId: number,
  ): USBDevice => {
    return {
      vendorId,
      productId,
      productName: "Mock Device",
      manufacturerName: "Mock Manufacturer",
      serialNumber: "12345",
      opened: false,
    } as USBDevice;
  };

  // Mock driver registration
  const createMockRegistration = (
    id: string,
    vendorId: number,
    productId?: number,
  ): SDRDriverRegistration => {
    return {
      metadata: {
        id,
        name: `Mock Driver ${id}`,
        deviceType: SDRDeviceType.GENERIC,
        version: "1.0.0",
        description: "Mock driver for testing",
        usbFilters: [
          {
            vendorId,
            productId,
          },
        ],
        capabilities: {
          minFrequency: 1e6,
          maxFrequency: 6e9,
          supportedSampleRates: [1e6, 2e6],
          supportsAmpControl: false,
          supportsAntennaControl: false,
        },
        requiresWebUSB: true,
      },
      factory: async () => {
        return {
          getDeviceInfo: async () => ({
            type: SDRDeviceType.GENERIC,
            vendorId,
            productId: productId || 0,
          }),
        } as ISDRDevice;
      },
    };
  };

  beforeEach(() => {
    // Clear registry before each test
    SDRDriverRegistry.clear();
  });

  describe("register", () => {
    it("should register a new driver", () => {
      const registration = createMockRegistration("test-driver", 0x1234);
      SDRDriverRegistry.register(registration);

      const drivers = SDRDriverRegistry.getAllDrivers();
      expect(drivers).toHaveLength(1);
      expect(drivers[0].metadata.id).toBe("test-driver");
    });

    it("should throw error when registering duplicate driver ID", () => {
      const registration = createMockRegistration("test-driver", 0x1234);
      SDRDriverRegistry.register(registration);

      expect(() => {
        SDRDriverRegistry.register(registration);
      }).toThrow(/already registered/);
    });

    it("should allow registering multiple drivers", () => {
      SDRDriverRegistry.register(createMockRegistration("driver-1", 0x1234));
      SDRDriverRegistry.register(createMockRegistration("driver-2", 0x5678));

      const drivers = SDRDriverRegistry.getAllDrivers();
      expect(drivers).toHaveLength(2);
    });
  });

  describe("unregister", () => {
    it("should unregister an existing driver", () => {
      const registration = createMockRegistration("test-driver", 0x1234);
      SDRDriverRegistry.register(registration);

      const result = SDRDriverRegistry.unregister("test-driver");
      expect(result).toBe(true);
      expect(SDRDriverRegistry.getAllDrivers()).toHaveLength(0);
    });

    it("should return false when unregistering non-existent driver", () => {
      const result = SDRDriverRegistry.unregister("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("getDriverMetadata", () => {
    it("should return metadata for registered driver", () => {
      const registration = createMockRegistration("test-driver", 0x1234);
      SDRDriverRegistry.register(registration);

      const metadata = SDRDriverRegistry.getDriverMetadata("test-driver");
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe("test-driver");
      expect(metadata?.name).toBe("Mock Driver test-driver");
    });

    it("should return undefined for non-existent driver", () => {
      const metadata = SDRDriverRegistry.getDriverMetadata("non-existent");
      expect(metadata).toBeUndefined();
    });
  });

  describe("getAllUSBFilters", () => {
    it("should return empty array when no drivers registered", () => {
      const filters = SDRDriverRegistry.getAllUSBFilters();
      expect(filters).toEqual([]);
    });

    it("should return filters from single driver", () => {
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234, 0x5678));

      const filters = SDRDriverRegistry.getAllUSBFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0].vendorId).toBe(0x1234);
      expect(filters[0].productId).toBe(0x5678);
    });

    it("should return combined filters from multiple drivers", () => {
      SDRDriverRegistry.register(createMockRegistration("driver-1", 0x1234));
      SDRDriverRegistry.register(createMockRegistration("driver-2", 0x5678));

      const filters = SDRDriverRegistry.getAllUSBFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0].vendorId).toBe(0x1234);
      expect(filters[1].vendorId).toBe(0x5678);
    });
  });

  describe("getDriverForDevice", () => {
    it("should find driver matching vendorId and productId", () => {
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234, 0x5678));

      const device = createMockUSBDevice(0x1234, 0x5678);
      const driver = SDRDriverRegistry.getDriverForDevice(device);

      expect(driver).toBeDefined();
      expect(driver?.metadata.id).toBe("test");
    });

    it("should find driver matching only vendorId when productId not specified", () => {
      // Register driver without productId filter
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234));

      const device = createMockUSBDevice(0x1234, 0x9999);
      const driver = SDRDriverRegistry.getDriverForDevice(device);

      expect(driver).toBeDefined();
      expect(driver?.metadata.id).toBe("test");
    });

    it("should return undefined when no matching driver found", () => {
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234, 0x5678));

      const device = createMockUSBDevice(0xabcd, 0xef01);
      const driver = SDRDriverRegistry.getDriverForDevice(device);

      expect(driver).toBeUndefined();
    });

    it("should not match when productId differs and is specified in filter", () => {
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234, 0x5678));

      const device = createMockUSBDevice(0x1234, 0x9999);
      const driver = SDRDriverRegistry.getDriverForDevice(device);

      expect(driver).toBeUndefined();
    });
  });

  describe("createDevice", () => {
    it("should create device instance using matched driver", async () => {
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234, 0x5678));

      const usbDevice = createMockUSBDevice(0x1234, 0x5678);
      const device = await SDRDriverRegistry.createDevice(usbDevice);

      expect(device).toBeDefined();
      const info = await device.getDeviceInfo();
      expect(info.vendorId).toBe(0x1234);
    });

    it("should throw error when no compatible driver found", async () => {
      SDRDriverRegistry.register(createMockRegistration("test", 0x1234, 0x5678));

      const usbDevice = createMockUSBDevice(0xabcd, 0xef01);

      await expect(SDRDriverRegistry.createDevice(usbDevice)).rejects.toThrow(
        /No compatible driver found/,
      );
    });
  });

  describe("clear", () => {
    it("should remove all registered drivers", () => {
      SDRDriverRegistry.register(createMockRegistration("driver-1", 0x1234));
      SDRDriverRegistry.register(createMockRegistration("driver-2", 0x5678));

      expect(SDRDriverRegistry.getAllDrivers()).toHaveLength(2);

      SDRDriverRegistry.clear();

      expect(SDRDriverRegistry.getAllDrivers()).toHaveLength(0);
    });
  });
});
