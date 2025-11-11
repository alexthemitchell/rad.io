/**
 * ATSC Scanner Hook
 *
 * Business logic for scanning ATSC channels with pilot tone detection
 * and signal quality measurement.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { type ISDRDevice, type IQSample } from "../models/SDRDevice";
import { ATSC8VSBDemodulator } from "../plugins/demodulators/ATSC8VSBDemodulator";
import {
  ATSC_CHANNELS,
  ATSC_CONSTANTS,
  type ATSCChannel,
} from "../utils/atscChannels";
import {
  saveATSCChannel,
  getAllATSCChannels,
  clearAllATSCChannels,
  type StoredATSCChannel,
} from "../utils/atscChannelStorage";
import {
  calculateFFTSync,
  estimateNoiseFloor,
  detectSpectralPeaks,
} from "../utils/dsp";

/**
 * ATSC scanner configuration
 */
export interface ATSCScanConfig {
  /** Scan VHF-Low band (channels 2-6) */
  scanVHFLow: boolean;
  /** Scan VHF-High band (channels 7-13) */
  scanVHFHigh: boolean;
  /** Scan UHF band (channels 14-36) */
  scanUHF: boolean;
  /** Detection threshold in dB above noise floor */
  thresholdDb: number;
  /** Dwell time per channel in ms */
  dwellTime: number;
  /** FFT size for spectral analysis */
  fftSize: number;
  /** Require pilot tone detection for valid channel */
  requirePilot: boolean;
  /** Require sync lock for valid channel */
  requireSync: boolean;
}

/**
 * Scanner state
 */
export type ATSCScannerState = "idle" | "scanning" | "paused";

/**
 * Scan result for a single channel
 */
export interface ATSCChannelScanResult {
  /** Channel information */
  channel: ATSCChannel;
  /** Signal strength (0-1 scale) */
  strength: number;
  /** Signal-to-Noise Ratio in dB */
  snr: number;
  /** Modulation Error Ratio in dB (if available) */
  mer?: number;
  /** Whether pilot tone was detected */
  pilotDetected: boolean;
  /** Whether sync was achieved */
  syncLocked: boolean;
  /** Number of segment syncs detected */
  segmentSyncCount: number;
  /** Number of field syncs detected */
  fieldSyncCount: number;
}

/**
 * Hook for ATSC channel scanning
 */
export function useATSCScanner(device: ISDRDevice | undefined): {
  state: ATSCScannerState;
  config: ATSCScanConfig;
  currentChannel: ATSCChannel | null;
  progress: number;
  foundChannels: StoredATSCChannel[];
  startScan: () => Promise<void>;
  pauseScan: () => void;
  resumeScan: () => void;
  stopScan: () => void;
  updateConfig: (updates: Partial<ATSCScanConfig>) => void;
  clearChannels: () => Promise<void>;
  loadStoredChannels: () => Promise<void>;
  exportChannels: () => Promise<string>;
  importChannels: (json: string) => Promise<void>;
} {
  const [state, setState] = useState<ATSCScannerState>("idle");
  const [config, setConfig] = useState<ATSCScanConfig>({
    scanVHFLow: true,
    scanVHFHigh: true,
    scanUHF: true,
    thresholdDb: 15, // Higher threshold for ATSC (need strong signal)
    dwellTime: 500, // Longer dwell for sync detection
    fftSize: 4096, // Higher resolution for pilot detection
    requirePilot: true,
    requireSync: false, // Pilot detection is usually enough
  });
  const [currentChannel, setCurrentChannel] = useState<ATSCChannel | null>(
    null,
  );
  const [progress, setProgress] = useState(0);
  const [foundChannels, setFoundChannels] = useState<StoredATSCChannel[]>([]);

  const isScanningRef = useRef<boolean>(false);
  const demodulatorRef = useRef<ATSC8VSBDemodulator | null>(null);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const dwellResolveRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Settle any pending receive operation
   */
  const settleReceivePromise = useCallback(async (): Promise<void> => {
    if (receivePromiseRef.current) {
      try {
        await receivePromiseRef.current;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const msg = error.message;
          if (
            error.name !== "AbortError" &&
            !msg.includes("Device is closing or closed")
          ) {
            console.error("ATSC Scanner: receive loop error", error);
          }
        }
      } finally {
        receivePromiseRef.current = null;
      }
    }
  }, []);

  /**
   * Clear pending timers
   */
  const clearPendingTimers = useCallback((): void => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  /**
   * Detect ATSC pilot tone at expected offset
   */
  const detectPilotTone = useCallback(
    (
      powerSpectrum: Float32Array,
      sampleRate: number,
      centerFrequency: number,
      channel: ATSCChannel,
    ): { detected: boolean; power: number } => {
      // Calculate bin index for pilot frequency
      const pilotOffset = channel.pilotFrequency - centerFrequency;
      const pilotBin = Math.round(
        (pilotOffset / sampleRate) * powerSpectrum.length +
          powerSpectrum.length / 2,
      );

      if (pilotBin < 0 || pilotBin >= powerSpectrum.length) {
        return { detected: false, power: -Infinity };
      }

      // Check for strong peak at pilot frequency
      const pilotPower = powerSpectrum[pilotBin] ?? -Infinity;
      const noiseFloor = estimateNoiseFloor(powerSpectrum);

      // Pilot should be 10+ dB above noise
      const detected = pilotPower - noiseFloor > 10;

      return { detected, power: pilotPower };
    },
    [],
  );

  /**
   * Calculate Modulation Error Ratio (MER)
   */
  const calculateMER = useCallback((symbols: Float32Array): number => {
    if (symbols.length === 0) return 0;

    // MER = 10 * log10(mean(ideal^2) / mean(error^2))
    // For 8-VSB, ideal symbols are at levels -7, -5, -3, -1, 1, 3, 5, 7
    const idealLevels = [-7, -5, -3, -1, 1, 3, 5, 7];

    let errorPowerSum = 0;
    let idealPowerSum = 0;

    for (const symbol of symbols) {
      // Find closest ideal level
      let closestLevel = idealLevels[0] ?? 0;
      let minDist = Infinity;
      for (const level of idealLevels) {
        const dist = Math.abs(symbol - level);
        if (dist < minDist) {
          minDist = dist;
          closestLevel = level;
        }
      }

      const error = symbol - closestLevel;
      errorPowerSum += error * error;
      idealPowerSum += closestLevel * closestLevel;
    }

    const errorPower = errorPowerSum / symbols.length;
    const idealPower = idealPowerSum / symbols.length;

    if (errorPower === 0) return Infinity;

    return 10 * Math.log10(idealPower / errorPower);
  }, []);

  /**
   * Scan a single ATSC channel
   */
  const scanChannel = useCallback(
    async (channel: ATSCChannel): Promise<ATSCChannelScanResult | null> => {
      if (!device?.isOpen() || !isScanningRef.current) {
        return null;
      }

      try {
        // Stop any previous streaming
        await settleReceivePromise();
        if (device.isReceiving()) {
          await device.stopRx();
          await settleReceivePromise();
        }

        // Initialize demodulator if needed
        if (!demodulatorRef.current) {
          demodulatorRef.current = new ATSC8VSBDemodulator();
          await demodulatorRef.current.initialize();
          await demodulatorRef.current.activate();
        }

        // Tune to channel center frequency
        await device.setFrequency(channel.frequency);
        setCurrentChannel(channel);

        // Set sample rate to match ATSC symbol rate
        const sampleRate = ATSC_CONSTANTS.SYMBOL_RATE;
        await device.setSampleRate(sampleRate);

        // Collect IQ samples
        const iqSamples: IQSample[] = [];

        receivePromiseRef.current = device.receive((data: DataView) => {
          if (!isScanningRef.current) return;
          const samples = device.parseSamples(data);
          iqSamples.push(...samples);

          if (iqSamples.length >= config.fftSize && dwellResolveRef.current) {
            dwellResolveRef.current();
          }
        });

        // Wait for dwell time to collect samples
        await new Promise<void>((resolve) => {
          let resolved = false;
          const finalize = (): void => {
            if (resolved) return;
            resolved = true;
            dwellResolveRef.current = null;
            clearPendingTimers();
            resolve();
          };

          dwellResolveRef.current = finalize;
          scanTimeoutRef.current = setTimeout(finalize, config.dwellTime);

          if (iqSamples.length >= config.fftSize) {
            finalize();
          }
        });

        clearPendingTimers();

        // Stop streaming
        if (device.isReceiving()) {
          await device.stopRx();
        }
        await settleReceivePromise();

        if (!isScanningRef.current || iqSamples.length < config.fftSize) {
          return null;
        }

        // Perform FFT analysis
        const powerSpectrum = calculateFFTSync(
          iqSamples.slice(0, config.fftSize),
          config.fftSize,
        );

        const noiseFloor = estimateNoiseFloor(powerSpectrum);
        const threshold = noiseFloor + config.thresholdDb;

        // Detect peaks
        const peaks = detectSpectralPeaks(
          powerSpectrum,
          sampleRate,
          channel.frequency,
          threshold,
          ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 4, // Min spacing
        );

        if (peaks.length === 0) {
          return null; // No signal detected
        }

        // Find strongest peak
        const strongestPeak = peaks.reduce((max, p) =>
          p.powerDb > max.powerDb ? p : max,
        );

        // Detect pilot tone
        const pilotResult = detectPilotTone(
          powerSpectrum,
          sampleRate,
          channel.frequency,
          channel,
        );

        if (config.requirePilot && !pilotResult.detected) {
          return null; // Pilot required but not detected
        }

        // Demodulate samples to check for sync
        const symbols = demodulatorRef.current.demodulate(iqSamples);
        const syncLocked = demodulatorRef.current.isSyncLocked();
        const segmentSyncCount = demodulatorRef.current.getSegmentSyncCount();
        const fieldSyncCount = demodulatorRef.current.getFieldSyncCount();

        if (config.requireSync && !syncLocked) {
          return null; // Sync required but not achieved
        }

        // Calculate MER if we have symbols
        const mer = symbols.length > 0 ? calculateMER(symbols) : undefined;

        // Calculate signal strength (0-1 scale)
        const snr = strongestPeak.powerDb - noiseFloor;
        const strength = Math.max(0, Math.min(1, snr / 60)); // Normalize to 60 dB range

        return {
          channel,
          strength,
          snr,
          mer,
          pilotDetected: pilotResult.detected,
          syncLocked,
          segmentSyncCount,
          fieldSyncCount,
        };
      } catch (error) {
        console.error(`Error scanning channel ${channel.channel}:`, error);
        return null;
      }
    },
    [
      device,
      config,
      settleReceivePromise,
      clearPendingTimers,
      detectPilotTone,
      calculateMER,
    ],
  );

  /**
   * Perform full scan
   */
  const performScan = useCallback(async (): Promise<void> => {
    if (!device?.isOpen() || !isScanningRef.current) {
      return;
    }

    try {
      // Build list of channels to scan
      const channelsToScan: ATSCChannel[] = [];
      if (config.scanVHFLow) {
        channelsToScan.push(...ATSC_CHANNELS.filter((ch) => ch.band === "VHF-Low"));
      }
      if (config.scanVHFHigh) {
        channelsToScan.push(...ATSC_CHANNELS.filter((ch) => ch.band === "VHF-High"));
      }
      if (config.scanUHF) {
        channelsToScan.push(...ATSC_CHANNELS.filter((ch) => ch.band === "UHF"));
      }

      const totalChannels = channelsToScan.length;
      let scannedCount = 0;

      // Scan each channel
      for (const channel of channelsToScan) {
        if (!isScanningRef.current) break;

        const result = await scanChannel(channel);

        if (result) {
          // Save to database and state
          const storedChannel: StoredATSCChannel = {
            ...result,
            discoveredAt: new Date(),
            lastScanned: new Date(),
            scanCount: 1,
          };

          await saveATSCChannel(storedChannel);
          setFoundChannels((prev) => {
            const existing = prev.find(
              (ch) => ch.channel.channel === channel.channel,
            );
            if (existing) {
              return prev.map((ch) =>
                ch.channel.channel === channel.channel ? storedChannel : ch,
              );
            }
            return [...prev, storedChannel];
          });
        }

        scannedCount++;
        setProgress((scannedCount / totalChannels) * 100);
      }

      // Scan complete
      if (isScanningRef.current) {
        setState("idle");
        isScanningRef.current = false;
        setCurrentChannel(null);
        setProgress(100);
      }
    } catch (error) {
      console.error("Error during ATSC scan:", error);
      setState("idle");
      isScanningRef.current = false;
      setCurrentChannel(null);
      setProgress(0);
    }
  }, [device, config, scanChannel]);

  /**
   * Start scanning
   */
  const startScan = useCallback(async (): Promise<void> => {
    if (!device) {
      console.error("ATSC Scanner: Device not available");
      return;
    }

    if (!device.isOpen()) {
      try {
        await device.open();
      } catch (error) {
        console.error("ATSC Scanner: Failed to open device", error);
        return;
      }
    }

    if (state === "scanning") return;

    setState("scanning");
    isScanningRef.current = true;
    setProgress(0);
    setFoundChannels([]);
    await clearAllATSCChannels();

    void performScan().catch((err) => {
      console.error("Error during performScan():", err);
      setState("idle");
      isScanningRef.current = false;
      setCurrentChannel(null);
      setProgress(0);
    });
  }, [device, state, performScan]);

  /**
   * Pause scanning
   */
  const pauseScan = useCallback((): void => {
    if (state === "scanning") {
      setState("paused");
      isScanningRef.current = false;
      clearPendingTimers();
      if (dwellResolveRef.current) {
        dwellResolveRef.current();
      }
      void settleReceivePromise();
    }
  }, [state, clearPendingTimers, settleReceivePromise]);

  /**
   * Resume scanning
   */
  const resumeScan = useCallback((): void => {
    if (state === "paused") {
      setState("scanning");
      isScanningRef.current = true;
      void performScan().catch((err) => {
        console.error("Error during performScan() on resume:", err);
        setState("idle");
        isScanningRef.current = false;
        setCurrentChannel(null);
        setProgress(0);
      });
    }
  }, [state, performScan]);

  /**
   * Stop scanning
   */
  const stopScan = useCallback((): void => {
    setState("idle");
    isScanningRef.current = false;
    setCurrentChannel(null);
    setProgress(0);
    clearPendingTimers();
    if (dwellResolveRef.current) {
      dwellResolveRef.current();
    }
    void settleReceivePromise();
  }, [clearPendingTimers, settleReceivePromise]);

  /**
   * Update configuration
   */
  const updateConfig = useCallback(
    (updates: Partial<ATSCScanConfig>): void => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  /**
   * Clear all stored channels
   */
  const clearChannels = useCallback(async (): Promise<void> => {
    await clearAllATSCChannels();
    setFoundChannels([]);
  }, []);

  /**
   * Load stored channels from database
   */
  const loadStoredChannels = useCallback(async (): Promise<void> => {
    const channels = await getAllATSCChannels();
    setFoundChannels(channels);
  }, []);

  /**
   * Export channels to JSON
   */
  const exportChannels = useCallback(async (): Promise<string> => {
    return JSON.stringify(foundChannels, null, 2);
  }, [foundChannels]);

  /**
   * Import channels from JSON
   */
  const importChannels = useCallback(async (json: string): Promise<void> => {
    const channels = JSON.parse(json) as StoredATSCChannel[];
    for (const channel of channels) {
      await saveATSCChannel({
        ...channel,
        discoveredAt:
          channel.discoveredAt instanceof Date
            ? channel.discoveredAt
            : new Date(channel.discoveredAt),
        lastScanned:
          channel.lastScanned instanceof Date
            ? channel.lastScanned
            : new Date(channel.lastScanned),
      });
    }
    await loadStoredChannels();
  }, [loadStoredChannels]);

  // Load stored channels on mount
  useEffect(() => {
    void loadStoredChannels();
  }, [loadStoredChannels]);

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      clearPendingTimers();
      if (dwellResolveRef.current) {
        dwellResolveRef.current();
      }
      void settleReceivePromise();
      if (demodulatorRef.current) {
        void demodulatorRef.current.deactivate();
        void demodulatorRef.current.dispose();
      }
    };
  }, [clearPendingTimers, settleReceivePromise]);

  return useMemo(
    () => ({
      state,
      config,
      currentChannel,
      progress,
      foundChannels,
      startScan,
      pauseScan,
      resumeScan,
      stopScan,
      updateConfig,
      clearChannels,
      loadStoredChannels,
      exportChannels,
      importChannels,
    }),
    [
      state,
      config,
      currentChannel,
      progress,
      foundChannels,
      startScan,
      pauseScan,
      resumeScan,
      stopScan,
      updateConfig,
      clearChannels,
      loadStoredChannels,
      exportChannels,
      importChannels,
    ],
  );
}
