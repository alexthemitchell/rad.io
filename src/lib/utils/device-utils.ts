/**
 * Device Utilities
 * Common helper functions for working with SDR devices
 */

/**
 * SDR Device interface
 */
export interface ISDRDevice {
  config?: {
    sampleRate?: number;
  };
  sampleRate?: number;
  setFrequency?: (freq: number) => Promise<void>;
  captureSamples?: (count: number) => Promise<Float32Array>;
}

/**
 * Safely get sample rate from device
 * Handles both device.config.sampleRate and device.sampleRate patterns
 * @param device SDR device instance
 * @returns Sample rate in Hz
 */
export function getSampleRate(device: ISDRDevice): number {
  return device.config?.sampleRate ?? device.sampleRate ?? 2_000_000;
}
