import type { RdsSnapshot } from '../dsp/RdsDecoder';
import type { DemodQualityMetrics } from '../dsp/DemodMetrics';
import type { SDRSampleClockTruthMode } from '../devices/streamFrame';
import type { WorkerTransportMode } from '../dsp/WorkerBridge';

export type DemodMode = 'WFM' | 'AM' | 'NFM' | 'SAM' | 'USB' | 'LSB' | 'CW';

export const RUNTIME_TELEMETRY_SCHEMA_VERSION = '1.2.0' as const;
export const DSP_AMPLITUDE_CONTRACT_VERSION = '1.0.0' as const;
export const DEMOD_QUALITY_CONTRACT_VERSION = '1.0.0' as const;
export const AGC_CONTRACT_VERSION = '1.0.0' as const;
export const PIPELINE_TIMING_CONTRACT_VERSION = '1.0.0' as const;
export const RF_IMPURITY_CONTRACT_VERSION = '1.0.0' as const;

export type DspAmplitudeTelemetryV1 = {
  contractVersion: typeof DSP_AMPLITUDE_CONTRACT_VERSION;
  sampleCount: number;
  iqRmsLinear: number;
  iqPeakLinear: number;
  iqCrestFactor: number;
  audioRmsLinear: number;
  audioPeakLinear: number;
  audioDcOffset: number;
  audioClippingRatio: number;
};

export type DemodQualityTelemetryV1 = {
  contractVersion: typeof DEMOD_QUALITY_CONTRACT_VERSION;
  demodMode: DemodMode;
  qualityScore01: number;
  signalPresent: boolean;
  reasons: string[];
  rdsSynced: boolean | null;
  rdsBlockErrorRate: number | null;
};

export type AgcTelemetryBaselineV1 = {
  contractVersion: typeof AGC_CONTRACT_VERSION;
  implemented: false;
  mode: 'none';
  state: 'not_available';
  targetLevelDbfs: null;
  estimatedGainDb: null;
};

export type AgcTelemetryActiveV1 = {
  contractVersion: typeof AGC_CONTRACT_VERSION;
  implemented: true;
  mode: 'bb' | 'if';
  state: 'idle' | 'tracking' | 'hold';
  targetLevelDbfs: number;
  estimatedGainDb: number;
};

export type AgcTelemetryV1 = AgcTelemetryBaselineV1 | AgcTelemetryActiveV1;

export type PipelineStageTimingTelemetryV1 = {
  contractVersion: typeof PIPELINE_TIMING_CONTRACT_VERSION;
  ddcMs: number;
  fftMs: number;
  demodMs: number;
  downsampleMs: number;
  totalMs: number;
};

export type RfImpurityTelemetryV1 = {
  contractVersion: typeof RF_IMPURITY_CONTRACT_VERSION;
  dcSpurLevelDbfs: number;
  imageRejectionDb: number;
  iqImbalanceRatio: number;
  loLeakageIndicator01: number;
  spurDensity01: number;
  overloadHeuristic01: number;
  likelyImpure: boolean;
  reasons: string[];
};

export type RuntimeDspTelemetryV1 = {
  pipelineTiming: PipelineStageTimingTelemetryV1;
  amplitude: DspAmplitudeTelemetryV1;
  demodQuality: DemodQualityTelemetryV1;
  rfImpurity: RfImpurityTelemetryV1;
};

export type RuntimeTelemetryV1 = {
  telemetrySchemaVersion: typeof RUNTIME_TELEMETRY_SCHEMA_VERSION;
  renderFps: number | null;
  lowFpsEvents: number;
  audioUnderruns: number;
  audioQueueAheadMs: number;
  audioQueueJitterMs: number;
  audioResamplerRatio: number;
  audioResamplerRatioDeltaPpm: number;
  audioConcealmentEvents: number;
  audioPopSuppressionEvents: number;
  audioLimiterEvents: number;
  audioSafetyMuteEvents: number;
  streamDiscontinuities: number;
  droppedFrameEvents: number;
  totalDroppedSamples: number;
  lastDiscontinuityCause: string | null;
  lastFrameSequence: number | null;
  lastFrameSampleIndex: number | null;
  lastFrameTimestampNs: number | null;
  lastFrameSampleRate: number | null;
  lastFrameWallClockMs: number | null;
  lastClockTruthMode: SDRSampleClockTruthMode | null;
  workerTransportMode: WorkerTransportMode;
  dsp: RuntimeDspTelemetryV1;
  agc: AgcTelemetryV1;
};

export const createDefaultRuntimeDspTelemetry = (): RuntimeDspTelemetryV1 => ({
  pipelineTiming: {
    contractVersion: PIPELINE_TIMING_CONTRACT_VERSION,
    ddcMs: 0,
    fftMs: 0,
    demodMs: 0,
    downsampleMs: 0,
    totalMs: 0
  },
  amplitude: {
    contractVersion: DSP_AMPLITUDE_CONTRACT_VERSION,
    sampleCount: 0,
    iqRmsLinear: 0,
    iqPeakLinear: 0,
    iqCrestFactor: 0,
    audioRmsLinear: 0,
    audioPeakLinear: 0,
    audioDcOffset: 0,
    audioClippingRatio: 0
  },
  demodQuality: {
    contractVersion: DEMOD_QUALITY_CONTRACT_VERSION,
    demodMode: 'WFM',
    qualityScore01: 0,
    signalPresent: false,
    reasons: ['no_data'],
    rdsSynced: null,
    rdsBlockErrorRate: null
  },
  rfImpurity: {
    contractVersion: RF_IMPURITY_CONTRACT_VERSION,
    dcSpurLevelDbfs: -180,
    imageRejectionDb: 0,
    iqImbalanceRatio: 1,
    loLeakageIndicator01: 0,
    spurDensity01: 0,
    overloadHeuristic01: 0,
    likelyImpure: false,
    reasons: []
  }
});

export const createDefaultRuntimeTelemetry = (
  workerTransportMode: WorkerTransportMode
): RuntimeTelemetryV1 => ({
  telemetrySchemaVersion: RUNTIME_TELEMETRY_SCHEMA_VERSION,
  renderFps: null,
  lowFpsEvents: 0,
  audioUnderruns: 0,
  audioQueueAheadMs: 0,
  audioQueueJitterMs: 0,
  audioResamplerRatio: 1,
  audioResamplerRatioDeltaPpm: 0,
  audioConcealmentEvents: 0,
  audioPopSuppressionEvents: 0,
  audioLimiterEvents: 0,
  audioSafetyMuteEvents: 0,
  streamDiscontinuities: 0,
  droppedFrameEvents: 0,
  totalDroppedSamples: 0,
  lastDiscontinuityCause: null,
  lastFrameSequence: null,
  lastFrameSampleIndex: null,
  lastFrameTimestampNs: null,
  lastFrameSampleRate: null,
  lastFrameWallClockMs: null,
  lastClockTruthMode: null,
  workerTransportMode,
  dsp: createDefaultRuntimeDspTelemetry(),
  agc: createAgcTelemetryBaseline()
});

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

const toUnit = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

export const createAgcTelemetryBaseline = (): AgcTelemetryBaselineV1 => ({
  contractVersion: AGC_CONTRACT_VERSION,
  implemented: false,
  mode: 'none',
  state: 'not_available',
  targetLevelDbfs: null,
  estimatedGainDb: null
});

export const createAgcTelemetryActive = (
  mode: 'bb' | 'if',
  state: 'idle' | 'tracking' | 'hold',
  targetLevelDbfs: number,
  estimatedGainDb: number
): AgcTelemetryActiveV1 => ({
  contractVersion: AGC_CONTRACT_VERSION,
  implemented: true,
  mode,
  state,
  targetLevelDbfs,
  estimatedGainDb
});

export const computeDspAmplitudeTelemetry = (
  shiftedIq: Float32Array,
  audio: Float32Array
): DspAmplitudeTelemetryV1 => {
  const iqPairs = Math.floor(shiftedIq.length / 2);
  let iqSumSq = 0;
  let iqPeak = 0;

  for (let i = 0; i < iqPairs; i += 1) {
    const iVal = shiftedIq[i * 2] / 128;
    const qVal = shiftedIq[(i * 2) + 1] / 128;
    const mag = Math.hypot(iVal, qVal);

    iqSumSq += mag * mag;
    if (mag > iqPeak) {
      iqPeak = mag;
    }
  }

  let audioSumSq = 0;
  let audioPeak = 0;
  let audioSum = 0;
  let clippedCount = 0;

  for (let i = 0; i < audio.length; i += 1) {
    const sample = audio[i];
    const abs = Math.abs(sample);

    audioSumSq += sample * sample;
    audioSum += sample;
    if (abs > audioPeak) {
      audioPeak = abs;
    }
    if (abs >= 0.98) {
      clippedCount += 1;
    }
  }

  const iqRmsLinear = iqPairs > 0 ? Math.sqrt(iqSumSq / iqPairs) : 0;
  const audioRmsLinear = audio.length > 0 ? Math.sqrt(audioSumSq / audio.length) : 0;

  return {
    contractVersion: DSP_AMPLITUDE_CONTRACT_VERSION,
    sampleCount: audio.length,
    iqRmsLinear: toUnit(iqRmsLinear),
    iqPeakLinear: toUnit(iqPeak),
    iqCrestFactor: iqRmsLinear > 1e-12 ? toUnit(iqPeak / iqRmsLinear) : 0,
    audioRmsLinear: toUnit(audioRmsLinear),
    audioPeakLinear: toUnit(audioPeak),
    audioDcOffset: audio.length > 0 ? audioSum / audio.length : 0,
    audioClippingRatio: audio.length > 0 ? clamp01(clippedCount / audio.length) : 0
  };
};

export const computeDemodQualityTelemetry = (
  demodMetrics: DemodQualityMetrics,
  amplitude: DspAmplitudeTelemetryV1,
  rdsSnapshot: RdsSnapshot | null
): DemodQualityTelemetryV1 => {
  const reasons: string[] = [];

  const signalPresent = amplitude.audioRmsLinear > 0.01 || amplitude.iqRmsLinear > 0.02;
  if (!signalPresent) {
    reasons.push('low_signal');
  }

  if (amplitude.audioClippingRatio > 0.03) {
    reasons.push('audio_clipping');
  }

  if (Math.abs(amplitude.audioDcOffset) > 0.05) {
    reasons.push('audio_dc_offset');
  }

  let score = clamp01((amplitude.audioRmsLinear / 0.35 + demodMetrics.quality) * 0.5);
  score -= Math.min(0.6, amplitude.audioClippingRatio * 2);
  score -= Math.min(0.4, Math.abs(amplitude.audioDcOffset) * 4);

  let rdsSynced: boolean | null = null;
  let rdsBlockErrorRate: number | null = null;

  if (demodMetrics.mode === 'WFM' && rdsSnapshot) {
    rdsSynced = rdsSnapshot.synced;
    rdsBlockErrorRate = clamp01(rdsSnapshot.blockErrorRate);

    if (rdsSnapshot.synced) {
      score += 0.15;
    } else {
      reasons.push('rds_not_synced');
    }

    score -= rdsBlockErrorRate * 0.2;
  }

  return {
    contractVersion: DEMOD_QUALITY_CONTRACT_VERSION,
    demodMode: demodMetrics.mode,
    qualityScore01: clamp01(score),
    signalPresent,
    reasons,
    rdsSynced,
    rdsBlockErrorRate
  };
};

export const computeRfImpurityTelemetry = (
  shiftedIq: Float32Array,
  amplitude: DspAmplitudeTelemetryV1
): RfImpurityTelemetryV1 => {
  const complexCount = Math.floor(shiftedIq.length / 2);
  if (complexCount <= 0) {
    return createDefaultRuntimeDspTelemetry().rfImpurity;
  }

  let sumI = 0;
  let sumQ = 0;
  let sumISq = 0;
  let sumQSq = 0;
  let clippedCount = 0;

  for (let i = 0; i < complexCount; i += 1) {
    const iNorm = shiftedIq[i * 2] / 128;
    const qNorm = shiftedIq[(i * 2) + 1] / 128;
    const absI = Math.abs(iNorm);
    const absQ = Math.abs(qNorm);

    sumI += iNorm;
    sumQ += qNorm;
    sumISq += iNorm * iNorm;
    sumQSq += qNorm * qNorm;

    if (absI >= 0.98 || absQ >= 0.98) {
      clippedCount += 1;
    }
  }

  const meanI = sumI / complexCount;
  const meanQ = sumQ / complexCount;
  const rmsI = Math.sqrt(sumISq / complexCount);
  const rmsQ = Math.sqrt(sumQSq / complexCount);
  const dcMagnitude = Math.hypot(meanI, meanQ);
  const iqMagnitude = Math.max(1e-9, amplitude.iqRmsLinear);
  const dcSpurLevelDbfs = 20 * Math.log10(Math.max(1e-9, dcMagnitude));
  const imageRejectionDb = 20 * Math.log10(Math.max(1e-9, iqMagnitude / Math.max(1e-9, dcMagnitude)));
  const iqImbalanceRatio = Math.max(1e-6, rmsI / Math.max(1e-6, rmsQ));
  const loLeakageIndicator01 = clamp01(dcMagnitude / Math.max(1e-9, iqMagnitude));
  const spurDensity01 = clamp01(clippedCount / complexCount);

  const imbalancePenalty = Math.abs(20 * Math.log10(Math.max(1e-6, iqImbalanceRatio)));
  const overloadHeuristic01 = clamp01(
    (loLeakageIndicator01 * 0.45)
    + (spurDensity01 * 0.35)
    + (clamp01(amplitude.audioClippingRatio * 5) * 0.2)
  );

  const reasons: string[] = [];
  if (dcSpurLevelDbfs > -28) {
    reasons.push('dc_spur_elevated');
  }
  if (imbalancePenalty > 1.5) {
    reasons.push('iq_imbalance_estimated');
  }
  if (loLeakageIndicator01 > 0.2) {
    reasons.push('lo_leakage_indicator_high');
  }
  if (spurDensity01 > 0.03 || overloadHeuristic01 > 0.55) {
    reasons.push('spur_density_or_overload_high');
  }

  return {
    contractVersion: RF_IMPURITY_CONTRACT_VERSION,
    dcSpurLevelDbfs,
    imageRejectionDb,
    iqImbalanceRatio,
    loLeakageIndicator01,
    spurDensity01,
    overloadHeuristic01,
    likelyImpure: reasons.length > 0,
    reasons
  };
};
