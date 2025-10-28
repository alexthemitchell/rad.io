/**
 * Tests for Driver Hot Reload
 */

import { SDRDeviceType } from "../../models/SDRDevice";
import { DriverHotReload } from "../DriverHotReload";
import { SDRDriverRegistry, SDRDriverRegistration } from "../SDRDriverRegistry";

describe("DriverHotReload", () => {
  let hotReload: DriverHotReload;
  let mockRegistration: SDRDriverRegistration;

  beforeEach(() => {
    SDRDriverRegistry.clear();
    hotReload = new DriverHotReload();

    mockRegistration = {
      metadata: {
        id: "test-driver",
        name: "Test Driver",
        deviceType: SDRDeviceType.GENERIC,
        version: "1.0.0",
        description: "Test driver",
        usbFilters: [{ vendorId: 0x1234 }],
        capabilities: {
          minFrequency: 1e6,
          maxFrequency: 6e9,
          supportedSampleRates: [1e6],
          supportsAmpControl: false,
          supportsAntennaControl: false,
        },
        requiresWebUSB: true,
      },
      factory: async () => ({}) as any,
    };
  });

  afterEach(() => {
    SDRDriverRegistry.clear();
  });

  describe("reloadDriver", () => {
    it("should register a new driver when none exists", () => {
      const result = hotReload.reloadDriver("test-driver", mockRegistration);

      expect(result.success).toBe(true);
      expect(result.driverId).toBe("test-driver");
      expect(result.previousDriver).toBeUndefined();
      expect(hotReload.isDriverLoaded("test-driver")).toBe(true);
    });

    it("should replace an existing driver", () => {
      // Register initial driver
      SDRDriverRegistry.register(mockRegistration);

      // Create updated registration
      const updatedRegistration: SDRDriverRegistration = {
        ...mockRegistration,
        metadata: {
          ...mockRegistration.metadata,
          version: "2.0.0",
        },
      };

      const result = hotReload.reloadDriver("test-driver", updatedRegistration);

      expect(result.success).toBe(true);
      expect(result.previousDriver).toBeDefined();
      expect(result.previousDriver?.metadata.version).toBe("1.0.0");

      const currentMetadata =
        SDRDriverRegistry.getDriverMetadata("test-driver");
      expect(currentMetadata?.version).toBe("2.0.0");
    });

    it("should invoke beforeUnload callback", () => {
      SDRDriverRegistry.register(mockRegistration);

      const beforeUnload = jest.fn();
      const updatedRegistration = {
        ...mockRegistration,
        metadata: { ...mockRegistration.metadata, version: "2.0.0" },
      };

      hotReload.reloadDriver("test-driver", updatedRegistration, {
        beforeUnload,
      });

      expect(beforeUnload).toHaveBeenCalledWith("test-driver");
    });

    it("should invoke afterLoad callback", () => {
      const afterLoad = jest.fn();

      hotReload.reloadDriver("test-driver", mockRegistration, {
        afterLoad,
      });

      expect(afterLoad).toHaveBeenCalledWith("test-driver");
    });

    it("should handle registration errors gracefully", () => {
      // Start with a registered driver
      SDRDriverRegistry.register(mockRegistration);

      // Create registration with invalid ID that will cause issues
      const invalidRegistration: SDRDriverRegistration = {
        metadata: {
          id: "different-id", // Different ID means original won't be replaced
          name: "Invalid",
          deviceType: SDRDeviceType.GENERIC,
          version: "2.0.0",
          description: "Invalid",
          usbFilters: [],
          capabilities: {
            minFrequency: 1e6,
            maxFrequency: 6e9,
            supportedSampleRates: [],
            supportsAmpControl: false,
            supportsAntennaControl: false,
          },
          requiresWebUSB: true,
        },
        factory: async () => ({}) as any,
      };

      // This should succeed because it's registering with a different ID
      const result = hotReload.reloadDriver("test-driver", invalidRegistration);

      // Since we're using driver ID "test-driver" but registration has "different-id",
      // it will unregister test-driver and register different-id
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("unloadDriver", () => {
    it("should unload an existing driver", () => {
      SDRDriverRegistry.register(mockRegistration);

      const result = hotReload.unloadDriver("test-driver");

      expect(result.success).toBe(true);
      expect(result.previousDriver).toBeDefined();
      expect(hotReload.isDriverLoaded("test-driver")).toBe(false);
    });

    it("should fail when driver doesn't exist", () => {
      const result = hotReload.unloadDriver("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should invoke beforeUnload callback", () => {
      SDRDriverRegistry.register(mockRegistration);

      const beforeUnload = jest.fn();

      hotReload.unloadDriver("test-driver", { beforeUnload });

      expect(beforeUnload).toHaveBeenCalledWith("test-driver");
    });
  });

  describe("getLoadedDrivers", () => {
    it("should return empty array when no drivers loaded", () => {
      expect(hotReload.getLoadedDrivers()).toEqual([]);
    });

    it("should return list of loaded driver IDs", () => {
      SDRDriverRegistry.register(mockRegistration);
      SDRDriverRegistry.register({
        ...mockRegistration,
        metadata: { ...mockRegistration.metadata, id: "driver-2" },
      });

      const drivers = hotReload.getLoadedDrivers();

      expect(drivers).toHaveLength(2);
      expect(drivers).toContain("test-driver");
      expect(drivers).toContain("driver-2");
    });
  });

  describe("isDriverLoaded", () => {
    it("should return false for unloaded driver", () => {
      expect(hotReload.isDriverLoaded("test-driver")).toBe(false);
    });

    it("should return true for loaded driver", () => {
      SDRDriverRegistry.register(mockRegistration);

      expect(hotReload.isDriverLoaded("test-driver")).toBe(true);
    });
  });

  describe("reloadAllDrivers", () => {
    it("should reload multiple drivers", () => {
      const drivers = new Map<string, SDRDriverRegistration>();
      drivers.set("driver-1", {
        ...mockRegistration,
        metadata: { ...mockRegistration.metadata, id: "driver-1" },
      });
      drivers.set("driver-2", {
        ...mockRegistration,
        metadata: { ...mockRegistration.metadata, id: "driver-2" },
      });

      const results = hotReload.reloadAllDrivers(drivers);

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(true);
      expect(hotReload.getLoadedDrivers()).toHaveLength(2);
    });

    it("should return results for each driver", () => {
      const drivers = new Map<string, SDRDriverRegistration>();
      drivers.set("driver-1", {
        ...mockRegistration,
        metadata: { ...mockRegistration.metadata, id: "driver-1" },
      });

      const results = hotReload.reloadAllDrivers(drivers);

      expect(results).toHaveLength(1);
      expect(results[0]?.driverId).toBe("driver-1");
    });
  });
});
