/**
 * Universal SDR Device Interface
 *
 * This interface defines a standardized API for Software-Defined Radio devices
 * that can be implemented by any SDR hardware (HackRF, RTLSDR, Airspy, etc.)
 *
 * The interface ensures compatibility with our visualization components and
 * provides a consistent API for device control and data streaming.
 */

export type IQSample = {
  I: number; // In-phase component
  Q: number; // Quadrature component
};

export type IQSampleCallback = (samples: DataView) => void;

export enum SDRDeviceType {
  HACKRF_ONE = "HackRF One",
  RTLSDR = "RTL-SDR",
  AIRSPY = "Airspy",
  GENERIC = "Generic SDR",
}

export type SDRDeviceInfo = {
  type: SDRDeviceType;
  vendorId: number;
  productId: number;
  serialNumber?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
};

export type SDRCapabilities = {
  minFrequency: number; // Hz
  maxFrequency: number; // Hz
  supportedSampleRates: number[]; // Hz
  maxLNAGain?: number; // dB
  maxVGAGain?: number; // dB
  supportsAmpControl: boolean;
  supportsAntennaControl: boolean;
  supportedBandwidths?: number[]; // Hz
};

export type SDRStreamConfig = {
  centerFrequency: number; // Hz
  sampleRate: number; // Hz
  bandwidth?: number; // Hz (if supported)
  lnaGain?: number; // dB (0-40 typical)
  vgaGain?: number; // dB (0-62 typical)
  ampEnabled?: boolean;
  antennaEnabled?: boolean;
};

/**
 * Device Memory Information
 *
 * Provides information about device memory usage and buffer status
 * to help optimize resource allocation during testing and DSP operations.
 */
export type DeviceMemoryInfo = {
  /** Total allocated buffer size in bytes */
  totalBufferSize: number;
  /** Currently used buffer size in bytes */
  usedBufferSize: number;
  /** Number of active sample buffers */
  activeBuffers: number;
  /** Maximum number of samples that can be buffered */
  maxSamples: number;
  /** Current number of samples in buffers */
  currentSamples: number;
};

/**
 * Universal SDR Device Interface
 *
 * All SDR devices should implement this interface to ensure
 * compatibility with the visualization and control components.
 */
export interface ISDRDevice {
  /**
   * Get device information
   */
  getDeviceInfo(): Promise<SDRDeviceInfo>;

  /**
   * Get device capabilities
   */
  getCapabilities(): SDRCapabilities;

  /**
   * Initialize and open the device
   */
  open(): Promise<void>;

  /**
   * Close and cleanup the device
   */
  close(): Promise<void>;

  /**
   * Check if device is currently open
   */
  isOpen(): boolean;

  /**
   * Set center frequency in Hz
   * @param frequencyHz - Center frequency in Hertz
   */
  setFrequency(frequencyHz: number): Promise<void>;

  /**
   * Get current center frequency in Hz
   */
  getFrequency(): Promise<number>;

  /**
   * Set sample rate in Hz
   * @param sampleRateHz - Sample rate in Hertz (samples per second)
   */
  setSampleRate(sampleRateHz: number): Promise<void>;

  /**
   * Get current sample rate in Hz
   */
  getSampleRate(): Promise<number>;

  /**
   * Set LNA (Low Noise Amplifier) gain
   * @param gainDb - Gain value in dB
   */
  setLNAGain(gainDb: number): Promise<void>;

  /**
   * Set VGA (Variable Gain Amplifier) gain
   * @param gainDb - Gain value in dB
   */
  setVGAGain?(gainDb: number): Promise<void>;

  /**
   * Enable/disable RF amplifier
   * @param enabled - True to enable, false to disable
   */
  setAmpEnable(enabled: boolean): Promise<void>;

  /**
   * Set baseband filter bandwidth
   * @param bandwidthHz - Bandwidth in Hertz
   */
  setBandwidth?(bandwidthHz: number): Promise<void>;

  /**
   * Start receiving IQ samples
   * @param callback - Function called with IQ sample data
   * @param config - Optional stream configuration
   */
  receive(
    callback: IQSampleCallback,
    config?: Partial<SDRStreamConfig>,
  ): Promise<void>;

  /**
   * Stop receiving IQ samples
   */
  stopRx(): Promise<void>;

  /**
   * Check if device is currently receiving
   */
  isReceiving(): boolean;

  /**
   * Parse raw sample data into IQ samples
   * @param data - Raw sample data from device
   * @returns Array of IQ samples
   */
  parseSamples(data: DataView): IQSample[];

  /**
   * Get device memory information
   * @returns Memory usage statistics for the device
   */
  getMemoryInfo(): DeviceMemoryInfo;

  /**
   * Clear internal buffers and release memory
   * Useful for testing and memory optimization
   */
  clearBuffers(): void;
}

/**
 * WebUSB SDR Device Configuration
 *
 * Defines the USB filters and configuration needed to identify
 * and connect to SDR devices via WebUSB.
 */
export type SDRUSBFilter = {
  vendorId: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
};

/**
 * Common USB Vendor/Product IDs for SDR devices
 */
export const SDR_USB_DEVICES = {
  HACKRF_ONE: {
    vendorId: 0x1d50,
    productId: 0x6089,
    name: "HackRF One",
  },
  RTLSDR_GENERIC: {
    vendorId: 0x0bda,
    productId: 0x2838,
    name: "RTL-SDR Generic",
  },
  RTLSDR_EZCAP: {
    vendorId: 0x0bda,
    productId: 0x2832,
    name: "RTL-SDR EzCap",
  },
  AIRSPY_MINI: {
    vendorId: 0x1d50,
    productId: 0x60a1,
    name: "Airspy Mini",
  },
  AIRSPY_R2: {
    vendorId: 0x1d50,
    productId: 0x60a1,
    name: "Airspy R2",
  },
} as const;

/**
 * Utility function to validate frequency range
 */
export function validateFrequency(
  frequency: number,
  capabilities: SDRCapabilities,
): boolean {
  return (
    frequency >= capabilities.minFrequency &&
    frequency <= capabilities.maxFrequency
  );
}

/**
 * Utility function to validate sample rate
 */
export function validateSampleRate(
  sampleRate: number,
  capabilities: SDRCapabilities,
): boolean {
  return capabilities.supportedSampleRates.includes(sampleRate);
}

/**
 * Utility function to convert 8-bit signed samples to IQ format
 * Common for many SDR devices including HackRF
 */
export function convertInt8ToIQ(data: DataView): IQSample[] {
  const samples: IQSample[] = [];
  const length = data.byteLength;

  for (let i = 0; i < length; i += 2) {
    const I = data.getInt8(i) / 128.0; // Normalize to -1.0 to 1.0
    const Q = data.getInt8(i + 1) / 128.0;
    samples.push({ I, Q });
  }

  return samples;
}

/**
 * Utility function to convert 8-bit unsigned samples to IQ format
 * Common for RTL-SDR devices
 */
export function convertUint8ToIQ(data: DataView): IQSample[] {
  const samples: IQSample[] = [];
  const length = data.byteLength;

  for (let i = 0; i < length; i += 2) {
    const I = (data.getUint8(i) - 127.5) / 127.5; // Normalize to -1.0 to 1.0
    const Q = (data.getUint8(i + 1) - 127.5) / 127.5;
    samples.push({ I, Q });
  }

  return samples;
}

/**
 * Utility function to convert 16-bit signed samples to IQ format
 * Used by some high-resolution SDR devices
 */
export function convertInt16ToIQ(data: DataView): IQSample[] {
  const samples: IQSample[] = [];
  const length = data.byteLength;

  for (let i = 0; i < length; i += 4) {
    const I = data.getInt16(i, true) / 32768.0; // Little-endian, normalize to -1.0 to 1.0
    const Q = data.getInt16(i + 2, true) / 32768.0;
    samples.push({ I, Q });
  }

  return samples;
}
