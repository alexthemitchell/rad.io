import type { DeviceCapabilityModel } from '../devices/CapabilityModel';
import type { SDRSampleClockTruthMode } from '../devices/streamFrame';

export type ReferenceClockSupportModelInput = {
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR' | 'FILE';
  capabilityModel: DeviceCapabilityModel | null;
  sampleClockTruthMode: SDRSampleClockTruthMode | null;
};

export type ReferenceClockSupportModel = {
  supported: boolean;
  externalReferenceSupport: 'supported' | 'unsupported' | 'unknown';
  telemetrySupport: 'supported' | 'unsupported' | 'unknown';
  activeClockPath: 'internal' | 'external' | 'unknown';
  summary: string;
};

export type ReferenceLockProofSample = {
  tsIso: string;
  driftConfidence01: number;
  phaseErrorRms: number;
  audioResamplerRatioDeltaPpm: number;
  usbTransferJitterMs: number;
  usbErrorCount: number;
};

export type ReferenceLockProofAssessment = {
  status: 'pass' | 'fail' | 'insufficient';
  confidence01: number;
  windowSeconds: number;
  reasons: string[];
  summary: string;
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

export const deriveReferenceClockSupportModel = (
  input: ReferenceClockSupportModelInput
): ReferenceClockSupportModel => {
  const external = input.capabilityModel?.clocking.external10MhzRef ?? 'unknown';
  const telemetry = input.capabilityModel?.clocking.referenceLockTelemetry ?? 'unknown';
  const activeClockPath = input.sampleClockTruthMode === 'disciplined_ref'
    ? 'external'
    : input.sampleClockTruthMode === 'corrected_ppm'
      ? 'internal'
      : 'unknown';

  const supported = external === 'supported' || input.sourceType === 'HACKRF';

  const summary = supported
    ? `Reference model active (${activeClockPath} path, lock telemetry ${telemetry}).`
    : 'Reference model unavailable for this source.';

  return {
    supported,
    externalReferenceSupport: external,
    telemetrySupport: telemetry,
    activeClockPath,
    summary
  };
};

export const evaluateReferenceLockProof = (input: {
  supportModel: ReferenceClockSupportModel;
  sampleClockTruthMode: SDRSampleClockTruthMode | null;
  samples: ReferenceLockProofSample[];
  minWindowSeconds: number;
}): ReferenceLockProofAssessment => {
  if (!input.supportModel.supported || input.sampleClockTruthMode !== 'disciplined_ref') {
    return {
      status: 'insufficient',
      confidence01: 0,
      windowSeconds: 0,
      reasons: ['disciplined-reference-not-active'],
      summary: 'Reference lock proof requires disciplined reference telemetry.'
    };
  }

  if (input.samples.length < 2) {
    return {
      status: 'insufficient',
      confidence01: 0,
      windowSeconds: 0,
      reasons: ['insufficient-window'],
      summary: 'Collect more samples before evaluating reference lock confidence.'
    };
  }

  const startMs = Date.parse(input.samples[0].tsIso);
  const endMs = Date.parse(input.samples[input.samples.length - 1].tsIso);
  const windowSeconds = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, (endMs - startMs) / 1000)
    : 0;

  if (windowSeconds < input.minWindowSeconds) {
    return {
      status: 'insufficient',
      confidence01: clamp01(windowSeconds / input.minWindowSeconds),
      windowSeconds,
      reasons: ['window-too-short'],
      summary: `Need at least ${input.minWindowSeconds}s proof window (have ${windowSeconds.toFixed(1)}s).`
    };
  }

  const avgDriftConfidence = input.samples.reduce((sum, sample) => sum + sample.driftConfidence01, 0) / input.samples.length;
  const avgPhaseError = input.samples.reduce((sum, sample) => sum + Math.abs(sample.phaseErrorRms), 0) / input.samples.length;
  const avgAudioDeltaPpm = input.samples.reduce((sum, sample) => sum + Math.abs(sample.audioResamplerRatioDeltaPpm), 0) / input.samples.length;
  const avgUsbJitter = input.samples.reduce((sum, sample) => sum + sample.usbTransferJitterMs, 0) / input.samples.length;
  const usbErrors = input.samples.reduce((sum, sample) => sum + sample.usbErrorCount, 0);

  const reasons: string[] = [];
  if (avgDriftConfidence < 0.7) {
    reasons.push('low-drift-confidence');
  }
  if (avgPhaseError > 0.08) {
    reasons.push('high-phase-error');
  }
  if (avgAudioDeltaPpm > 80) {
    reasons.push('audio-ratio-delta-high');
  }
  if (avgUsbJitter > 5 || usbErrors > 0) {
    reasons.push('usb-path-unstable');
  }

  const confidence01 = clamp01(
    (avgDriftConfidence * 0.45)
      + ((1 - Math.min(1, avgPhaseError / 0.2)) * 0.2)
      + ((1 - Math.min(1, avgAudioDeltaPpm / 160)) * 0.2)
      + ((1 - Math.min(1, avgUsbJitter / 10)) * 0.15)
  );

  if (reasons.length === 0 && confidence01 >= 0.7) {
    return {
      status: 'pass',
      confidence01,
      windowSeconds,
      reasons,
      summary: `Reference lock proven over ${windowSeconds.toFixed(1)}s window.`
    };
  }

  return {
    status: 'fail',
    confidence01,
    windowSeconds,
    reasons,
    summary: `Reference lock proof failed: ${reasons.join(', ')}.`
  };
};
