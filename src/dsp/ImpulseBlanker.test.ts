import { describe, expect, it } from 'vitest';
import { ImpulseBlanker } from './ImpulseBlanker';

describe('ImpulseBlanker', () => {
  it('zeros short impulse spikes when enabled', () => {
    const blanker = new ImpulseBlanker();
    blanker.setEnabled(true);

    const samples = new Float32Array(1024).fill(0.02);
    samples[100] = 1.0;
    samples[700] = -0.9;

    const state = blanker.applyInPlace(samples);

    expect(samples[100]).toBe(0);
    expect(samples[700]).toBe(0);
    expect(state.blankedSamples).toBeGreaterThanOrEqual(2);
    expect(state.blankingRatio).toBeGreaterThan(0);
  });

  it('no-ops when disabled', () => {
    const blanker = new ImpulseBlanker();
    const samples = new Float32Array([0.1, 0.9, 0.1]);

    const state = blanker.applyInPlace(samples);

    expect(samples[1]).toBeCloseTo(0.9, 6);
    expect(state.blankedSamples).toBe(0);
  });
});
