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
