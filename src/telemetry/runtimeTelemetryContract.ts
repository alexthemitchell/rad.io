import type { RdsSnapshot } from '../dsp/RdsDecoder';
import type { DemodQualityMetrics } from '../dsp/DemodMetrics';
import type { SDRSampleClockTruthMode } from '../devices/streamFrame';
import type { WorkerTransportMode } from '../dsp/WorkerBridge';

export type DemodMode = 'WFM' | 'AM' | 'NFM';

export const RUNTIME_TELEMETRY_SCHEMA_VERSION = '1.1.0' as const;
export const DSP_AMPLITUDE_CONTRACT_VERSION = '1.0.0' as const;
export const DEMOD_QUALITY_CONTRACT_VERSION = '1.0.0' as const;
export const AGC_CONTRACT_VERSION = '1.0.0' as const;
export const PIPELINE_TIMING_CONTRACT_VERSION = '1.0.0' as const;

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

export type PipelineStageTimingTelemetryV1 = {
  contractVersion: typeof PIPELINE_TIMING_CONTRACT_VERSION;
  ddcMs: number;
  fftMs: number;
  demodMs: number;
  downsampleMs: number;
  totalMs: number;
};

export type RuntimeDspTelemetryV1 = {
  pipelineTiming: PipelineStageTimingTelemetryV1;
  amplitude: DspAmplitudeTelemetryV1;
  demodQuality: DemodQualityTelemetryV1;
};

export type RuntimeTelemetryV1 = {
  telemetrySchemaVersion: typeof RUNTIME_TELEMETRY_SCHEMA_VERSION;
  renderFps: number | null;
  lowFpsEvents: number;
  audioUnderruns: number;
  audioQueueAheadMs: number;
  audioConcealmentEvents: number;
  audioPopSuppressionEvents: number;
  audioLimiterEvents: number;
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
  agc: AgcTelemetryBaselineV1;
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
  audioConcealmentEvents: 0,
  audioPopSuppressionEvents: 0,
  audioLimiterEvents: 0,
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
