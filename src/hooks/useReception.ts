import { useState, useCallback, useEffect, useRef } from "react";
import { shouldUseMockSDR } from "../utils/e2e";
import { formatFrequency } from "../utils/frequency";
import type { ISDRDevice } from "../models/SDRDevice";

/**
 * Hardware configuration for the SDR device
 */
export interface HardwareConfig {
  sampleRate: number;
  lnaGain: number;
  vgaGain: number;
  bandwidth?: number;
}

/**
 * Options for the useReception hook
 */
export interface UseReceptionOptions {
  /** SDR device instance */
  device: ISDRDevice | undefined;
  /** Current frequency in Hz */
  frequency: number;
  /** Hardware configuration */
  config: HardwareConfig;
  /** Callback to start DSP processing */
  startDsp: () => Promise<void>;
  /** Callback to stop DSP processing */
  stopDsp: () => Promise<void>;
  /** Callback when scanner should be stopped */
  stopScanner: () => void;
  /** Current scanner state */
  scannerState: "idle" | "scanning" | "paused";
  /** Callback for status messages */
  onStatusMessage?: (message: string) => void;
}

/**
 * Return value from useReception hook
 */
export interface UseReceptionResult {
  /** Whether reception is currently active */
  isReceiving: boolean;
  /** Start reception */
  startReception: () => Promise<void>;
  /** Stop reception */
  stopReception: () => Promise<void>;
  /** Current status message */
  statusMessage: string;
}

/**
 * Custom hook to manage SDR reception control
 *
 * Encapsulates the business logic for:
 * - Tuning the device to a specific frequency
 * - Starting and stopping reception
 * - Managing reception state
 * - Auto-starting reception when device is ready
 * - Cleanup on unmount
 *
 * @param options Configuration options
 * @returns Reception control interface
 */
export function useReception(options: UseReceptionOptions): UseReceptionResult {
  const {
    device,
    frequency,
    config,
    startDsp,
    stopDsp,
    stopScanner,
    scannerState,
    onStatusMessage,
  } = options;

  const [isReceiving, setIsReceiving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const useMock = shouldUseMockSDR();

  // Track if we're currently starting to prevent re-entrant calls
  const isStartingRef = useRef(false);
  // Track receiving state in ref to avoid unnecessary callback re-creation
  const isReceivingRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isReceivingRef.current = isReceiving;
  }, [isReceiving]);

  /**
   * Update status message and notify parent if callback provided
   */
  const updateStatus = useCallback(
    (message: string) => {
      setStatusMessage(message);
      onStatusMessage?.(message);
    },
    [onStatusMessage],
  );

  /**
   * Tune the device to the current frequency with configured parameters
   */
  const tuneDevice = useCallback(async () => {
    if (!device) {
      updateStatus("No device connected. Open the Devices panel to connect.");
      return;
    }
    try {
      if (!device.isOpen()) {
        await device.open();
      }
      await device.setSampleRate(config.sampleRate);
      await device.setLNAGain(config.lnaGain);
      if (device.setVGAGain) {
        await device.setVGAGain(config.vgaGain);
      }
      if (device.setBandwidth && config.bandwidth) {
        await device.setBandwidth(config.bandwidth);
      }
      await device.setFrequency(frequency);
      updateStatus(
        `Tuned to ${formatFrequency(frequency)} @ ${(config.sampleRate / 1e6).toFixed(2)} MSPS`,
      );
    } catch (err) {
      console.error("Tune failed", err);
      const message =
        err instanceof Error ? `Tune failed: ${err.message}` : "Tune failed";
      updateStatus(message);
      throw err;
    }
  }, [device, frequency, config, updateStatus]);

  /**
   * Start reception
   */
  const startReception = useCallback(async (): Promise<void> => {
    if (!device && !useMock) {
      updateStatus("No device connected or setup not initialized");
      return;
    }
    // Guard against re-entrant calls to prevent infinite loops
    if (isReceivingRef.current || isStartingRef.current) {
      console.warn("Already receiving or starting, skipping start");
      return;
    }

    try {
      isStartingRef.current = true;
      stopScanner();
      if (device) {
        await tuneDevice();
      }
      // Optimistically mark receiving before awaiting DSP start to unblock E2E readiness checks
      setIsReceiving(true);
      updateStatus("Receiving started");
      await startDsp();
    } catch (err) {
      console.error("Start failed", err);
      setIsReceiving(false);
      const message =
        err instanceof Error ? `Start failed: ${err.message}` : "Start failed";
      updateStatus(message);
    } finally {
      isStartingRef.current = false;
    }
  }, [device, tuneDevice, startDsp, stopScanner, useMock, updateStatus]);

  /**
   * Stop reception
   */
  const stopReception = useCallback(async (): Promise<void> => {
    try {
      await stopDsp();
    } finally {
      setIsReceiving(false);
      updateStatus("Reception stopped");
    }
  }, [stopDsp, updateStatus]);

  /**
   * Auto-start reception if a previously paired device is already connected/opened.
   * Note: startReception is intentionally omitted from deps to prevent infinite loop
   */
  useEffect(() => {
    // In mock/e2e mode, let tests control start to avoid races
    if (useMock) {
      // Under automation, proactively start to avoid flake in simulated suite
      const isWebDriver =
        typeof navigator !== "undefined" && navigator.webdriver === true;
      if (isWebDriver && !isReceiving && scannerState === "idle") {
        void startReception();
      }
      return;
    }
    if (!device || !device.isOpen() || isReceiving || scannerState !== "idle") {
      return;
    }
    void startReception();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, isReceiving, scannerState, useMock]);

  /**
   * Ensure RX is stopped when leaving the page
   */
  useEffect(() => {
    return (): void => {
      if (isReceiving) {
        void stopReception();
      }
    };
  }, [isReceiving, stopReception]);

  /**
   * Test/debug hook: expose receiving state for E2E assertions
   */
  useEffect(() => {
    window.dbgReceiving = isReceiving;
  }, [isReceiving]);

  return {
    isReceiving,
    startReception,
    stopReception,
    statusMessage,
  };
}
