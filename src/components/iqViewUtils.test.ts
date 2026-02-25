import { describe, expect, it } from 'vitest';
import { buildIqPairsFromSamples, deriveIqSummary, summarizeIqPairs } from './iqViewUtils';

describe('iqViewUtils', () => {
  it('builds I/Q pairs from interleaved samples', () => {
    const samples = new Float32Array([0.5, -0.5, 0.25, 0.75, -0.1, 0.2]);
    const pairs = buildIqPairsFromSamples(samples, 10);

    expect(pairs).toHaveLength(3);
    expect(pairs[0].i).toBeCloseTo(0.5, 6);
    expect(pairs[0].q).toBeCloseTo(-0.5, 6);
    expect(pairs[1].i).toBeCloseTo(0.25, 6);
    expect(pairs[1].q).toBeCloseTo(0.75, 6);
    expect(pairs[2].i).toBeCloseTo(-0.1, 6);
    expect(pairs[2].q).toBeCloseTo(0.2, 6);
  });

  it('returns fallback point when only one sample exists', () => {
    const samples = new Float32Array([0.42]);
    const pairs = buildIqPairsFromSamples(samples, 8);

    expect(pairs.length).toBe(1);
    expect(pairs[0].i).toBeCloseTo(0.42, 6);
    expect(pairs[0].q).toBeCloseTo(0, 6);
  });

  it('computes summary metrics for common IQ checks', () => {
    const summary = summarizeIqPairs([
      { i: 1, q: 0 },
      { i: 0, q: 1 },
      { i: -1, q: 0 },
      { i: 0, q: -1 }
    ]);

    expect(summary.dcI).toBeCloseTo(0, 6);
    expect(summary.dcQ).toBeCloseTo(0, 6);
    expect(summary.rms).toBeCloseTo(Math.sqrt(0.5), 6);
    expect(summary.clipRatePercent).toBe(100);
    expect(summary.correlation).toBeCloseTo(0, 6);
  });

  it('derives full IQ summary payload', () => {
    const samples = new Float32Array([0.2, 0.3, 0.4, -0.1]);
    const summary = deriveIqSummary(samples, 4);

    expect(summary.points.length).toBe(2);
    expect(summary.rms).toBeGreaterThan(0);
  });
});
