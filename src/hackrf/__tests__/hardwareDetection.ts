/**
 * Hardware detection utilities for HackRF device testing.
 *
 * This module provides utilities to detect whether a physical HackRF device
 * is connected and available for testing. Tests can use these utilities to
 * conditionally skip hardware-specific tests when no device is present.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Check if hardware tests should run based on environment variable.
 * Set HACKRF_HARDWARE_TESTS=true to enable hardware tests.
 */
export function shouldRunHardwareTests(): boolean {
  return process.env["HACKRF_HARDWARE_TESTS"] === "true";
}

/**
 * Check if hackrf_info command is available in the system.
 * This verifies that the HackRF command-line tools are installed.
 *
 * @returns true if hackrf_info is available, false otherwise
 */
export async function isHackRFCommandAvailable(): Promise<boolean> {
  try {
    // Try to run hackrf_info with --help to check if it's installed
    await execAsync("hackrf_info --help", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a physical HackRF device is connected and detectable.
 * Uses the hackrf_info command to detect the device.
 *
 * @returns true if a HackRF device is detected, false otherwise
 */
export async function isHackRFDeviceConnected(): Promise<boolean> {
  try {
    // Run hackrf_info to detect device
    const { stdout } = await execAsync("hackrf_info", { timeout: 5000 });

    // Check if the output indicates a device was found
    // hackrf_info prints "Found HackRF" when a device is detected
    return stdout.includes("Found HackRF");
  } catch {
    return false;
  }
}

/**
 * Test data streaming from HackRF device using hackrf_transfer.
 * This verifies that the device can actually stream data.
 *
 * @param frequencyHz Center frequency in Hz (default: 100 MHz)
 * @param sampleCount Number of samples to capture (default: 100000)
 * @returns true if streaming succeeds, false otherwise
 */
export async function testHackRFStreaming(
  frequencyHz: number = 100_000_000,
  sampleCount: number = 100_000,
): Promise<boolean> {
  try {
    // Use hackrf_transfer to capture samples to /dev/null
    // -r /dev/null: receive mode, discard data
    // -f: frequency in Hz
    // -n: number of samples
    const command = `hackrf_transfer -r /dev/null -f ${frequencyHz} -n ${sampleCount}`;

    const { stderr } = await execAsync(command, { timeout: 10000 });

    // hackrf_transfer outputs progress to stderr
    // Check for successful streaming indicators
    return stderr.includes("Total time") || stderr.includes("bytes");
  } catch {
    return false;
  }
}

/**
 * Get HackRF device information using hackrf_info command.
 * Parses the output to extract device details.
 *
 * @returns Device info object or null if device not found
 */
export async function getHackRFDeviceInfo(): Promise<{
  serialNumber?: string;
  boardId?: string;
  firmwareVersion?: string;
  partId?: string;
} | null> {
  try {
    const { stdout } = await execAsync("hackrf_info", { timeout: 5000 });

    if (!stdout.includes("Found HackRF")) {
      return null;
    }

    // Parse device information from output
    const info: {
      serialNumber?: string;
      boardId?: string;
      firmwareVersion?: string;
      partId?: string;
    } = {};

    // Extract serial number
    const serialMatch = stdout.match(/Serial number: (0x[0-9a-f]+)/i);
    if (serialMatch) {
      info.serialNumber = serialMatch[1];
    }

    // Extract board ID
    const boardMatch = stdout.match(/Board ID Number: (\d+)/i);
    if (boardMatch) {
      info.boardId = boardMatch[1];
    }

    // Extract firmware version
    const firmwareMatch = stdout.match(/Firmware Version: ([\d.]+)/i);
    if (firmwareMatch) {
      info.firmwareVersion = firmwareMatch[1];
    }

    // Extract part ID
    const partMatch = stdout.match(/Part ID Number: (0x[0-9a-f]+)/i);
    if (partMatch) {
      info.partId = partMatch[1];
    }

    return info;
  } catch {
    return null;
  }
}

/**
 * Helper to skip test if hardware is not available.
 * Use with test.skipIf() in Jest.
 */
export async function skipIfNoHardware(): Promise<boolean> {
  if (!shouldRunHardwareTests()) {
    return true; // Skip test
  }

  const commandAvailable = await isHackRFCommandAvailable();
  if (!commandAvailable) {
    return true; // Skip test
  }

  const deviceConnected = await isHackRFDeviceConnected();
  return !deviceConnected; // Skip if not connected
}
