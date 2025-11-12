/**
 * Frequency Synchronization Hook
 *
 * Automatically synchronizes frequency changes from the store to the connected SDR device.
 * This ensures that when users change the frequency via the VFO controls, the hardware is retuned.
 *
 * Usage: Call once at the app level (e.g., in App.tsx) to enable global frequency sync.
 */

import { useEffect, useRef } from "react";
import { useDevice, useFrequency } from "../store";

export function useFrequencySync(): void {
  const { frequencyHz } = useFrequency();
  const { primaryDevice: device } = useDevice();

  // Track the last frequency we sent to the device to avoid redundant retunes
  const lastSentFrequencyRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip if no device connected
    if (!device?.isOpen()) {
      return;
    }

    // Skip if frequency hasn't changed
    if (lastSentFrequencyRef.current === frequencyHz) {
      return;
    }

    // Retune the device
    const retune = async (): Promise<void> => {
      try {
        await device.setFrequency(frequencyHz);
        lastSentFrequencyRef.current = frequencyHz;
        console.debug("🔌 FREQ SYNC: Device retuned", {
          frequencyHz,
          frequencyMHz: (frequencyHz / 1e6).toFixed(3),
        });
      } catch (err) {
        console.error("🔌 FREQ SYNC: Failed to retune device", err, {
          frequencyHz,
        });
        // Reset last sent frequency on error so we can retry on next change
        lastSentFrequencyRef.current = null;
      }
    };

    void retune();
  }, [frequencyHz, device]);
}
