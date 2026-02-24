import { describe, expect, it } from 'vitest';
import { PolyphaseResampler } from './PolyphaseResampler';

describe('PolyphaseResampler', () => {
  it('increases sample count when ratio > 1', () => {
    const r = new PolyphaseResampler();
    const input = new Float32Array(100).fill(0.5);
    const out = r.process(input, 1.2);

    expect(out.length).toBeGreaterThan(100);
  });

  it('decreases sample count when ratio < 1', () => {
    const r = new PolyphaseResampler();
    const input = new Float32Array(100).fill(0.5);
    const out = r.process(input, 0.8);

    expect(out.length).toBeLessThan(100);
    expect(out.length).toBeGreaterThan(0);
  });
});
