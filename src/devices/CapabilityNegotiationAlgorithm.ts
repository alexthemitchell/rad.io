import type { DeviceCapabilityModel } from './CapabilityModel';
import { clampGainValue, sortGainStagesByOrder } from './GainStageValidator';

export type CapabilityNegotiationInput = {
  capability: DeviceCapabilityModel;
  requestedSampleRateHz: number;
  requestedBandwidthHz: number;
  requestedGainByStage?: Record<string, number>;
  requestedStreamingProfile?: 'low-latency' | 'balanced' | 'stable';
  compatibilityStatus?: 'known-good' | 'unknown' | 'known-unsupported';
};

export type NegotiatedGainStage = {
  name: string;
  value: number;
};

export type NegotiatedStreamingProfile = {
  profileName: 'low-latency' | 'balanced' | 'stable';
  transferSizeBytes: number;
  retryDelayMs: number;
  maxConsecutiveFailures: number;
};

export type CapabilityNegotiationResult = {
  selectedSampleRateHz: number;
  selectedBandwidthHz: number;
  selectedGains: NegotiatedGainStage[];
  selectedStreamingProfile: NegotiatedStreamingProfile;
  reapplyOrder: Array<'sample-rate' | 'bandwidth' | 'gains' | 'streaming-profile'>;
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

const STREAMING_PROFILES: Record<
  NegotiatedStreamingProfile['profileName'],
  Omit<NegotiatedStreamingProfile, 'profileName'>
> = {
  'low-latency': {
    transferSizeBytes: 8_192,
    retryDelayMs: 10,
    maxConsecutiveFailures: 6
  },
  balanced: {
    transferSizeBytes: 16_384,
    retryDelayMs: 20,
    maxConsecutiveFailures: 8
  },
  stable: {
    transferSizeBytes: 32_768,
    retryDelayMs: 35,
    maxConsecutiveFailures: 12
  }
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

  const orderedStages = sortGainStagesByOrder(input.capability.gainStages);
  const selectedGains: NegotiatedGainStage[] = orderedStages.map((stage) => {
    const requested = input.requestedGainByStage?.[stage.name] ?? stage.min;
    const selected = clampGainValue(requested, stage);
    if (selected !== requested) {
      trace.push(`gain ${stage.name} clamped ${requested} -> ${selected}`);
    } else {
      trace.push(`gain ${stage.name} accepted ${selected}`);
    }

    return {
      name: stage.name,
      value: selected
    };
  });

  const requestedProfile = input.requestedStreamingProfile ?? 'balanced';
  let profileName: NegotiatedStreamingProfile['profileName'] = requestedProfile;
  if (input.compatibilityStatus === 'known-unsupported') {
    profileName = 'stable';
    trace.push('streaming-profile forced to stable due to known-unsupported compatibility status');
  } else if (input.compatibilityStatus !== 'known-good' && requestedProfile === 'low-latency') {
    profileName = 'balanced';
    trace.push('streaming-profile downgraded low-latency -> balanced for unknown compatibility safety');
  } else {
    trace.push(`streaming-profile accepted ${profileName}`);
  }

  const selectedStreamingProfile: NegotiatedStreamingProfile = {
    profileName,
    ...STREAMING_PROFILES[profileName]
  };

  return {
    selectedSampleRateHz,
    selectedBandwidthHz,
    selectedGains,
    selectedStreamingProfile,
    reapplyOrder: ['sample-rate', 'bandwidth', 'gains', 'streaming-profile'],
    decisionTrace: trace
  };
};
