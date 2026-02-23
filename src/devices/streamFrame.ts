export type SDRDiscontinuityCause =
    | 'restart'
    | 'retune'
    | 'sample_rate_change'
    | 'reset'
    | 'overflow'
    | 'dropped_samples';

export interface SDRDiscontinuityEvent {
    cause: SDRDiscontinuityCause;
    sequence: number;
    sampleIndex: number;
    droppedSamples?: number;
    wallClockMs?: number;
}

export type SDRSampleClockTruthMode = 'unknown' | 'corrected_ppm' | 'disciplined_ref';

export type SDRSampleClockInfo =
    | {
          truthMode: 'unknown';
      }
    | {
          truthMode: 'corrected_ppm';
          correctionPpm: number;
      }
    | {
          truthMode: 'disciplined_ref';
          referenceId: string;
          correctionPpm?: number;
      };

export interface SDRStreamFrame {
    sequence: number;
    sampleIndex: number;
    sampleCount: number;
    timestampNs: number;
    sampleRate: number;
    droppedSamples: number;
    discontinuity?: SDRDiscontinuityEvent;
    sampleClock?: SDRSampleClockInfo;
}