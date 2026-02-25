import type { DeviceCapabilityModel } from './CapabilityModel';

export type CapabilityNegotiationInput = {
  capability: DeviceCapabilityModel;
  requestedSampleRateHz: number;
  requestedBandwidthHz: number;
};

export type CapabilityNegotiationResult = {
  selectedSampleRateHz: number;
  selectedBandwidthHz: number;
  decisionTrace: string[];
};

const chooseNearestAtOrBelow = (supported: readonly number[], requested: number): number => {
  if (supported.length === 0) {
    return requested;
  }

  const sorted = [...supported].sort((a, b) => a - b);
  const candidate = sorted.filter((value) => value <= requested).pop();
  return candidate ?? sorted[0];
};

export const negotiateDeviceCapabilities = (input: CapabilityNegotiationInput): CapabilityNegotiationResult => {
  const trace: string[] = [];

  const selectedSampleRateHz = chooseNearestAtOrBelow(input.capability.supportedSampleRatesHz, input.requestedSampleRateHz);
  if (selectedSampleRateHz !== input.requestedSampleRateHz) {
    trace.push(`sample-rate clamped ${input.requestedSampleRateHz} -> ${selectedSampleRateHz}`);
  } else {
    trace.push(`sample-rate accepted ${selectedSampleRateHz}`);
  }

  const selectedBandwidthHz = chooseNearestAtOrBelow(input.capability.supportedAnalogBandwidthsHz, input.requestedBandwidthHz);
  if (selectedBandwidthHz !== input.requestedBandwidthHz) {
    trace.push(`bandwidth clamped ${input.requestedBandwidthHz} -> ${selectedBandwidthHz}`);
  } else {
    trace.push(`bandwidth accepted ${selectedBandwidthHz}`);
  }

  return {
    selectedSampleRateHz,
    selectedBandwidthHz,
    decisionTrace: trace
  };
};
