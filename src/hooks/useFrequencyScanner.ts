import { useState, useCallback, useRef, useEffect } from "react";
import { HackRFOne } from "../models/HackRFOne";

export type ScanConfig = {
  startFrequency: number; // Hz
  endFrequency: number; // Hz
  stepSize: number; // Hz
  dwellTime: number; // milliseconds
  signalThreshold: number; // dBm
};

export type ActiveSignal = {
  frequency: number; // Hz
  signalStrength: number; // dBm
  timestamp: number; // Unix timestamp
};

export type ScanStatus = "idle" | "scanning" | "paused" | "completed";

export type FrequencyScannerState = {
  status: ScanStatus;
  currentFrequency: number;
  progress: number; // 0-100
  activeSignals: ActiveSignal[];
  config: ScanConfig;
};

type UseFrequencyScannerReturn = {
  state: FrequencyScannerState;
  startScan: (config: ScanConfig) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  stopScan: () => void;
  clearSignals: () => void;
  updateConfig: (config: Partial<ScanConfig>) => void;
};

export function useFrequencyScanner(
  device: HackRFOne | null,
  onFrequencyChange?: (frequency: number) => Promise<void>,
): UseFrequencyScannerReturn {
  const [state, setState] = useState<FrequencyScannerState>({
    status: "idle",
    currentFrequency: 0,
    progress: 0,
    activeSignals: [],
    config: {
      startFrequency: 88.1e6,
      endFrequency: 107.9e6,
      stepSize: 0.2e6, // 200 kHz
      dwellTime: 100, // ms
      signalThreshold: -60, // dBm
    },
  });

  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startScan = useCallback(
    (config: ScanConfig) => {
      if (!device) {
        console.error("Device not available for scanning");
        return;
      }

      setState((prev) => ({
        ...prev,
        status: "scanning",
        currentFrequency: config.startFrequency,
        progress: 0,
        activeSignals: [],
        config,
      }));

      let currentFreq = config.startFrequency;
      const totalSteps = Math.ceil(
        (config.endFrequency - config.startFrequency) / config.stepSize,
      );
      let step = 0;

      scanIntervalRef.current = setInterval(async () => {
        if (currentFreq > config.endFrequency) {
          // Scan completed
          setState((prev) => ({
            ...prev,
            status: "completed",
            progress: 100,
          }));
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
          }
          return;
        }

        // Set frequency
        try {
          await device.setFrequency(currentFreq);
          if (onFrequencyChange) {
            await onFrequencyChange(currentFreq);
          }

          // Wait for dwell time
          await new Promise((resolve) => setTimeout(resolve, config.dwellTime));

          // For now, we'll detect signals based on a simulated threshold
          // In a real implementation, this would analyze actual IQ samples
          const signalStrength = -100 + Math.random() * 80; // Simulated signal strength

          // Check if signal exceeds threshold
          if (signalStrength > config.signalThreshold) {
            setState((prev) => ({
              ...prev,
              currentFrequency: currentFreq,
              progress: Math.round((step / totalSteps) * 100),
              activeSignals: [
                ...prev.activeSignals,
                {
                  frequency: currentFreq,
                  signalStrength,
                  timestamp: Date.now(),
                },
              ],
            }));
          } else {
            setState((prev) => ({
              ...prev,
              currentFrequency: currentFreq,
              progress: Math.round((step / totalSteps) * 100),
            }));
          }
        } catch (error) {
          console.error("Error during frequency scan:", error);
        }

        currentFreq += config.stepSize;
        step++;
      }, config.dwellTime + 50); // Add small buffer for processing
    },
    [device, onFrequencyChange],
  );

  const pauseScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "paused" }));
  }, []);

  const resumeScan = useCallback((): void => {
    if (state.status !== "paused") {
      return;
    }

    setState((prev) => ({ ...prev, status: "scanning" }));

    let currentFreq = state.currentFrequency + state.config.stepSize;
    const totalSteps = Math.ceil(
      (state.config.endFrequency - state.config.startFrequency) /
        state.config.stepSize,
    );
    let step = Math.floor(
      (currentFreq - state.config.startFrequency) / state.config.stepSize,
    );

    scanIntervalRef.current = setInterval(async () => {
      if (currentFreq > state.config.endFrequency) {
        setState((prev) => ({ ...prev, status: "completed", progress: 100 }));
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        return;
      }

      try {
        if (device) {
          await device.setFrequency(currentFreq);
          if (onFrequencyChange) {
            await onFrequencyChange(currentFreq);
          }

          await new Promise((resolve) =>
            setTimeout(resolve, state.config.dwellTime),
          );

          // Simulated signal strength
          const signalStrength = -100 + Math.random() * 80;

          if (signalStrength > state.config.signalThreshold) {
            setState((prev) => ({
              ...prev,
              currentFrequency: currentFreq,
              progress: Math.round((step / totalSteps) * 100),
              activeSignals: [
                ...prev.activeSignals,
                {
                  frequency: currentFreq,
                  signalStrength,
                  timestamp: Date.now(),
                },
              ],
            }));
          } else {
            setState((prev) => ({
              ...prev,
              currentFrequency: currentFreq,
              progress: Math.round((step / totalSteps) * 100),
            }));
          }
        }
      } catch (error) {
        console.error("Error during frequency scan:", error);
      }

      currentFreq += state.config.stepSize;
      step++;
    }, state.config.dwellTime + 50);
  }, [device, state, onFrequencyChange]);

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "idle", progress: 0 }));
  }, []);

  const clearSignals = useCallback(() => {
    setState((prev) => ({ ...prev, activeSignals: [] }));
  }, []);

  const updateConfig = useCallback((config: Partial<ScanConfig>) => {
    setState((prev) => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  return {
    state,
    startScan,
    pauseScan,
    resumeScan,
    stopScan,
    clearSignals,
    updateConfig,
  };
}
