/**
 * React hook for frequency scanning
 * Provides easy integration of scanning system into React components
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { scanManager } from "../lib/scanning/scan-manager";
import type {
  ScanConfig,
  ScanResult,
  ScanProgress,
  ScanComplete,
} from "../lib/scanning/types";
import type { ISDRDevice } from "../lib/utils/device-utils";

/**
 * Hook return type
 */
export interface UseScanReturn {
  /** Whether a scan is currently running */
  isScanning: boolean;
  /** Current scan ID */
  scanId: string | null;
  /** Scan results */
  results: ScanResult[];
  /** Current scan progress (0-100) */
  progress: number;
  /** Frequencies with detected signals */
  activeFrequencies: number[];
  /** Start a new scan */
  startScan: (config: ScanConfig, device: ISDRDevice) => void;
  /** Stop the current scan */
  stopScan: () => void;
  /** Clear scan results */
  clearResults: () => void;
}

/**
 * React hook for frequency scanning
 * @param enableDetection Enable signal detection during scans
 * @returns Scan state and controls
 */
export function useScan(enableDetection = false): UseScanReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeFrequencies, setActiveFrequencies] = useState<number[]>([]);

  const initRef = useRef(false);

  // Initialize scan manager
  useEffect(() => {
    if (initRef.current) {
      return;
    }

    scanManager.initialize(enableDetection);

    initRef.current = true;

    return (): void => {
      // Clean up any active scans
      const activeScans = scanManager.getActiveScans();
      for (const id of activeScans) {
        scanManager.stopScan(id);
      }
    };
  }, [enableDetection]);

  // Listen for scan events
  useEffect(() => {
    const handleProgress = (event: Event): void => {
      const customEvent = event as CustomEvent<ScanProgress>;
      const { scanId: eventScanId, result, progress: scanProgress } = customEvent.detail;

      if (eventScanId === scanId) {
        if (result !== undefined) {
          setResults((prev) => [...prev, result]);
        }
        setProgress(scanProgress);
      }
    };

    const handleComplete = (event: Event): void => {
      const customEvent = event as CustomEvent<ScanComplete>;
      const { scanId: eventScanId, activeFrequencies: active } = customEvent.detail;

      if (eventScanId === scanId) {
        setIsScanning(false);
        setActiveFrequencies(active);
        setProgress(100);
      }
    };

    const handleError = (event: Event): void => {
      const customEvent = event as CustomEvent<{ scanId: string; error: string }>;
      const { scanId: eventScanId, error } = customEvent.detail;

      if (eventScanId === scanId) {
        console.error("Scan error:", error);
        setIsScanning(false);
      }
    };

    window.addEventListener("scan:progress", handleProgress);
    window.addEventListener("scan:complete", handleComplete);
    window.addEventListener("scan:error", handleError);

    return (): void => {
      window.removeEventListener("scan:progress", handleProgress);
      window.removeEventListener("scan:complete", handleComplete);
      window.removeEventListener("scan:error", handleError);
    };
  }, [scanId]);

  const startScan = useCallback((config: ScanConfig, device: ISDRDevice): void => {
    if (isScanning) {
      console.warn("Scan already in progress");
      return;
    }

    setResults([]);
    setProgress(0);
    setActiveFrequencies([]);
    setIsScanning(true);

    const id = scanManager.startScan(config, device);
    setScanId(id);
  }, [isScanning]);

  const stopScan = useCallback(() => {
    if (scanId) {
      scanManager.stopScan(scanId);
      setIsScanning(false);
      setScanId(null);
    }
  }, [scanId]);

  const clearResults = useCallback(() => {
    setResults([]);
    setProgress(0);
    setActiveFrequencies([]);
  }, []);

  return {
    isScanning,
    scanId,
    results,
    progress,
    activeFrequencies,
    startScan,
    stopScan,
    clearResults,
  };
}
