/**
 * Device Utilities
 * Common helper functions for working with SDR devices
 */

/**
 * Safely get sample rate from device
 * Handles both device.config.sampleRate and device.sampleRate patterns
 * @param device SDR device instance
 * @returns Sample rate in Hz
 */
export function getSampleRate(device: any): number {
  return device.config?.sampleRate ?? device.sampleRate ?? 2_000_000;
}
