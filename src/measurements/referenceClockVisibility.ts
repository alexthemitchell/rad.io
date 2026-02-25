import type { DeviceCapabilityModel } from '../devices/CapabilityModel';
import type { SDRSampleClockTruthMode } from '../devices/streamFrame';

export type ReferenceClockVisibilityInput = {
  capabilityModel: DeviceCapabilityModel | null;
  sampleClockTruthMode: SDRSampleClockTruthMode | null;
  externalReferenceAssessment: {
    status: 'stable' | 'unstable' | 'unknown';
    confidence01: number;
    summary: string;
  };
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR' | 'FILE';
};

export type ReferenceClockVisibility = {
  supported: boolean;
  lockTelemetrySupported: boolean;
  presence: 'present' | 'absent' | 'unknown';
  lockState: 'locked' | 'unlocked' | 'unknown';
  confidence01: number;
  summary: string;
};

export const deriveReferenceClockVisibility = (
  input: ReferenceClockVisibilityInput
): ReferenceClockVisibility => {
  const clocking = input.capabilityModel?.clocking;
  const externalSupported = clocking?.external10MhzRef === 'supported';
  const lockTelemetrySupported = clocking?.referenceLockTelemetry === 'supported';

  if (!externalSupported && input.sourceType !== 'HACKRF') {
    return {
      supported: false,
      lockTelemetrySupported: false,
      presence: 'unknown',
      lockState: 'unknown',
      confidence01: 0,
      summary: 'External reference clock is not modeled for this source.'
    };
  }

  if (input.sampleClockTruthMode !== 'disciplined_ref') {
    return {
      supported: externalSupported || input.sourceType === 'HACKRF',
      lockTelemetrySupported,
      presence: 'unknown',
      lockState: 'unknown',
      confidence01: 0.2,
      summary: 'No disciplined reference metadata observed in stream frames.'
    };
  }

  if (input.externalReferenceAssessment.status === 'stable') {
    return {
      supported: true,
      lockTelemetrySupported,
      presence: 'present',
      lockState: 'locked',
      confidence01: input.externalReferenceAssessment.confidence01,
      summary: input.externalReferenceAssessment.summary
    };
  }

  if (input.externalReferenceAssessment.status === 'unstable') {
    return {
      supported: true,
      lockTelemetrySupported,
      presence: 'present',
      lockState: 'unlocked',
      confidence01: input.externalReferenceAssessment.confidence01,
      summary: input.externalReferenceAssessment.summary
    };
  }

  return {
    supported: true,
    lockTelemetrySupported,
    presence: 'present',
    lockState: 'unknown',
    confidence01: input.externalReferenceAssessment.confidence01,
    summary: input.externalReferenceAssessment.summary
  };
};
