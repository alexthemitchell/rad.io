import { describe, expect, it } from 'vitest';
import { assessSampleRateMismatchStrategy } from './sampleRateMismatchStrategy';

describe('assessSampleRateMismatchStrategy', () => {
  it('reports stable behavior for small output-rate mismatch', () => {
    const result = assessSampleRateMismatchStrategy({
      deviceIqSampleRateHz: 2_000_000,
      dspInputSampleRateHz: 2_000_000,
      dspOutputSampleRateHz: 50_000,
      audioResamplerRatio: 0.99998,
      audioResamplerRatioDeltaPpm: 35
    });

    expect(result.severity).toBe('ok');
    expect(result.mismatchPpm).toBeLessThan(120);
    expect(result.summary).toContain('Audio output estimate');
  });

  it('warns when ratio drift implies forced-output mismatch stress', () => {
    const result = assessSampleRateMismatchStrategy({
      deviceIqSampleRateHz: 2_400_000,
      dspInputSampleRateHz: 2_400_000,
      dspOutputSampleRateHz: 50_000,
      audioResamplerRatio: 0.9988,
      audioResamplerRatioDeltaPpm: 280
    });

    expect(result.severity).toBe('warn');
    expect(result.mismatchPpm).toBeGreaterThan(120);
    expect(result.recommendations.join(' ')).toContain('Stable latency policy');
  });
});
