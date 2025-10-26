/**
 * USB utility helpers
 */

/**
 * Attempt to extract a WebUSB USBDevice from an unknown adapter-like object.
 *
 * The adapter may expose the underlying WebUSB device as a `device` property.
 * This guard validates presence and basic shape (numeric vendorId/productId).
 *
 * Contract
 * - Input: unknown value (adapter or anything)
 * - Output: USBDevice if present and well-formed; otherwise undefined
 * - Errors: none (pure runtime check)
 */
export function extractUSBDevice(x: unknown): USBDevice | undefined {
  if (!x || typeof x !== "object") {
    return undefined;
  }
  const maybe = (x as { device?: unknown }).device;
  if (!maybe || typeof maybe !== "object") {
    return undefined;
  }
  const d = maybe as USBDevice;
  if (typeof d.vendorId === "number" && typeof d.productId === "number") {
    return d;
  }
  return undefined;
}
