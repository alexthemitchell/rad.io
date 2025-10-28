/**
 * Tests for built-in driver registration
 */

import { SDRDeviceType } from "../../models/SDRDevice";
import { registerBuiltinDrivers } from "../registerBuiltinDrivers";
import { SDRDriverRegistry } from "../SDRDriverRegistry";

describe("registerBuiltinDrivers", () => {
  beforeEach(() => {
    SDRDriverRegistry.clear();
  });

  it("should register HackRF One driver", () => {
    registerBuiltinDrivers();

    const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
    expect(metadata).toBeDefined();
    expect(metadata?.deviceType).toBe(SDRDeviceType.HACKRF_ONE);
    expect(metadata?.name).toBe("HackRF One");
  });

  it("should register RTL-SDR driver", () => {
    registerBuiltinDrivers();

    const metadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
    expect(metadata).toBeDefined();
    expect(metadata?.deviceType).toBe(SDRDeviceType.RTLSDR);
    expect(metadata?.name).toBe("RTL-SDR");
  });

  it("should register multiple drivers", () => {
    registerBuiltinDrivers();

    const drivers = SDRDriverRegistry.getAllDrivers();
    expect(drivers.length).toBeGreaterThanOrEqual(2);
  });

  it("should include USB filters for HackRF One", () => {
    registerBuiltinDrivers();

    const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
    expect(metadata?.usbFilters).toHaveLength(1);
    expect(metadata?.usbFilters[0]?.vendorId).toBe(0x1d50);
    expect(metadata?.usbFilters[0]?.productId).toBe(0x6089);
  });

  it("should include USB filters for RTL-SDR", () => {
    registerBuiltinDrivers();

    const metadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
    expect(metadata?.usbFilters.length).toBeGreaterThanOrEqual(1);

    // Check for generic RTL-SDR filter
    const hasGenericFilter = metadata?.usbFilters.some(
      (f) => f.vendorId === 0x0bda && f.productId === 0x2838,
    );
    expect(hasGenericFilter).toBe(true);
  });

  it("should provide capabilities for HackRF One", () => {
    registerBuiltinDrivers();

    const metadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
    expect(metadata?.capabilities.minFrequency).toBe(1e6);
    expect(metadata?.capabilities.maxFrequency).toBe(6e9);
    expect(metadata?.capabilities.supportedSampleRates.length).toBeGreaterThan(
      0,
    );
  });

  it("should provide capabilities for RTL-SDR", () => {
    registerBuiltinDrivers();

    const metadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
    expect(metadata?.capabilities.minFrequency).toBe(24e6);
    expect(metadata?.capabilities.maxFrequency).toBe(1.7e9);
    expect(metadata?.capabilities.supportedSampleRates.length).toBeGreaterThan(
      0,
    );
  });

  it("should mark all drivers as requiring WebUSB", () => {
    registerBuiltinDrivers();

    const drivers = SDRDriverRegistry.getAllDrivers();
    for (const driver of drivers) {
      expect(driver.metadata.requiresWebUSB).toBe(true);
    }
  });

  it("should include documentation URLs", () => {
    registerBuiltinDrivers();

    const hackrfMetadata = SDRDriverRegistry.getDriverMetadata("hackrf-one");
    expect(hackrfMetadata?.documentationUrl).toBeDefined();
    expect(hackrfMetadata?.documentationUrl).toContain("http");

    const rtlsdrMetadata = SDRDriverRegistry.getDriverMetadata("rtl-sdr");
    expect(rtlsdrMetadata?.documentationUrl).toBeDefined();
    expect(rtlsdrMetadata?.documentationUrl).toContain("http");
  });

  it("should not mark drivers as experimental", () => {
    registerBuiltinDrivers();

    const drivers = SDRDriverRegistry.getAllDrivers();
    for (const driver of drivers) {
      expect(driver.metadata.experimental).toBeFalsy();
    }
  });

  it("should create HackRF device instance", async () => {
    registerBuiltinDrivers();

    const mockUSBDevice = {
      vendorId: 0x1d50,
      productId: 0x6089,
      opened: false,
    } as USBDevice;

    const device = await SDRDriverRegistry.createDevice(mockUSBDevice);
    expect(device).toBeDefined();

    const info = await device.getDeviceInfo();
    expect(info.type).toBe(SDRDeviceType.HACKRF_ONE);
  });

  it("should create RTL-SDR device instance", async () => {
    registerBuiltinDrivers();

    const mockUSBDevice = {
      vendorId: 0x0bda,
      productId: 0x2838,
      opened: false,
    } as USBDevice;

    const device = await SDRDriverRegistry.createDevice(mockUSBDevice);
    expect(device).toBeDefined();

    const info = await device.getDeviceInfo();
    expect(info.type).toBe(SDRDeviceType.RTLSDR);
  });
});
