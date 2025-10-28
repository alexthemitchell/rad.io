/**
 * Built-in SDR Driver Registrations
 *
 * This module registers all built-in SDR device drivers with the driver registry.
 * Import and call registerBuiltinDrivers() at application startup to enable
 * automatic driver discovery and device creation.
 */

import { HackRFOneAdapter } from "../hackrf/HackRFOneAdapter";
import { RTLSDRDeviceAdapter } from "../models/RTLSDRDeviceAdapter";
import { SDRDeviceType } from "../models/SDRDevice";
import { SDRDriverRegistry } from "./SDRDriverRegistry";

/**
 * Register all built-in SDR drivers
 *
 * This function registers:
 * - HackRF One driver
 * - RTL-SDR driver
 *
 * Call this at application startup before any device operations.
 *
 * Example:
 * ```typescript
 * import { registerBuiltinDrivers } from './drivers/registerBuiltinDrivers';
 *
 * // At app startup
 * registerBuiltinDrivers();
 * ```
 */
export function registerBuiltinDrivers(): void {
  // Register HackRF One driver
  SDRDriverRegistry.register({
    metadata: {
      id: "hackrf-one",
      name: "HackRF One",
      deviceType: SDRDeviceType.HACKRF_ONE,
      version: "1.0.0",
      description:
        "Driver for HackRF One SDR device. Supports 1 MHz to 6 GHz frequency range.",
      usbFilters: [
        {
          vendorId: 0x1d50,
          productId: 0x6089,
        },
      ],
      capabilities: {
        minFrequency: 1e6, // 1 MHz
        maxFrequency: 6e9, // 6 GHz
        supportedSampleRates: [1e6, 2e6, 4e6, 8e6, 10e6, 12.5e6, 16e6, 20e6],
        maxLNAGain: 40, // 0-40 dB in 8 dB steps
        maxVGAGain: 62, // 0-62 dB in 2 dB steps
        supportsAmpControl: true,
        supportsAntennaControl: true,
        supportedBandwidths: [
          1.75e6, 2.5e6, 3.5e6, 5e6, 5.5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6,
          14e6, 15e6, 20e6, 24e6, 28e6,
        ],
        maxBandwidth: 20e6, // 20 MHz maximum
      },
      requiresWebUSB: true,
      documentationUrl: "https://hackrf.readthedocs.io/",
      experimental: false,
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    factory: async (usbDevice: USBDevice) => {
      return new HackRFOneAdapter(usbDevice);
    },
  });

  // Register RTL-SDR driver
  SDRDriverRegistry.register({
    metadata: {
      id: "rtl-sdr",
      name: "RTL-SDR",
      deviceType: SDRDeviceType.RTLSDR,
      version: "1.0.0",
      description:
        "Driver for RTL-SDR dongles (RTL2832U-based). " +
        "Supports 24 MHz to 1.7 GHz frequency range.",
      usbFilters: [
        {
          vendorId: 0x0bda,
          productId: 0x2838, // Generic RTL-SDR
        },
        {
          vendorId: 0x0bda,
          productId: 0x2832, // RTL-SDR EzCap
        },
      ],
      capabilities: {
        minFrequency: 24e6, // 24 MHz
        maxFrequency: 1.7e9, // 1.7 GHz
        supportedSampleRates: [
          225001, 300000, 900001, 1024000, 1536000, 1800000, 1920000, 2048000,
          2400000, 2560000, 2880000, 3200000,
        ],
        maxLNAGain: 49.6, // 0-49.6 dB
        supportsAmpControl: false,
        supportsAntennaControl: false,
        maxBandwidth: 3.2e6, // 3.2 MHz maximum
      },
      requiresWebUSB: true,
      documentationUrl: "https://osmocom.org/projects/rtl-sdr/wiki",
      experimental: false,
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    factory: async (usbDevice: USBDevice) => {
      return new RTLSDRDeviceAdapter(usbDevice);
    },
  });
}
