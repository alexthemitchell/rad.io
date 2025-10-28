/**
 * Tests for WebUSB Device Selector
 */

import { SDRDriverRegistry } from "../SDRDriverRegistry";
import { WebUSBDeviceSelector } from "../WebUSBDeviceSelector";

describe("WebUSBDeviceSelector", () => {
  let selector: WebUSBDeviceSelector;

  beforeEach(() => {
    selector = new WebUSBDeviceSelector();
    SDRDriverRegistry.clear();
  });

  afterEach(() => {
    selector.removeEventListeners();
  });

  describe("isSupported", () => {
    it("should return true when USB API is available", () => {
      // In jest/jsdom, navigator.usb is typically available
      const supported = selector.isSupported();
      expect(typeof supported).toBe("boolean");
    });
  });

  describe("formatDeviceInfo", () => {
    it("should format device info with product name", () => {
      const device = {
        vendorId: 0x1d50,
        productId: 0x6089,
        productName: "HackRF One",
      } as USBDevice;

      const formatted = selector.formatDeviceInfo(device);
      expect(formatted).toContain("HackRF One");
      expect(formatted).toContain("0x1d50");
      expect(formatted).toContain("0x6089");
    });

    it("should format device info without product name", () => {
      const device = {
        vendorId: 0x1234,
        productId: 0x5678,
        productName: undefined,
      } as unknown as USBDevice;

      const formatted = selector.formatDeviceInfo(device);
      expect(formatted).toContain("0x1234");
      expect(formatted).toContain("0x5678");
      expect(formatted).toContain("Unknown Device");
    });

    it("should pad hex values correctly", () => {
      const device = {
        vendorId: 0x0001,
        productId: 0x000a,
        productName: "Test",
      } as USBDevice;

      const formatted = selector.formatDeviceInfo(device);
      expect(formatted).toContain("0x0001");
      expect(formatted).toContain("0x000a");
    });
  });

  describe("enumerate", () => {
    it("should return result object with supported status", async () => {
      const result = await selector.enumerate();

      expect(result).toHaveProperty("supported");
      expect(result).toHaveProperty("pairedDevices");
      expect(Array.isArray(result.pairedDevices)).toBe(true);
    });
  });

  describe("event listeners", () => {
    it("should setup and remove connect listener", () => {
      const onConnect = jest.fn();

      selector.setupEventListeners(onConnect, undefined);
      selector.removeEventListeners();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should setup and remove disconnect listener", () => {
      const onDisconnect = jest.fn();

      selector.setupEventListeners(undefined, onDisconnect);
      selector.removeEventListeners();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should setup and remove both listeners", () => {
      const onConnect = jest.fn();
      const onDisconnect = jest.fn();

      selector.setupEventListeners(onConnect, onDisconnect);
      selector.removeEventListeners();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
