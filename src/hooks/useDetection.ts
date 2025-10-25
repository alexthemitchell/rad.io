/**
 * React hook for signal detection
 * Provides easy integration of detection system into React components
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { DetectionManager } from "../lib/detection/detection-manager";
import type {
  ClassifiedSignal,
  DetectionConfig,
} from "../lib/detection";

/**
 * Hook return type
 */
export interface UseDetectionReturn {
  /** Detected signals */
  signals: ClassifiedSignal[];
  /** Current noise floor in dB */
  noiseFloor: number;
  /** Detection manager instance */
  detectionManager: DetectionManager | null;
  /** Whether detection is initialized */
  isInitialized: boolean;
  /** Clear detected signals */
  clearSignals: () => void;
  /** Update detection configuration */
  setConfig: (config: DetectionConfig) => void;
}

/**
 * Maximum number of signals to keep in memory
 * Prevents unbounded memory growth in long-running sessions
 */
const MAX_SIGNALS = 1000;

/**
 * React hook for signal detection
 * @param enableAutoDetection Automatically initialize detection on mount
 * @returns Detection state and controls
 */
export function useDetection(
  enableAutoDetection = false,
): UseDetectionReturn {
  const [signals, setSignals] = useState<ClassifiedSignal[]>([]);
  const [noiseFloor, setNoiseFloor] = useState<number>(-Infinity);
  const [isInitialized, setIsInitialized] = useState(false);
  const [config, setConfig] = useState<DetectionConfig>({});

  const managerRef = useRef<DetectionManager | null>(null);

  // Initialize detection manager
  useEffect(() => {
    if (!enableAutoDetection) {return;}

    const initializeDetection = async () => {
      if (managerRef.current) {return;}

      const manager = new DetectionManager();
      await manager.initialize();

      manager.onDetection((detectedSignals) => {
        setSignals((prev) => {
          const updated = [...prev, ...detectedSignals];
          // Keep only the most recent MAX_SIGNALS signals
          if (updated.length > MAX_SIGNALS) {
            return updated.slice(updated.length - MAX_SIGNALS);
          }
          return updated;
        });
      });

      manager.onNoiseFloor((floor) => {
        setNoiseFloor(floor);
      });

      managerRef.current = manager;
      setIsInitialized(true);
    };

    initializeDetection().catch((error) => {
      console.error("Failed to initialize detection:", error);
    });

    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, [enableAutoDetection]);

  const clearSignals = useCallback(() => {
    setSignals([]);
  }, []);

  return {
    signals,
    noiseFloor,
    detectionManager: managerRef.current,
    isInitialized,
    clearSignals,
    setConfig,
  };
}
