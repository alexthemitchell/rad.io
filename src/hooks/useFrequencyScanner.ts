import { useState, useRef, useCallback, useEffect } from "react";
import { ISDRDevice, IQSample } from "../models/SDRDevice";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
import { AudioStreamProcessor, DemodulationType } from "../utils/audioStream";

/**
 * Configuration for frequency scanning
 */
export interface FrequencyScanConfig {
  /** Start frequency in Hz */
  startFrequency: number;
  /** End frequency in Hz */
  endFrequency: number;
  /** Step size in Hz */
  stepSize: number;
  /** Signal strength threshold for detection (0-1 scale) */
  threshold: number;
  /** Dwell time per frequency in ms */
  dwellTime: number;
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
    stepSize: 100e3, // 100 kHz
    threshold: 0.3, // 30% signal strength
    dwellTime: 50, // 50ms per frequency
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
   * Calculate signal strength from IQ samples
   */
  const calculateSignalStrength = useCallback((samples: number[]): number => {
    if (samples.length === 0) {
      return 0;
    }

    // Calculate RMS (Root Mean Square) for signal strength
    const sumSquares = samples.reduce((sum, val) => sum + val * val, 0);
    const rms = Math.sqrt(sumSquares / samples.length);

    // Normalize to 0-1 range (assuming max amplitude is 1.0)
    return Math.min(rms, 1.0);
  }, []);

  /**
   * Scan a single frequency
   */
  const scanFrequency = useCallback(
    async (frequency: number): Promise<void> => {
      if (!device || !device.isOpen()) {
        return;
      }

      try {
        // Stop any previous streaming
        if (device.isReceiving()) {
          await device.stopRx();
        }

        // Tune to frequency
        await device.setFrequency(frequency);
        setCurrentFrequency(frequency);

        // Clear any previous samples immediately after tuning to avoid contamination
        samplesRef.current = [];
        iqSamplesRef.current = [];

        // Start receiving samples
        await device.receive((data: DataView) => {
          // Parse the raw data into IQ samples
          const samples = device.parseSamples(data);

          // Store IQ samples for RDS processing
          iqSamplesRef.current.push(...samples);

          // Calculate amplitudes for signal strength
          const amplitudes = samples.map((s) =>
            Math.sqrt(s.I * s.I + s.Q * s.Q),
          );
          samplesRef.current.push(...amplitudes);
        });

        // Wait for dwell time to collect samples (abortable)
        await new Promise<void>((resolve) => {
          // Store resolver so pause/stop can resolve early
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
        await device.stopRx();

        // If scanning has been paused/stopped during dwell, exit early
        if (!isScanningRef.current) {
          return;
        }

        // Calculate signal strength from collected samples
        const strength = calculateSignalStrength(samplesRef.current);

        // Check if signal exceeds threshold
        if (strength >= config.threshold) {
          const signal: ActiveSignal = {
            frequency,
            strength,
            timestamp: new Date(),
          };

          // For FM frequencies (88-108 MHz), attempt RDS decoding if enabled
          const isFM = frequency >= 88e6 && frequency <= 108e6;
          if (isFM && config.enableRDS && iqSamplesRef.current.length > 0) {
            try {
              // Initialize audio processor if not already created
              if (!audioProcessorRef.current) {
                const sampleRate = await device.getSampleRate();
                audioProcessorRef.current = new AudioStreamProcessor(
                  sampleRate,
                );
              }

              // Process a batch of IQ samples for RDS extraction
              // Use a limited sample size to keep dwell time reasonable
              const sampleBatch = iqSamplesRef.current.slice(0, 50000);
              const result = await audioProcessorRef.current.extractAudio(
                sampleBatch,
                DemodulationType.FM,
                {
                  sampleRate: 48000,
                  enableRDS: true,
                },
              );

              // Attach RDS data to signal if available
              if (result.rdsData) {
                signal.rdsData = result.rdsData;
                signal.rdsStats = result.rdsStats;
              }
            } catch (error) {
              console.warn(`RDS extraction failed for ${frequency}:`, error);
              // Continue without RDS data
            }
          }

          setActiveSignals((prev) => {
            // Check if we already have this frequency
            const exists = prev.find((s) => s.frequency === frequency);
            if (exists) {
              // Update existing signal with new strength
              return prev.map((s) => (s.frequency === frequency ? signal : s));
            }
            // Add new signal
            return [...prev, signal];
          });

          onSignalDetected?.(signal);
        }

        // Clear samples for next frequency window
        samplesRef.current = [];
        iqSamplesRef.current = [];
      } catch (error) {
        console.error(`Error scanning frequency ${frequency}:`, error);
        // Make sure streaming is stopped even on error
        if (device.isReceiving()) {
          await device.stopRx().catch(console.error);
        }
      }
    },
    [
      device,
      config.dwellTime,
      config.threshold,
      config.enableRDS,
      calculateSignalStrength,
      onSignalDetected,
    ],
  );

  /**
   * Perform full scan
   */
  const performScan = useCallback(async (): Promise<void> => {
    if (!device || !device.isOpen() || !isScanningRef.current) {
      return;
    }

    const { startFrequency, endFrequency, stepSize } = config;
    if (stepSize <= 0 || endFrequency < startFrequency) {
      // Invalid configuration, abort scan gracefully
      setState("idle");
      isScanningRef.current = false;
      setCurrentFrequency(null);
      setProgress(0);
      return;
    }

    // Inclusive step count (start and end included)
    const totalSteps = Math.max(
      1,
      Math.floor((endFrequency - startFrequency) / stepSize) + 1,
    );
    let currentStep = 0;

    for (
      let freq = startFrequency;
      freq <= endFrequency && isScanningRef.current;
      freq += stepSize
    ) {
      await scanFrequency(freq);
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
  }, [device, config, scanFrequency]);

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
