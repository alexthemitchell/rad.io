/**
 * Measurement and Calibration Types
 * Implements Phase 3 - Professional Measurement & Compliance Tools
 */

/**
 * Frequency marker for spectrum analysis
 */
export interface FrequencyMarker {
  id: string;
  frequency: number; // Hz
  power?: number; // dBFS or dBm (if calibrated)
  label?: string;
  color?: string;
  active: boolean;
}

/**
 * Marker pair for delta measurements
 */
export interface MarkerDelta {
  marker1Id: string;
  marker2Id: string;
  frequencyDelta: number; // Hz
  powerDelta?: number; // dB
}

/**
 * Channel power measurement result
 */
export interface ChannelPowerResult {
  centerFrequency: number; // Hz
  bandwidth: number; // Hz
  totalPower: number; // dBFS or dBm
  peakPower: number; // dBFS or dBm
  averagePower: number; // dBFS or dBm
  occupiedBandwidth?: number; // Hz (99% power containment)
}

/**
 * Signal quality metrics
 */
export interface SignalQualityMetrics {
  snr?: number; // dB (Signal-to-Noise Ratio)
  sinad?: number; // dB (Signal + Noise + Distortion to Noise + Distortion)
  thd?: number; // % (Total Harmonic Distortion)
  evm?: number; // % (Error Vector Magnitude) for digital modes
  timestamp: number; // Unix timestamp in ms
}

/**
 * Spectrum mask point
 */
export interface MaskPoint {
  frequencyOffset: number; // Hz from center
  powerLimit: number; // dB relative to carrier
}

/**
 * Spectrum mask definition
 */
export interface SpectrumMask {
  id: string;
  name: string;
  description?: string;
  centerFrequency: number; // Hz
  points: MaskPoint[]; // Must be sorted by frequencyOffset
}

/**
 * Mask test result
 */
export interface MaskTestResult {
  maskId: string;
  passed: boolean;
  violations: Array<{
    frequency: number; // Hz
    measuredPower: number; // dB
    limitPower: number; // dB
    margin: number; // dB (negative means violation)
  }>;
  worstMargin: number; // dB
  timestamp: number; // Unix timestamp in ms
}

/**
 * Calibration data for frequency correction
 */
export interface FrequencyCalibration {
  deviceId: string;
  ppmOffset: number; // Parts per million
  referenceFrequency: number; // Hz (e.g., WWV 10 MHz)
  measuredFrequency: number; // Hz
  calibrationDate: number; // Unix timestamp in ms
  temperature?: number; // Celsius
  notes?: string;
}

/**
 * Calibration data for power correction
 */
export interface PowerCalibration {
  deviceId: string;
  gainOffset: number; // dB
  calibrationPoints?: Array<{
    frequency: number; // Hz
    offsetDb: number; // dB
  }>;
  referenceLevel: number; // dBm of calibration signal
  calibrationDate: number; // Unix timestamp in ms
  equipmentUsed?: string;
  notes?: string;
}

/**
 * IQ balance calibration data
 */
export interface IQCalibration {
  deviceId: string;
  dcOffsetI: number;
  dcOffsetQ: number;
  gainImbalance: number; // Ratio (Q/I)
  phaseImbalance: number; // Degrees
  calibrationDate: number; // Unix timestamp in ms
  notes?: string;
}

/**
 * Complete calibration profile for a device
 */
export interface CalibrationProfile {
  deviceId: string;
  deviceName?: string;
  frequency?: FrequencyCalibration;
  power?: PowerCalibration;
  iq?: IQCalibration;
  lastUpdated: number; // Unix timestamp in ms
  version: number;
}

/**
 * Measurement log entry
 */
export interface MeasurementLogEntry {
  id: string;
  timestamp: number; // Unix timestamp in ms
  measurementType:
    | "marker"
    | "channel_power"
    | "signal_quality"
    | "mask_test"
    | "other";
  frequency?: number; // Hz
  data: Record<string, unknown>; // Flexible data storage
  notes?: string;
  tags?: string[];
}

/**
 * Statistics for a series of measurements
 */
export interface MeasurementStatistics {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
}

/**
 * Configuration for measurement operations
 */
export interface MeasurementConfig {
  // Frequency markers
  maxMarkers?: number; // Default: 8
  markerTrackPeak?: boolean; // Default: false

  // Channel power
  integrationMethod?: "rectangular" | "trapezoidal"; // Default: trapezoidal
  occupiedBandwidthThreshold?: number; // Default: 0.99 (99%)

  // Signal quality
  noiseFloorSamples?: number; // Default: 1000
  harmonicCount?: number; // Default: 5 (for THD)

  // Averaging
  averagingEnabled?: boolean; // Default: true
  averagingCount?: number; // Default: 10
  averagingMode?: "linear" | "exponential" | "peak-hold"; // Default: exponential

  // Calibration
  applyFrequencyCalibration?: boolean; // Default: true
  applyPowerCalibration?: boolean; // Default: true
  applyIQCalibration?: boolean; // Default: true
}
