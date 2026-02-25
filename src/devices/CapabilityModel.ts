export type SdrSourceType = 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE';

export type DeviceCapabilityState = 'supported' | 'unsupported' | 'unknown';

export type DeviceGainStageConstraint = {
  name: string;
  min: number;
  max: number;
  step: number;
  order: number;
  coupledWith?: string[];
};

export type DeviceClockingCapabilities = {
  internalClock: DeviceCapabilityState;
  external10MhzRef: DeviceCapabilityState;
  referenceLockTelemetry: DeviceCapabilityState;
};

export type DeviceRfPowerCapabilities = {
  biasTee: DeviceCapabilityState;
  ampControl: DeviceCapabilityState;
  gpioControl: DeviceCapabilityState;
};

export type DeviceSampleFormatCapabilities = {
  iqOrder: 'iq' | 'qi' | 'unknown';
  sampleType: 'u8' | 'i8' | 'i16' | 'f32' | 'unknown';
  interleaved: boolean;
  normalizedToUnitRange: boolean;
  invertIQSupported: DeviceCapabilityState;
  swapIQSupported: DeviceCapabilityState;
};

export type DeviceIqControlCapabilities = {
  swap: DeviceCapabilityState;
  invert: DeviceCapabilityState;
  implementation: 'device' | 'dsp' | 'none';
};

export type DeviceFrontEndCorrectionCapabilities = {
  dcOffset: DeviceCapabilityState;
  iqBalance: DeviceCapabilityState;
  implementation: 'device' | 'dsp' | 'none';
};

export type DeviceCapabilityModel = {
  sourceType: SdrSourceType;
  deviceName: string;
  supportedSampleRatesHz: number[];
  supportedAnalogBandwidthsHz: number[];
  gainStages: DeviceGainStageConstraint[];
  agcControl: DeviceCapabilityState;
  dcCorrectionControl: DeviceCapabilityState;
  loOffsetControl: DeviceCapabilityState;
  basebandFilterControl: DeviceCapabilityState;
  rfPower: DeviceRfPowerCapabilities;
  clocking: DeviceClockingCapabilities;
  sampleFormat: DeviceSampleFormatCapabilities;
  iqControl: DeviceIqControlCapabilities;
  frontEndCorrection: DeviceFrontEndCorrectionCapabilities;
};

export const defaultCapabilityModel = (sourceType: SdrSourceType, deviceName: string): DeviceCapabilityModel => ({
  sourceType,
  deviceName,
  supportedSampleRatesHz: [],
  supportedAnalogBandwidthsHz: [],
  gainStages: [],
  agcControl: 'unknown',
  dcCorrectionControl: 'unknown',
  loOffsetControl: 'unknown',
  basebandFilterControl: 'unknown',
  rfPower: {
    biasTee: 'unknown',
    ampControl: 'unknown',
    gpioControl: 'unknown'
  },
  clocking: {
    internalClock: 'supported',
    external10MhzRef: 'unknown',
    referenceLockTelemetry: 'unknown'
  },
  sampleFormat: {
    iqOrder: 'unknown',
    sampleType: 'unknown',
    interleaved: true,
    normalizedToUnitRange: false,
    invertIQSupported: 'unknown',
    swapIQSupported: 'unknown'
  },
  iqControl: {
    swap: 'unknown',
    invert: 'unknown',
    implementation: 'none'
  },
  frontEndCorrection: {
    dcOffset: 'unknown',
    iqBalance: 'unknown',
    implementation: 'none'
  }
});
