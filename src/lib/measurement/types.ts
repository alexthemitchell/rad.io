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

/**
 * Band classification for S-meter calculations
 * HF: < 30 MHz (S9 = -73 dBm)
 * VHF: >= 30 MHz (S9 = -93 dBm)
 */
export type SMeterBand = "HF" | "VHF";

/**
 * Represents a complete signal strength measurement
 * with multiple representations for different use cases.
 * See docs/reference/s-meter-spec.md for full specification.
 */
export interface SignalLevel {
  /**
   * Power level relative to ADC full scale
   * Range: typically -∞ to 0 dBFS
   * 0 dBFS = maximum ADC input (clipping)
   * Directly measured from IQ samples
   */
  dBfs: number;

  /**
   * Approximate absolute power level at antenna input
   * Range: typically -150 to +10 dBm
   * Requires calibration constant K_cal
   * Formula: dBm = dBfs + K_cal
   */
  dBmApprox: number;

  /**
   * S-unit reading (0-9 scale)
   * 0 = no signal / noise floor
   * 1-8 = weak to good signals
   * 9 = reference level (S9)
   */
  sUnit: number;

  /**
   * Decibels over S9 (for strong signals)
   * 0 = at or below S9
   * >0 = signal is X dB above S9
   * Common values: 0, 10, 20, 40, 60
   * Displayed as "S9+10", "S9+20", etc.
   */
  overS9: number;

  /**
   * Band type used for S-unit calculation
   * 'HF' = below 30 MHz (S9 = -73 dBm)
   * 'VHF' = 30 MHz and above (S9 = -93 dBm)
   */
  band: SMeterBand;

  /**
   * Calibration status indicator
   * 'uncalibrated' = using default K_cal approximation
   * 'factory' = using factory calibration
   * 'user' = using user-performed calibration
   */
  calibrationStatus: "uncalibrated" | "factory" | "user";

  /**
   * Estimated measurement uncertainty in dB
   * Typical values:
   * - Uncalibrated: ±10 dB
   * - Factory calibrated: ±3 dB
   * - User calibrated with signal generator: ±1 dB
   */
  uncertaintyDb?: number;

  /**
   * Timestamp of measurement (milliseconds since epoch)
   */
  timestamp: number;
}

/**
 * Calibration parameters for S-meter
 * Maps dBFS to dBm for a specific device and configuration
 */
export interface SMeterCalibration {
  /**
   * Calibration constant: dBm = dBfs + kCal
   * Typical range: -80 to -40
   */
  kCal: number;

  /**
   * Frequency range this calibration applies to (Hz)
   */
  frequencyRange: {
    min: number;
    max: number;
  };

  /**
   * Gain/attenuation setting this applies to
   * Specific to HackRF, RTL-SDR, etc.
   */
  gainSetting?: {
    lna: number; // LNA gain in dB
    vga: number; // VGA gain in dB
    rxAmp: boolean; // RX amp on/off (HackRF)
  };

  /**
   * How calibration was performed
   */
  method:
    | "signal-generator"
    | "reference-station"
    | "thermal-noise"
    | "default";

  /**
   * Estimated accuracy of this calibration (dB)
   * Typical values: 1-10 dB depending on method
   */
  accuracyDb: number;

  /**
   * When calibration was performed (Unix timestamp ms)
   */
  calibratedAt?: number;
}

/**
 * S-meter display and behavior configuration
 */
export interface SMeterConfig {
  /**
   * Calibration data for current device/settings
   */
  calibration: SMeterCalibration;

  /**
   * Display preferences
   */
  display: {
    /**
     * Show numeric S-unit or graphical meter
     */
    style: "numeric" | "bar" | "needle";

    /**
     * Show dBm value alongside S-unit
     */
    showDbm: boolean;

    /**
     * Show dBFS value (engineering mode)
     */
    showDbfs: boolean;

    /**
     * Update rate (milliseconds)
     */
    updateRateMs: number;

    /**
     * Averaging/smoothing (exponential moving average alpha)
     * 0 = maximum smoothing, 1 = no smoothing
     * Typical: 0.1-0.3 for responsive yet stable reading
     */
    smoothing: number;
  };
}
