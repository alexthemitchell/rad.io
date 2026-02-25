import { describe, expect, it } from 'vitest';
import { computeFrequencyErrorPpm, evaluateRetuneAccuracyWindow, evaluateTuningAccuracyCase } from './tuningAccuracy';

describe('tuningAccuracy', () => {
  it('computes ppm error from requested/observed frequencies', () => {
    const ppm = computeFrequencyErrorPpm(100_000_000, 100_000_120);
    expect(ppm).toBeCloseTo(1.2, 6);
  });

  it('passes a tuning case within absolute+ppm tolerance', () => {
    const result = evaluateTuningAccuracyCase({
      requestedFrequencyHz: 162_550_000,
      observedFrequencyHz: 162_550_085,
      ppmTolerance: 1,
      absoluteToleranceHz: 120,
      afcEnabled: false
    });

    expect(result.passed).toBe(true);
    expect(Math.abs(result.errorHz)).toBeLessThanOrEqual(result.toleranceHz);
  });

  it('evaluates retune windows and reports worst-case error', () => {
    const report = evaluateRetuneAccuracyWindow([
      {
        requestedFrequencyHz: 98_100_000,
        observedFrequencyHz: 98_100_090,
        ppmTolerance: 1.5,
        absoluteToleranceHz: 160,
        afcEnabled: false
      },
      {
        requestedFrequencyHz: 100_700_000,
        observedFrequencyHz: 100_700_260,
        ppmTolerance: 1.5,
        absoluteToleranceHz: 160,
        afcEnabled: false
      },
      {
        requestedFrequencyHz: 162_550_000,
        observedFrequencyHz: 162_550_110,
        ppmTolerance: 1.5,
        absoluteToleranceHz: 160,
        afcEnabled: true
      }
    ]);

    expect(report.total).toBe(3);
    expect(report.failures).toBe(1);
    expect(report.passed).toBe(false);
    expect(Math.abs(report.worstErrorHz)).toBeGreaterThan(200);
  });
});
