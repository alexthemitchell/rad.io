import { describe, expect, it } from 'vitest';
import { magnitudeSquaredToDbfs } from './fftScaling';

describe('magnitudeSquaredToDbfs', () => {
  it('maps coherent full-scale complex tone to approximately 0 dBFS', () => {
    const fftSize = 2048;
    const coherentToneMagnitude = fftSize;
    const dbfs = magnitudeSquaredToDbfs(coherentToneMagnitude * coherentToneMagnitude, fftSize);
    expect(dbfs).toBeCloseTo(0, 6);
  });

  it('tracks fractional tone amplitudes in dBFS', () => {
    const fftSize = 2048;
    const amplitude = 0.25;
    const coherentToneMagnitude = fftSize * amplitude;
    const dbfs = magnitudeSquaredToDbfs(coherentToneMagnitude * coherentToneMagnitude, fftSize);
    expect(dbfs).toBeCloseTo(20 * Math.log10(amplitude), 6);
  });

  it('returns a finite floor for very small magnitudes', () => {
    const dbfs = magnitudeSquaredToDbfs(0, 2048);
    expect(Number.isFinite(dbfs)).toBe(true);
    expect(dbfs).toBeLessThan(-200);
  });
});
