/**
 * E2E testing utilities
 */

/**
 * Determine whether the app should use a mock SDR device.
 *
 * Priority (true if any is true):
 * - URL has `mockSdr=1`
 * - localStorage key `radio:e2e:mockSdr` === "1"
 * - process.env.E2E_MOCK_SDR === "1" (useful for pre-rendered environments)
 */
export function shouldUseMockSDR(): boolean {
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("mockSdr") === "1") {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== "undefined") {
      const v = window.localStorage.getItem("radio:e2e:mockSdr");
      if (v === "1") {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // At build-time only; not available in runtime usually, but safe to check
  if (typeof process !== "undefined" && process.env["E2E_MOCK_SDR"] === "1") {
    return true;
  }

  return false;
}

/**
 * Determine whether device e2e tests should run.
 *
 * Returns true if:
 * - Environment variable RADIO_E2E_DEVICE=1 is set
 * - A compatible SDR device is detected (via WebUSB)
 */
export async function shouldRunDeviceTests(): Promise<boolean> {
  // Check environment variable
  if (
    typeof process !== "undefined" &&
    process.env["RADIO_E2E_DEVICE"] !== "1"
  ) {
    return false;
  }

  // Check for WebUSB support
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    return false;
  }

  try {
    // Check for previously paired devices (HackRF vendor ID)
    const devices = await navigator.usb.getDevices();
    const hackrfDevices = devices.filter((d) => d.vendorId === 0x1d50);
    return hackrfDevices.length > 0;
  } catch {
    return false;
  }
}
