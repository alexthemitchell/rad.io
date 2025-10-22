import { useState, useRef, useCallback, useEffect } from "react";
import { ISDRDevice, IQSample } from "../models/SDRDevice";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
import { AudioStreamProcessor, DemodulationType } from "../utils/audioStream";
import {
  calculateFFTSync,
  detectSpectralPeaks,
  estimateNoiseFloor,
  type SpectralPeak,
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
  const dwellResolveRef = useRef<(() => void) | null>(null);
  const samplesRef = useRef<number[]>([]);
  const iqSamplesRef = useRef<IQSample[]>([]);
  const isScanningRef = useRef(false);
  const audioProcessorRef = useRef<AudioStreamProcessor | null>(null);

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
        // Stop any previous streaming
        if (device.isReceiving()) {
          await device.stopRx();
        }

        // Tune to center frequency
        await device.setFrequency(centerFrequency);
        setCurrentFrequency(centerFrequency);

        // Clear previous samples
        iqSamplesRef.current = [];

        // Start receiving samples (non-blocking - starts streaming in background)
        void device.receive((data: DataView) => {
          // Only process if still scanning
          if (!isScanningRef.current) {
            return;
          }

          // Parse and store IQ samples
          const samples = device.parseSamples(data);
          iqSamplesRef.current.push(...samples);
        });

        // Wait for dwell time to collect samples (abortable)
        await new Promise<void>((resolve) => {
          dwellResolveRef.current = (): void => {
            dwellResolveRef.current = null;
            resolve();
          };
          scanTimeoutRef.current = setTimeout(() => {
            scanTimeoutRef.current = null;
            dwellResolveRef.current = null;
            resolve();
          }, config.dwellTime);
        });

        // Stop streaming
        if (device.isReceiving()) {
          await device.stopRx();
        }

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
        if (device.isReceiving()) {
          await device.stopRx().catch(console.error);
        }
      }
    },
    [device, config, onSignalDetected],
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
      let sampleRate = await device.getSampleRate();
      if (!sampleRate || sampleRate === 0) {
        // Set to 2.048 MSPS for browser-friendly real-time processing
        sampleRate = 2.048e6;
        await device.setSampleRate(sampleRate);
        console.info(
          `Scanner: Initialized device sample rate to ${sampleRate / 1e6} MSPS`,
        );
      }
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
    if (!device || !device.isOpen()) {
      console.error("Device not available or not open");
      return;
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
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      if (dwellResolveRef.current) {
        dwellResolveRef.current();
      }
    }
  }, [state]);

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
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (dwellResolveRef.current) {
      dwellResolveRef.current();
    }
  }, []);

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
        samplesRef.current = [...samplesRef.current, ...amplitudes];
        // Keep only recent samples to avoid memory issues
        if (samplesRef.current.length > 10000) {
          samplesRef.current = samplesRef.current.slice(-5000);
        }

        // Also store IQ samples if provided (for RDS decoding)
        if (iqSamples && config.enableRDS) {
          iqSamplesRef.current = [...iqSamplesRef.current, ...iqSamples];
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
      if (dwellResolveRef.current) {
        dwellResolveRef.current();
      }
    };
  }, []);

  return {
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
  };
}
