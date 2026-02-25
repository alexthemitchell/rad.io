import { describe, expect, it } from 'vitest';
import { buildVfoRuntimeMetrics, computeVfoQuality01, normalizeVfoAudioRoute, routeVfoAudio } from './multiVfoCore';
import type { VfoFrame } from './MultiVfoChannelizer';

describe('multiVfoCore', () => {
  it('normalizes aux routing when aux VFO is unavailable', () => {
    expect(normalizeVfoAudioRoute('aux', false)).toBe('main');
    expect(normalizeVfoAudioRoute('aux', true)).toBe('aux');
    expect(normalizeVfoAudioRoute('invalid', true)).toBe('main');
  });

  it('routes and mixes per-VFO audio deterministically', () => {
    const main = new Float32Array([1, 0.5, -0.5]);
    const aux = new Float32Array([0.25, -0.25, 0.25]);

    expect(Array.from(routeVfoAudio('main', main, aux))).toEqual([1, 0.5, -0.5]);
    expect(Array.from(routeVfoAudio('aux', main, aux))).toEqual([0.25, -0.25, 0.25]);
    expect(Array.from(routeVfoAudio('mix', main, aux))).toEqual([0.625, 0.125, -0.125]);
    expect(routeVfoAudio('mute', main, aux)).toHaveLength(0);
  });

  it('computes stable quality and per-VFO runtime metrics', () => {
    const strongIq = new Float32Array([1, 1, 1, 1, 1, 1]);
    const noisyIq = new Float32Array([1, -1, 1, -1, 1, -1]);
    expect(computeVfoQuality01(strongIq)).toBeGreaterThan(computeVfoQuality01(noisyIq));

    const frames: VfoFrame[] = [
      { id: 'main', iq: strongIq, groupDelaySamples: 0, strategy: 'direct' },
      { id: 'aux', iq: noisyIq, groupDelaySamples: 15, strategy: 'pfb-decimate' }
    ];

    const metrics = buildVfoRuntimeMetrics(frames, new Map<string, number>([
      ['main', 0],
      ['aux', 12_500]
    ]), 8);

    expect(metrics).toHaveLength(2);
    expect(metrics[0].cpuMs).toBeCloseTo(4, 5);
    expect(metrics[1].offsetHz).toBe(12_500);
    expect(metrics[1].strategy).toBe('pfb-decimate');
  });
});
