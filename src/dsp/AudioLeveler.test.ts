import { describe, expect, it } from 'vitest';
import { AudioLeveler } from './AudioLeveler';

describe('AudioLeveler', () => {
  it('does nothing when disabled', () => {
    const leveler = new AudioLeveler();
    const samples = new Float32Array([0.1, -0.1, 0.1, -0.1]);
    const before = Array.from(samples);

    const state = leveler.applyInPlace(samples, 20);

    expect(state.enabled).toBe(false);
    expect(Array.from(samples)).toEqual(before);
  });

  it('reduces gain for loud input and increases for quiet input', () => {
    const leveler = new AudioLeveler();
    leveler.setEnabled(true);

    const loud = new Float32Array(1024).fill(0.9);
    let state = leveler.applyInPlace(loud, 20);
    expect(state.gainLinear).toBeLessThan(1);

    const quiet = new Float32Array(1024).fill(0.03);
    for (let i = 0; i < 15; i += 1) {
      state = leveler.applyInPlace(quiet, 20);
    }

    expect(state.gainLinear).toBeGreaterThan(0.5);
  });
});
