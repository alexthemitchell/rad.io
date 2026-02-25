export type ExternalReferenceStabilityInput = {
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR' | 'FILE';
  isStreaming: boolean;
  lastClockTruthMode: 'unknown' | 'corrected_ppm' | 'disciplined_ref' | null;
  driftConfidence: number;
  phaseErrorRms: number;
  audioResamplerRatioDeltaPpm: number;
  usbTransferJitterMs: number;
  usbRetryCount: number;
  usbErrorCount: number;
};

export type ExternalReferenceStabilityAssessment = {
  status: 'stable' | 'unstable' | 'unknown';
  confidence01: number;
  symptoms: string[];
  recommendation: string;
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

export const assessExternalReferenceStability = (
  input: ExternalReferenceStabilityInput
): ExternalReferenceStabilityAssessment => {
  if (input.sourceType !== 'HACKRF' || !input.isStreaming) {
    return {
      status: 'unknown',
      confidence01: 0,
      symptoms: [],
      recommendation: 'External reference heuristics are only evaluated while HackRF streaming is active.',
      summary: 'External reference stability not evaluated.'
    };
  }

  if (input.lastClockTruthMode !== 'disciplined_ref') {
    return {
      status: 'unknown',
      confidence01: 0.2,
      symptoms: ['disciplined-ref-not-observed'],
      recommendation: 'No disciplined reference evidence observed; verify 10 MHz reference routing before trusting ppm stability.',
      summary: 'No disciplined reference signal detected in sample-clock metadata.'
    };
  }

  const symptoms: string[] = [];

  if (input.driftConfidence < 0.45) {
    symptoms.push('low-drift-confidence');
  }

  if (Math.abs(input.phaseErrorRms) > 0.12) {
    symptoms.push('high-phase-error-rms');
  }

  if (Math.abs(input.audioResamplerRatioDeltaPpm) > 120) {
    symptoms.push('large-audio-ratio-delta-ppm');
  }

  if (input.usbTransferJitterMs > 6 || input.usbRetryCount > 8 || input.usbErrorCount > 0) {
    symptoms.push('usb-instability-confounder');
  }

  const unstable = symptoms.some((entry) =>
    entry === 'low-drift-confidence'
    || entry === 'high-phase-error-rms'
    || entry === 'large-audio-ratio-delta-ppm'
  );

  const confidence01 = unstable
    ? clamp01(0.75 - (symptoms.length * 0.08))
    : clamp01(0.72 - (symptoms.includes('usb-instability-confounder') ? 0.12 : 0));

  if (!unstable) {
    return {
      status: 'stable',
      confidence01,
      symptoms,
      recommendation: 'Reference appears stable. Keep USB path clean and continue monitoring drift confidence.',
      summary: 'Disciplined reference telemetry appears stable.'
    };
  }

  return {
    status: 'unstable',
    confidence01,
    symptoms,
    recommendation: 'Reference may be unstable. Check 10 MHz cabling/source quality and remove USB hub/power instability before retrying.',
    summary: `Disciplined reference instability symptoms detected: ${symptoms.join(', ')}.`
  };
};
