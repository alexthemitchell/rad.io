import { describe, expect, it } from 'vitest';
import { assessTimebaseDriftTelemetry } from './timebaseDriftTelemetry';

describe('assessTimebaseDriftTelemetry', () => {
  it('reports stable telemetry when ratios and jitter are bounded', () => {
    const result = assessTimebaseDriftTelemetry({
      streamSampleRateHz: 2_000_000,
      driftEstimateHzPerSec: 0.25,
      driftConfidence: 0.7,
      phaseErrorRms: 0.08,
      audioResamplerRatio: 1.000015,
      audioResamplerRatioDeltaPpm: 22,
      audioQueueJitterMs: 3,
      clockTruthMode: 'disciplined_ref'
    });

    expect(result.stable).toBe(true);
    expect(result.severity).toBe('ok');
    expect(result.summary).toContain('Timebase stable');
  });

  it('flags drift risk with high ratio error and queue jitter', () => {
    const result = assessTimebaseDriftTelemetry({
      streamSampleRateHz: 2_000_000,
      driftEstimateHzPerSec: 6,
      driftConfidence: 0.9,
      phaseErrorRms: 0.52,
      audioResamplerRatio: 1.00035,
      audioResamplerRatioDeltaPpm: 320,
      audioQueueJitterMs: 16,
      clockTruthMode: 'corrected_ppm'
    });

    expect(result.stable).toBe(false);
    expect(result.severity).toBe('warn');
    expect(result.summary).toContain('drift risk');
    expect(result.recommendations.join(' ')).toContain('Stable latency policy');
  });
});
