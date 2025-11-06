/**
 * HAL Conformance Tests
 *
 * These tests validate that all registered SDR drivers conform to the
 * ISDRDevice interface requirements and work correctly with the driver registry.
 */

import { SDRDriverRegistry, registerBuiltinDrivers } from "../index";
import { SDRDeviceType } from "../../models/SDRDevice";

describe("HAL Conformance Tests", () => {
  beforeEach(() => {
    // Clear registry before each test
    SDRDriverRegistry.clear();
  });

  describe("Driver Registry", () => {
    it("should register built-in drivers without errors", () => {
      expect(() => registerBuiltinDrivers()).not.toThrow();
    });

    it("should have HackRF One driver registered", () => {
      registerBuiltinDrivers();
      const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe("HackRF One");
      expect(metadata?.deviceType).toBe(SDRDeviceType.HACKRF_ONE);
    });

    it("should have RTL-SDR driver registered", () => {
      registerBuiltinDrivers();
      const metadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe("RTL-SDR");
      expect(metadata?.deviceType).toBe(SDRDeviceType.RTLSDR);
    });

    it("should provide USB filters for all drivers", () => {
      registerBuiltinDrivers();
      const filters = SDRDriverRegistry.getAllUSBFilters();
      expect(filters.length).toBeGreaterThan(0);
      // HackRF One filter
      expect(filters).toContainEqual({
        vendorId: 0x1d50,
        productId: 0x6089,
      });
      // RTL-SDR filters
      expect(filters).toContainEqual({
        vendorId: 0x0bda,
        productId: 0x2838,
      });
    });

    it("should export all drivers from the driver registry", () => {
      registerBuiltinDrivers();
      const drivers = SDRDriverRegistry.getAllDrivers();
      expect(drivers.length).toBeGreaterThanOrEqual(2);
      
      // Verify each driver has required properties
      drivers.forEach((driver) => {
        expect(driver.metadata).toBeDefined();
        expect(driver.factory).toBeDefined();
        expect(typeof driver.factory).toBe("function");
      });
    });
  });

  describe("Driver Metadata Validation", () => {
    beforeEach(() => {
      registerBuiltinDrivers();
    });

    it("should have complete metadata for all drivers", () => {
      const drivers = SDRDriverRegistry.getAllDrivers();
      expect(drivers.length).toBeGreaterThan(0);

      drivers.forEach((driver) => {
        const meta = driver.metadata;
        expect(meta.id).toBeDefined();
        expect(meta.name).toBeDefined();
        expect(meta.deviceType).toBeDefined();
        expect(meta.version).toBeDefined();
        expect(meta.description).toBeDefined();
        expect(Array.isArray(meta.usbFilters)).toBe(true);
        expect(meta.usbFilters.length).toBeGreaterThan(0);
        expect(meta.capabilities).toBeDefined();
        expect(typeof meta.requiresWebUSB).toBe("boolean");
      });
    });

    it("should have valid USB filters", () => {
      const drivers = SDRDriverRegistry.getAllDrivers();

      drivers.forEach((driver) => {
        driver.metadata.usbFilters.forEach((filter) => {
          expect(typeof filter.vendorId).toBe("number");
          expect(typeof filter.productId).toBe("number");
          expect(filter.vendorId).toBeGreaterThan(0);
          expect(filter.productId).toBeGreaterThan(0);
        });
      });
    });

    it("should have valid capabilities for all drivers", () => {
      const drivers = SDRDriverRegistry.getAllDrivers();

      drivers.forEach((driver) => {
        const caps = driver.metadata.capabilities;
        expect(caps.minFrequency).toBeGreaterThan(0);
        expect(caps.maxFrequency).toBeGreaterThan(caps.minFrequency);
        expect(Array.isArray(caps.supportedSampleRates)).toBe(true);
        expect(caps.supportedSampleRates.length).toBeGreaterThan(0);
        
        // All sample rates should be positive
        caps.supportedSampleRates.forEach((rate) => {
          expect(rate).toBeGreaterThan(0);
        });
      });
    });

    it("should have HackRF One with correct frequency range", () => {
      const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
      expect(metadata).toBeDefined();
      expect(metadata?.capabilities.minFrequency).toBe(1e6); // 1 MHz
      expect(metadata?.capabilities.maxFrequency).toBe(6e9); // 6 GHz
    });

    it("should have HackRF One with correct sample rate support", () => {
      const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
      expect(metadata).toBeDefined();
      const sampleRates = metadata?.capabilities.supportedSampleRates || [];
      expect(sampleRates).toContain(20e6); // 20 MSPS max
      expect(sampleRates).toContain(10e6); // 10 MSPS
      expect(sampleRates).toContain(8e6);  // 8 MSPS
    });

    it("should have RTL-SDR with correct frequency range", () => {
      const metadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
      expect(metadata).toBeDefined();
      expect(metadata?.capabilities.minFrequency).toBe(24e6); // 24 MHz
      expect(metadata?.capabilities.maxFrequency).toBe(1.7e9); // 1.7 GHz
    });
  });

  describe("Device Selection and Matching", () => {
    beforeEach(() => {
      registerBuiltinDrivers();
    });

    it("should match HackRF One device by VID/PID", () => {
      const mockDevice = {
        vendorId: 0x1d50,
        productId: 0x6089,
      } as USBDevice;

      const driver = SDRDriverRegistry.getDriverForDevice(mockDevice);
      expect(driver).toBeDefined();
      expect(driver?.metadata.id).toBe("hackrf-one");
      expect(driver?.metadata.deviceType).toBe(SDRDeviceType.HACKRF_ONE);
    });

    it("should match RTL-SDR device by VID/PID", () => {
      const mockDevice = {
        vendorId: 0x0bda,
        productId: 0x2838,
      } as USBDevice;

      const driver = SDRDriverRegistry.getDriverForDevice(mockDevice);
      expect(driver).toBeDefined();
      expect(driver?.metadata.id).toBe("rtl-sdr");
      expect(driver?.metadata.deviceType).toBe(SDRDeviceType.RTLSDR);
    });

    it("should return undefined for unknown device", () => {
      const mockDevice = {
        vendorId: 0xffff,
        productId: 0xffff,
      } as USBDevice;

      const driver = SDRDriverRegistry.getDriverForDevice(mockDevice);
      expect(driver).toBeUndefined();
    });

    it("should match RTL-SDR EzCap variant", () => {
      const mockDevice = {
        vendorId: 0x0bda,
        productId: 0x2832,
      } as USBDevice;

      const driver = SDRDriverRegistry.getDriverForDevice(mockDevice);
      expect(driver).toBeDefined();
      expect(driver?.metadata.id).toBe("rtl-sdr");
    });
  });

  describe("Idempotent Registration", () => {
    it("should not re-register drivers on multiple calls", () => {
      registerBuiltinDrivers();
      const firstCount = SDRDriverRegistry.getAllDrivers().length;

      registerBuiltinDrivers();
      const secondCount = SDRDriverRegistry.getAllDrivers().length;

      expect(secondCount).toBe(firstCount);
    });

    it("should not throw error when registering multiple times", () => {
      registerBuiltinDrivers();
      expect(() => registerBuiltinDrivers()).not.toThrow();
      expect(() => registerBuiltinDrivers()).not.toThrow();
    });
  });

  describe("HAL Interface Exports", () => {
    it("should export HackRF driver from drivers module", () => {
      const driversExports = require("../index");
      expect(driversExports.HackRFOne).toBeDefined();
      expect(driversExports.HackRFOneAdapter).toBeDefined();
    });

    it("should export all core registry functions", () => {
      const driversExports = require("../index");
      expect(driversExports.SDRDriverRegistry).toBeDefined();
      expect(driversExports.WebUSBDeviceSelector).toBeDefined();
      expect(driversExports.DeviceDiscovery).toBeDefined();
      expect(driversExports.registerBuiltinDrivers).toBeDefined();
    });
  });

  describe("Driver Documentation", () => {
    beforeEach(() => {
      registerBuiltinDrivers();
    });

    it("should provide documentation URL for HackRF One", () => {
      const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
      expect(metadata?.documentationUrl).toBeDefined();
      expect(metadata?.documentationUrl).toContain("hackrf");
    });

    it("should provide documentation URL for RTL-SDR", () => {
      const metadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
      expect(metadata?.documentationUrl).toBeDefined();
      expect(metadata?.documentationUrl).toContain("rtl-sdr");
    });

    it("should mark non-experimental drivers correctly", () => {
      const drivers = SDRDriverRegistry.getAllDrivers();
      drivers.forEach((driver) => {
        // All built-in drivers should be non-experimental
        expect(driver.metadata.experimental).toBeFalsy();
      });
    });
  });
});
