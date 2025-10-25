/**
 * Signal Detection Module
 * Implements ADR-0013: Automatic Signal Detection System
 */

export { NoiseFloorEstimator } from "./noise-floor";
export { PeakDetector } from "./peak-detector";
export { SignalClassifier } from "./signal-classifier";
export { DetectionManager } from "./detection-manager";

export type { Peak } from "./peak-detector";
export type {
  SignalType,
  ClassifiedSignal,
} from "./signal-classifier";
export type {
  DetectionConfig,
  DetectionResult,
} from "./detection-manager";
