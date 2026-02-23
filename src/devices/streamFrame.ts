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

export interface SDRStreamFrame {
    sequence: number;
    sampleIndex: number;
    sampleCount: number;
    timestampNs: number;
    sampleRate: number;
    droppedSamples: number;
    discontinuity?: SDRDiscontinuityEvent;
}