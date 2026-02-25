export type VfoContinuityFrame = {
  sequence: number;
  sampleIndex: number;
  sampleCount: number;
  discontinuity?: {
    cause: 'dropped_samples' | 'retune' | 'stream_restart' | 'device_reset';
    droppedSamples?: number;
  };
};

export type StrategySwitchEvidence = {
  previousVfoCount: number;
  nextVfoCount: number;
  previousStrategy: 'direct' | 'pfb-decimate';
  nextStrategy: 'direct' | 'pfb-decimate';
  preservedOrder: boolean;
};

export const validateVfoContinuity = (frames: VfoContinuityFrame[]): { ok: boolean; issues: string[] } => {
  const issues: string[] = [];
  if (frames.length < 2) {
    return { ok: true, issues };
  }

  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const next = frames[i];

    if (next.sequence <= prev.sequence) {
      issues.push(`non-monotonic sequence at index ${i}`);
    }

    const expectedSampleIndex = prev.sampleIndex + prev.sampleCount;
    if (next.discontinuity?.cause === 'dropped_samples') {
      const dropped = Math.max(0, next.discontinuity.droppedSamples ?? 0);
      if (next.sampleIndex !== expectedSampleIndex + dropped) {
        issues.push(`dropped-sample discontinuity mismatch at index ${i}`);
      }
      continue;
    }

    if (next.sampleIndex !== expectedSampleIndex) {
      issues.push(`sample continuity mismatch at index ${i}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

export const validateStrategySwitch = (evidence: StrategySwitchEvidence): { ok: boolean; issue: string | null } => {
  const expectedNext = evidence.nextVfoCount >= 3 ? 'pfb-decimate' : 'direct';
  if (evidence.nextStrategy !== expectedNext) {
    return {
      ok: false,
      issue: `expected ${expectedNext} for ${evidence.nextVfoCount} VFOs, got ${evidence.nextStrategy}`
    };
  }

  if (!evidence.preservedOrder) {
    return {
      ok: false,
      issue: 'VFO order changed across strategy switch'
    };
  }

  return {
    ok: true,
    issue: null
  };
};
