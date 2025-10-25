/**
 * DSP and Worker Pool Exports
 * Implements ADR-0002 and ADR-0012
 */

// Worker Pools
export { dspWorkerPool } from "./workers/dsp-worker-pool";
export { fftWorkerPool } from "./dsp/fft-worker-pool";

// Data Structures
export { PriorityQueue } from "./dsp/priority-queue";

// Utilities
export { bufferPool } from "./utils/buffer-pool";
export {
  scanBand,
  findActiveSignals,
  batchScanRanges,
} from "./dsp/band-scanner";

// Monitoring
export { dspMetrics } from "./monitoring/dsp-metrics";
export type { DSPMetrics } from "./monitoring/dsp-metrics";

// Types
export type {
  DSPMessage,
  DSPResponse,
  FFTTask,
  FFTResult,
  ScanResult,
} from "./workers/types";

// Measurement and Calibration (Phase 3)
export {
  FrequencyMarkerManager,
  ChannelPowerMeasurement,
  SignalQualityAnalyzer,
  CalibrationManager,
  SpectrumMaskTester,
  MeasurementLogger,
} from "./measurement";

export type {
  FrequencyMarker,
  MarkerDelta,
  ChannelPowerResult,
  SignalQualityMetrics,
  SpectrumMask,
  MaskPoint,
  MaskTestResult,
  FrequencyCalibration,
  PowerCalibration,
  IQCalibration,
  CalibrationProfile,
  MeasurementLogEntry,
  MeasurementStatistics,
  MeasurementConfig,
} from "./measurement";
