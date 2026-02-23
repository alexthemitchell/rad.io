import type { SDRSampleClockTruthMode } from '../devices/streamFrame';

export type RfAudioTimebaseAlignmentInput = {
  streamSessionStartedUnixMs: number | null;
  exportUnixMs: number;
  lastFrameSequence: number | null;
  lastFrameSampleIndex: number | null;
  lastFrameTimestampNs: number | null;
  lastFrameSampleRate: number | null;
  audioQueueAheadMs: number;
  audioUnderruns: number;
  audioConcealmentEvents?: number;
  audioPopSuppressionEvents?: number;
  sampleClockTruthMode: SDRSampleClockTruthMode | null;
};

export type RfAudioTimebaseAlignmentSnapshot = {
  modelVersion: 1;
  rf: {
    sequence: number | null;
    sampleIndex: number | null;
    timestampNs: number | null;
    sampleRateHz: number | null;
    elapsedMsFromSampleClock: number | null;
  };
  audio: {
    queueAheadMs: number;
    underruns: number;
    concealmentEvents: number;
    popSuppressionEvents: number;
    estimatedPlaybackHeadMs: number | null;
  };
  drift: {
    estimatedPpm: number | null;
    bounded: boolean;
    boundPpm: number;
  };
  truth: {
    mode: SDRSampleClockTruthMode;
    confidence: 'relative-only' | 'corrected' | 'disciplined';
  };
};

const toTruthMode = (mode: SDRSampleClockTruthMode | null): SDRSampleClockTruthMode => {
  return mode ?? 'unknown';
};

const toConfidence = (mode: SDRSampleClockTruthMode): RfAudioTimebaseAlignmentSnapshot['truth']['confidence'] => {
  if (mode === 'disciplined_ref') {
    return 'disciplined';
  }

  if (mode === 'corrected_ppm') {
    return 'corrected';
  }

  return 'relative-only';
};

export const createRfAudioTimebaseAlignmentSnapshot = (
  input: RfAudioTimebaseAlignmentInput,
  driftBoundPpm = 200
): RfAudioTimebaseAlignmentSnapshot => {
  const truthMode = toTruthMode(input.sampleClockTruthMode);
  const elapsedMsFromSampleClock =
    typeof input.lastFrameTimestampNs === 'number' ? input.lastFrameTimestampNs / 1_000_000 : null;

  const wallElapsedMs =
    typeof input.streamSessionStartedUnixMs === 'number'
      ? Math.max(0, input.exportUnixMs - input.streamSessionStartedUnixMs)
      : null;

  const estimatedPlaybackHeadMs =
    typeof wallElapsedMs === 'number' ? wallElapsedMs + Math.max(0, input.audioQueueAheadMs) : null;

  let estimatedPpm: number | null = null;
  if (
    typeof elapsedMsFromSampleClock === 'number' &&
    elapsedMsFromSampleClock > 0 &&
    typeof estimatedPlaybackHeadMs === 'number'
  ) {
    estimatedPpm = ((estimatedPlaybackHeadMs - elapsedMsFromSampleClock) / elapsedMsFromSampleClock) * 1_000_000;
  }

  return {
    modelVersion: 1,
    rf: {
      sequence: input.lastFrameSequence,
      sampleIndex: input.lastFrameSampleIndex,
      timestampNs: input.lastFrameTimestampNs,
      sampleRateHz: input.lastFrameSampleRate,
      elapsedMsFromSampleClock
    },
    audio: {
      queueAheadMs: Math.max(0, input.audioQueueAheadMs),
      underruns: Math.max(0, input.audioUnderruns),
      concealmentEvents: Math.max(0, input.audioConcealmentEvents ?? 0),
      popSuppressionEvents: Math.max(0, input.audioPopSuppressionEvents ?? 0),
      estimatedPlaybackHeadMs
    },
    drift: {
      estimatedPpm,
      bounded: typeof estimatedPpm === 'number' ? Math.abs(estimatedPpm) <= driftBoundPpm : true,
      boundPpm: driftBoundPpm
    },
    truth: {
      mode: truthMode,
      confidence: toConfidence(truthMode)
    }
  };
};
