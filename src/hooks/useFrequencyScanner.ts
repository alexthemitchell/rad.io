import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { ISDRDevice, IQSample } from "../models/SDRDevice";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
import { AudioStreamProcessor, DemodulationType } from "../utils/audioStream";
import {
  calculateFFTSync,
  detectSpectralPeaks,
  estimateNoiseFloor,
} from "../utils/dsp";

/**
 * Configuration for frequency scanning
 */
export interface FrequencyScanConfig {
  /** Start frequency in Hz */
  startFrequency: number;
  /** End frequency in Hz */
  endFrequency: number;
  /** Signal threshold in dB above noise floor for detection */
  thresholdDb: number;
  /** Dwell time per frequency chunk in ms */
  dwellTime: number;
  /** FFT size for spectral analysis (larger = better frequency resolution) */
  fftSize: number;
  /** Minimum spacing between detected peaks in Hz (prevents duplicates) */
  minPeakSpacing: number;
  /** Enable RDS decoding for FM scans (default: false) */
  enableRDS?: boolean;
}

/**
 * Information about a detected active signal
 */
export interface ActiveSignal {
  /** Frequency in Hz */
  frequency: number;
  /** Signal strength (0-1 scale) */
  strength: number;
  /** Timestamp when detected */
  timestamp: Date;
  /** Optional label */
  label?: string;
  /** RDS station data (FM signals only) */
  rdsData?: RDSStationData;
  /** RDS decoder statistics (FM signals only) */
  rdsStats?: RDSDecoderStats;
}

/**
 * Scanner state
 */
export type ScannerState = "idle" | "scanning" | "paused";

/**
 * Hook for managing frequency scanning
 */
export function useFrequencyScanner(
  device: ISDRDevice | undefined,
  onSignalDetected?: (signal: ActiveSignal) => void,
): {
  state: ScannerState;
  config: FrequencyScanConfig;
  currentFrequency: number | null;
  activeSignals: ActiveSignal[];
  progress: number;
  startScan: () => Promise<void>;
  pauseScan: () => void;
  resumeScan: () => void;
  stopScan: () => void;
  updateConfig: (updates: Partial<FrequencyScanConfig>) => void;
  clearSignals: () => void;
  updateSamples: (amplitudes: number[], iqSamples?: IQSample[]) => void;
} {
  const [state, setState] = useState<ScannerState>("idle");
  const [config, setConfig] = useState<FrequencyScanConfig>({
    startFrequency: 88e6, // 88 MHz (FM radio start)
    endFrequency: 108e6, // 108 MHz (FM radio end)
    thresholdDb: 10, // 10 dB above noise floor
    dwellTime: 100, // 100ms per frequency chunk
    fftSize: 2048, // 2048-point FFT for good resolution
    minPeakSpacing: 100e3, // 100 kHz minimum between peaks (FM station spacing)
    enableRDS: true, // Enable RDS decoding by default for FM scans
  });
  const [currentFrequency, setCurrentFrequency] = useState<number | null>(null);
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  const [progress, setProgress] = useState(0);

  // Track an in-flight dwell/settle timeout and its resolver so we can abort instantly
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dwellResolveRef = useRef<(() => void) | null>(null);
  const samplesRef = useRef<number[]>([]);
  const iqSamplesRef = useRef<IQSample[]>([]);
  const isScanningRef = useRef(false);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const audioProcessorRef = useRef<AudioStreamProcessor | null>(null);

  const clearPendingTimers = useCallback((): void => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (sampleCheckTimeoutRef.current) {
      clearTimeout(sampleCheckTimeoutRef.current);
      sampleCheckTimeoutRef.current = null;
    }
  }, []);

  const settleReceivePromise = useCallback(async (): Promise<void> => {
    if (receivePromiseRef.current) {
      try {
        await receivePromiseRef.current;
      } catch (error) {
        if (error instanceof Error) {
          const msg = error.message ?? "";
          if (
            error.name !== "AbortError" &&
            !msg.includes("Device is closing or closed")
          ) {
            console.error("Scanner: receive loop error", error);
          }
        } else {
          console.error("Scanner: receive loop error", error);
        }
      } finally {
        receivePromiseRef.current = null;
      }
    }
  }, []);

  /**
   * Scan a single frequency chunk using FFT-based wideband analysis
   * This captures the full bandwidth and detects all signals simultaneously
   */
  const scanFrequencyChunk = useCallback(
    async (centerFrequency: number, sampleRate: number): Promise<void> => {
      if (!device || !device.isOpen()) {
        return;
      }

      try {
        // Stop any previous streaming and ensure the receive loop settled
        await settleReceivePromise();
        if (device.isReceiving()) {
          await device.stopRx();
          await settleReceivePromise();
        }

        // Tune to center frequency
        await device.setFrequency(centerFrequency);
        setCurrentFrequency(centerFrequency);

        // Clear previous samples
        iqSamplesRef.current = [];

        // Start receiving samples (non-blocking - starts streaming in background)
        receivePromiseRef.current = device.receive((data: DataView) => {
          // Only process if still scanning
          if (!isScanningRef.current) {
            return;
          }

          // Parse and store IQ samples
          const samples = device.parseSamples(data);
          // More efficient: concat instead of push with spread to avoid call stack issues
          iqSamplesRef.current = iqSamplesRef.current.concat(samples);

          if (
            iqSamplesRef.current.length >= config.fftSize &&
            dwellResolveRef.current
          ) {
            dwellResolveRef.current();
          }
        });

        // Wait for dwell time to collect samples (abortable)
        await new Promise<void>((resolve) => {
          let resolved = false;
          const finalize = (): void => {
            if (resolved) {
              return;
            }
            resolved = true;
            dwellResolveRef.current = null;
            clearPendingTimers();
            resolve();
          };

          const monitorSamples = (): void => {
            sampleCheckTimeoutRef.current = null;
            if (!isScanningRef.current) {
              finalize();
              return;
            }
            if (iqSamplesRef.current.length >= config.fftSize) {
              finalize();
              return;
            }
            sampleCheckTimeoutRef.current = setTimeout(monitorSamples, 10);
          };

          dwellResolveRef.current = finalize;
          scanTimeoutRef.current = setTimeout(finalize, config.dwellTime);
          sampleCheckTimeoutRef.current = setTimeout(monitorSamples, 10);

          if (iqSamplesRef.current.length >= config.fftSize) {
            finalize();
          }
        });

        // Ensure timers are cleared if the promise resolved via external signal
        clearPendingTimers();

        // Stop streaming
        if (device.isReceiving()) {
          await device.stopRx();
        }
        await settleReceivePromise();

        // If scanning stopped during dwell, exit
        if (!isScanningRef.current) {
          return;
        }

        // Need sufficient samples for FFT analysis
        if (iqSamplesRef.current.length < config.fftSize) {
          console.warn(
            `Insufficient samples for FFT: got ${iqSamplesRef.current.length}, need ${config.fftSize}`,
          );
          return;
        }

        // Perform FFT analysis on collected samples
        const powerSpectrum = calculateFFTSync(
          iqSamplesRef.current.slice(0, config.fftSize),
          config.fftSize,
        );

        // Estimate noise floor
        const noiseFloor = estimateNoiseFloor(powerSpectrum);
        const threshold = noiseFloor + config.thresholdDb;

        // Detect peaks above threshold
        const peaks = detectSpectralPeaks(
          powerSpectrum,
          sampleRate,
          centerFrequency,
          threshold,
          config.minPeakSpacing,
        );

        let maxPower = -Infinity;
        let minPower = Infinity;
        for (let i = 0; i < powerSpectrum.length; i++) {
          const value = powerSpectrum[i]!;
          if (value > maxPower) {
            maxPower = value;
          }
          if (value < minPower) {
            minPower = value;
          }
        }

        if (Number.isFinite(maxPower) && Number.isFinite(minPower)) {
          const peakFrequencies = peaks.map((peak) =>
            Number((peak.frequency / 1e6).toFixed(3)),
          );
          console.debug("Scanner chunk stats", {
            centerFrequencyMHz: Number((centerFrequency / 1e6).toFixed(3)),
            sampleCount: iqSamplesRef.current.length,
            noiseFloorDb: Number(noiseFloor.toFixed(2)),
            thresholdDb: Number(threshold.toFixed(2)),
            maxPowerDb: Number(maxPower.toFixed(2)),
            minPowerDb: Number(minPower.toFixed(2)),
            peaksDetected: peaks.length,
            peakFrequenciesMHz: peakFrequencies,
          });
        }

        // Process each detected peak
        for (const peak of peaks) {
          // Convert power dB to 0-1 strength scale (relative to dynamic range)
          // Assume typical dynamic range of 60 dB
          const dynamicRangeDb = 60;
          const strengthNormalized = Math.max(
            0,
            Math.min(1, (peak.powerDb - noiseFloor) / dynamicRangeDb),
          );

          const signal: ActiveSignal = {
            frequency: peak.frequency,
            strength: strengthNormalized,
            timestamp: new Date(),
          };

          // For FM frequencies, optionally decode RDS
          const isFM = peak.frequency >= 88e6 && peak.frequency <= 108e6;
          if (isFM && config.enableRDS && iqSamplesRef.current.length > 0) {
            try {
              // Initialize audio processor if not already created
              if (!audioProcessorRef.current) {
                audioProcessorRef.current = new AudioStreamProcessor(
                  sampleRate,
                );
              }

              // Process a batch of IQ samples for RDS extraction
              const sampleBatch = iqSamplesRef.current.slice(0, 50000);
              const result = await audioProcessorRef.current.extractAudio(
                sampleBatch,
                DemodulationType.FM,
                {
                  sampleRate: 48000,
                  enableRDS: true,
                },
              );

              // Attach RDS data if available
              if (result.rdsData) {
                signal.rdsData = result.rdsData;
                signal.rdsStats = result.rdsStats;
              }
            } catch (error) {
              console.warn(
                `RDS extraction failed for ${peak.frequency}:`,
                error,
              );
            }
          }

          // Add or update signal in list
          setActiveSignals((prev) => {
            const exists = prev.find((s) => s.frequency === signal.frequency);
            if (exists) {
              return prev.map((s) =>
                s.frequency === signal.frequency ? signal : s,
              );
            }
            return [...prev, signal];
          });

          onSignalDetected?.(signal);
        }

        // Clear samples for next chunk
        iqSamplesRef.current = [];
      } catch (error) {
        console.error(
          `Error scanning frequency chunk ${centerFrequency}:`,
          error,
        );
        clearPendingTimers();
        if (device.isReceiving()) {
          await device.stopRx().catch(console.error);
        }
        await settleReceivePromise();
      }
    },
    [
      device,
      config,
      onSignalDetected,
      clearPendingTimers,
      settleReceivePromise,
    ],
  );

  /**
   * Perform full scan using FFT-based wideband analysis
   */
  const performScan = useCallback(async (): Promise<void> => {
    if (!device || !device.isOpen() || !isScanningRef.current) {
      return;
    }

    const { startFrequency, endFrequency } = config;
    if (endFrequency < startFrequency) {
      // Invalid configuration
      setState("idle");
      isScanningRef.current = false;
      setCurrentFrequency(null);
      setProgress(0);
      return;
    }

    try {
      // Get device sample rate and usable bandwidth
      // IMPORTANT: Ensure device is configured with a valid sample rate
      // If sample rate has never been set, set it to a browser-friendly value
      const preferredSampleRate = 2.048e6;
      const currentSampleRate = await device.getSampleRate();
      const previousSampleRate =
        currentSampleRate && currentSampleRate > 0 ? currentSampleRate : null;

      let sampleRateToUse = previousSampleRate ?? preferredSampleRate;

      const shouldForcePreferredRate =
        previousSampleRate === null ||
        Math.abs(previousSampleRate - preferredSampleRate) >
          preferredSampleRate * 0.01;

      if (shouldForcePreferredRate) {
        sampleRateToUse = preferredSampleRate;
        console.info(
          `Scanner: Using preferred sample rate ${(
            sampleRateToUse / 1e6
          ).toFixed(3)} MSPS`,
        );
      }

      if (previousSampleRate !== sampleRateToUse) {
        const previousLabel = previousSampleRate
          ? `${(previousSampleRate / 1e6).toFixed(3)} MSPS`
          : "unknown";
        console.info(
          `Scanner: Adjusting device sample rate from ${previousLabel} to ${(
            sampleRateToUse / 1e6
          ).toFixed(3)} MSPS`,
        );
      }

      await device.setSampleRate(sampleRateToUse);
      const sampleRate = sampleRateToUse;
      const usableBandwidth = await device.getUsableBandwidth();

      // Calculate center frequencies to cover the full range
      const scanRange = endFrequency - startFrequency;
      const stepSize = usableBandwidth * 0.9; // 90% overlap to avoid edge artifacts
      const totalSteps = Math.max(1, Math.ceil(scanRange / stepSize));

      let currentStep = 0;

      // Scan each frequency chunk
      for (
        let centerFreq = startFrequency + usableBandwidth / 2;
        centerFreq <= endFrequency - usableBandwidth / 2 &&
        isScanningRef.current;
        centerFreq += stepSize
      ) {
        await scanFrequencyChunk(centerFreq, sampleRate);
        currentStep++;
        const pct = Math.min(100, (currentStep / totalSteps) * 100);
        setProgress(pct);
      }

      // Scan complete
      if (isScanningRef.current) {
        setState("idle");
        isScanningRef.current = false;
        setCurrentFrequency(null);
        setProgress(0);
      }
    } catch (error) {
      console.error("Error during scan:", error);
      setState("idle");
      isScanningRef.current = false;
      setCurrentFrequency(null);
      setProgress(0);
    }
  }, [device, config, scanFrequencyChunk]);

  /**
   * Start scanning
   */
  const startScan = useCallback(async (): Promise<void> => {
    if (!device) {
      console.error("Scanner: Device not available");
      return;
    }

    if (!device.isOpen()) {
      try {
        await device.open();
        console.info("Scanner: Opened device before starting scan");
      } catch (error) {
        console.error("Scanner: Failed to open device for scanning", error);
        return;
      }
    }

    if (state === "scanning") {
      return;
    }

    setState("scanning");
    isScanningRef.current = true;
    setProgress(0);
    setActiveSignals([]);

    // Start the scan (fire-and-forget). We intentionally do not await here
    // to avoid blocking the UI thread and to keep startScan() resolving
    // immediately (tests rely on this). Handle rejection to avoid unhandled
    // promise rejections.
    void performScan().catch((err) => {
      console.error("Error during performScan():", err);
      // Fail-safe: reset scanning state if the scan pipeline unexpectedly rejects
      setState("idle");
      isScanningRef.current = false;
      setCurrentFrequency(null);
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
      // Abort any in-flight dwell
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
      // Resume scan without awaiting to avoid blocking; catch errors for safety
      void performScan().catch((err) => {
        console.error("Error during performScan() on resume:", err);
        setState("idle");
        isScanningRef.current = false;
        setCurrentFrequency(null);
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
    setCurrentFrequency(null);
    setProgress(0);
    clearPendingTimers();
    if (dwellResolveRef.current) {
      dwellResolveRef.current();
    }
    void settleReceivePromise();
  }, [clearPendingTimers, settleReceivePromise]);

  /**
   * Update scanner configuration
   */
  const updateConfig = useCallback(
    (updates: Partial<FrequencyScanConfig>): void => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  /**
   * Clear active signals list
   */
  const clearSignals = useCallback((): void => {
    setActiveSignals([]);
  }, []);

  /**
   * Update samples from IQ data
   * This should be called from the main visualizer when new samples arrive
   */
  const updateSamples = useCallback(
    (amplitudes: number[], iqSamples?: IQSample[]): void => {
      if (isScanningRef.current) {
        // More efficient: use concat instead of spread to reduce intermediate allocations
        samplesRef.current = samplesRef.current.concat(amplitudes);
        // Keep only recent samples to avoid memory issues
        if (samplesRef.current.length > 10000) {
          samplesRef.current = samplesRef.current.slice(-5000);
        }

        // Also store IQ samples if provided (for RDS decoding)
        if (iqSamples && config.enableRDS) {
          iqSamplesRef.current = iqSamplesRef.current.concat(iqSamples);
          // Keep only recent IQ samples to avoid memory issues
          if (iqSamplesRef.current.length > 50000) {
            iqSamplesRef.current = iqSamplesRef.current.slice(-25000);
          }
        }
      }
    },
    [config.enableRDS],
  );

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (sampleCheckTimeoutRef.current) {
        clearTimeout(sampleCheckTimeoutRef.current);
      }
      if (dwellResolveRef.current) {
        dwellResolveRef.current();
      }
      void settleReceivePromise();
    };
  }, [settleReceivePromise]);

  return useMemo(
    () => ({
      // State
      state,
      config,
      currentFrequency,
      activeSignals,
      progress,

      // Actions
      startScan,
      pauseScan,
      resumeScan,
      stopScan,
      updateConfig,
      clearSignals,
      updateSamples,
    }),
    [
      state,
      config,
      currentFrequency,
      activeSignals,
      progress,
      startScan,
      pauseScan,
      resumeScan,
      stopScan,
      updateConfig,
      clearSignals,
      updateSamples,
    ],
  );
}
