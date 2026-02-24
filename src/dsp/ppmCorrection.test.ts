import { describe, expect, it } from 'vitest';
import { computePpmCorrectionHz } from './ppmCorrection';

describe('computePpmCorrectionHz', () => {
  it('returns opposite-sign correction proportional to tuned frequency', () => {
    expect(computePpmCorrectionHz(100_000_000, 10)).toBeCloseTo(-1000, 6);
    expect(computePpmCorrectionHz(100_000_000, -10)).toBeCloseTo(1000, 6);
  });

  it('returns zero for invalid input', () => {
    expect(computePpmCorrectionHz(Number.NaN, 10)).toBe(0);
    expect(computePpmCorrectionHz(100_000_000, Number.NaN)).toBe(0);
  });
});
