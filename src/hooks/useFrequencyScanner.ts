import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { SignalClassifier } from "../lib/detection/signal-classifier";
import { type ISDRDevice, type IQSample } from "../models/SDRDevice";
import { updateBulkCachedRDSData } from "../store/rdsCache";
import { BulkRDSProcessor } from "../utils/bulkRDSProcessor";
import {
  calculateFFTSync,
  detectSpectralPeaks,
  estimateNoiseFloor,
} from "../utils/dsp";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";

/**
 * Configuration for frequency scanning
 */
export interface FrequencyScanConfig {
  /** Start frequency in Hz */
  startFrequency: number;
  /** End frequency in Hz */
  endFrequency: number;
  /** Optional scan step size in Hz (channel spacing). UI-configurable; algorithm may adapt based on device bandwidth. */
  stepSizeHz?: number;
  /** Signal threshold in dB above noise floor for detection */
  thresholdDb: number;
  /** Dwell time per frequency chunk in ms */
  dwellTime: number;
  /** FFT size for spectral analysis (larger = better frequency resolution) */
  fftSize: number;
  /** Minimum spacing between detected peaks in Hz (prevents duplicates) */
  minPeakSpacing: number;
  /** Minimum separation between distinct detected peaks (Hz) for valley merging logic */
  minSeparationHz?: number;
  /** Minimum valley depth (dB) used when deciding if nearby peaks are distinct */
  minValleyDepthDb?: number;
  /** Use FFT worker pool when available */
  useWorkerFFT?: boolean;
  /** Use polyphase filter bank channelizer */
  usePFBChannelizer?: boolean;
  /** Automatically determine threshold from noise floor */
  scanAutoThreshold?: boolean;
  /** Offset in dB above noise floor for auto threshold */
  scanThresholdDbOffset?: number;
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
  /** Signal type classification */
  type?: string;
  /** Classification confidence (0-1 scale) */
  confidence?: number;
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
    stepSizeHz: 100e3, // Default 100 kHz channel spacing (UI in MHz)
    thresholdDb: 10, // 10 dB above noise floor
    dwellTime: 500, // 500ms per frequency chunk (increased for RDS)
    fftSize: 2048, // 2048-point FFT for good resolution
    minPeakSpacing: 100e3, // 100 kHz minimum between peaks (FM station spacing)
    enableRDS: true, // Enable RDS decoding by default for FM scans
    // Detection tuning defaults
    minSeparationHz: 100e3,
    minValleyDepthDb: 6,
    useWorkerFFT: true,
    usePFBChannelizer: true,
    scanAutoThreshold: true,
    scanThresholdDbOffset: 12,
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
  const isScanningRef = useRef<boolean>(false);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const signalClassifierRef = useRef<SignalClassifier | null>(null);
  const bulkRDSProcessorRef = useRef<BulkRDSProcessor | null>(null);

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
      } catch (error: unknown) {
        if (error instanceof Error) {
          const msg = error.message;
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
      if (!device?.isOpen()) {
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

          // Note: We continue collecting for full dwellTime for RDS processing
          // (removed early exit on fftSize reached)
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
            // Continue monitoring - we want to collect for full dwellTime for RDS
            sampleCheckTimeoutRef.current = setTimeout(monitorSamples, 10);
          };

          dwellResolveRef.current = finalize;
          scanTimeoutRef.current = setTimeout(finalize, config.dwellTime);
          sampleCheckTimeoutRef.current = setTimeout(monitorSamples, 10);
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
        for (const value of powerSpectrum) {
          if (typeof value === "number") {
            if (value > maxPower) {
              maxPower = value;
            }
            if (value < minPower) {
              minPower = value;
            }
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
        // Initialize signal classifier once (reuse across scans)
        signalClassifierRef.current ??= new SignalClassifier();

        // Collect FM stations for bulk RDS processing
        const fmStations: Array<{
          frequency: number;
          strength: number;
          signal: ActiveSignal;
        }> = [];

        for (const peak of peaks) {
          // Classify the signal
          const classifiedSignal = signalClassifierRef.current.classify(
            {
              binIndex: peak.binIndex,
              frequency: peak.frequency,
              power: peak.powerDb,
              bandwidth: ((): number => {
                const bin = peak.binIndex;
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const peakPower = powerSpectrum[bin]!;
                const halfPower = peakPower - 3; // -3 dB width approximation
                let left = bin;
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                while (left > 0 && powerSpectrum[left]! > halfPower) {
                  left--;
                }
                let right = bin;
                const len = powerSpectrum.length;
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                while (right < len - 1 && powerSpectrum[right]! > halfPower) {
                  right++;
                }
                const binsWidth = Math.max(1, right - left);
                const freqRes = sampleRate / len;
                return binsWidth * freqRes;
              })(),
              snr: peak.powerDb - noiseFloor,
            },
            powerSpectrum,
          );

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
            type: classifiedSignal.type,
            confidence: classifiedSignal.confidence,
          };

          // Collect FM stations for bulk RDS processing
          const isFM = peak.frequency >= 88e6 && peak.frequency <= 108e6;
          if (isFM && config.enableRDS) {
            fmStations.push({
              frequency: peak.frequency,
              strength: strengthNormalized,
              signal,
            });
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

        // Process all FM stations for RDS in bulk
        if (fmStations.length > 0 && iqSamplesRef.current.length > 0) {
          try {
            // Initialize bulk RDS processor if needed
            bulkRDSProcessorRef.current ??= new BulkRDSProcessor();

            // Extract RDS from all FM stations
            const rdsResults =
              await bulkRDSProcessorRef.current.processStations(
                fmStations.map((s) => ({
                  frequency: s.frequency,
                  strength: s.strength,
                })),
                iqSamplesRef.current,
                sampleRate,
                centerFrequency,
                {
                  minSeparationHz: config.minSeparationHz,
                  minValleyDepthDb: config.minValleyDepthDb,
                  useWorkerFFT: config.useWorkerFFT,
                  usePFBChannelizer: config.usePFBChannelizer,
                  scanAutoThreshold: config.scanAutoThreshold,
                  scanThresholdDbOffset: config.scanThresholdDbOffset,
                  scanThresholdDb: config.thresholdDb,
                },
              );

            // Build map of frequency -> RDS data for efficient lookup
            const rdsMap = new Map<
              number,
              {
                rdsData: RDSStationData;
                rdsStats?: RDSDecoderStats;
              }
            >();

            for (const result of rdsResults) {
              if (result.rdsData) {
                rdsMap.set(result.frequency, {
                  rdsData: result.rdsData,
                  rdsStats: result.rdsStats,
                });
              }
            }

            // Update all signals with RDS data in a SINGLE setState call
            if (rdsMap.size > 0) {
              // Debug: Log actual RDS data
              console.debug("RDS data extracted:", {
                count: rdsMap.size,
                samples: Array.from(rdsMap.entries())
                  .slice(0, 3)
                  .map(([freq, info]) => ({
                    frequency: freq,
                    ps: info.rdsData.ps,
                    rt: info.rdsData.rt,
                    pi: info.rdsData.pi,
                  })),
              });

              setActiveSignals((prev) =>
                prev.map((s) => {
                  const rdsInfo = rdsMap.get(s.frequency);
                  if (rdsInfo) {
                    return {
                      ...s,
                      rdsData: rdsInfo.rdsData,
                      rdsStats: rdsInfo.rdsStats,
                    };
                  }
                  return s;
                }),
              );

              // Bulk update RDS cache
              const rdsUpdates = Array.from(rdsMap.entries()).map(
                ([freq, info]) => ({
                  frequencyHz: freq,
                  data: info.rdsData,
                }),
              );

              updateBulkCachedRDSData(rdsUpdates);
            }
          } catch (error) {
            console.warn("Bulk RDS processing failed:", error);
          }
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
      }

      if (previousSampleRate !== sampleRateToUse) {
        // Sample rate changed - will be set below
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
      // Loop through frequency range in chunks
      for (
        let centerFreq = startFrequency + usableBandwidth / 2;
        centerFreq <= endFrequency - usableBandwidth / 2 &&
        (isScanningRef.current as boolean);
        centerFreq += stepSize
      ) {
        await scanFrequencyChunk(centerFreq, sampleRate);
        currentStep++;
        const pct = Math.min(100, (currentStep / totalSteps) * 100);
        setProgress(pct);
      }

      // Scan complete
      if (isScanningRef.current as boolean) {
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
    void performScan().catch((err: unknown) => {
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
      void performScan().catch((err: unknown) => {
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
