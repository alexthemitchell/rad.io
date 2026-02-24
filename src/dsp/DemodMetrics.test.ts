import { describe, expect, it } from 'vitest';
import { evaluateDemodQuality } from './DemodMetrics';

const sine = (frequencyHz: number, sampleRateHz: number, len: number, amplitude: number) => {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRateHz) * amplitude;
  }
  return out;
};

describe('evaluateDemodQuality', () => {
  it('reports WFM lock for strong tone-like content', () => {
    const metrics = evaluateDemodQuality('WFM', sine(1_000, 50_000, 4_096, 0.8));

    expect(metrics.lockState).toBe('locked');
    expect(metrics.quality).toBeGreaterThan(0.7);
    expect(metrics.pilotLevel).toBeGreaterThan(0.4);
  });

  it('reports AM searching for near-silent content', () => {
    const metrics = evaluateDemodQuality('AM', new Float32Array(4_096));

    expect(metrics.lockState).toBe('searching');
    expect(metrics.carrierLevel).toBeLessThan(0.2);
  });

  it('reports NFM degraded state for weak content', () => {
    const metrics = evaluateDemodQuality('NFM', sine(1_000, 50_000, 4_096, 0.06));

    expect(metrics.lockState === 'degraded' || metrics.lockState === 'searching').toBe(true);
    expect(metrics.quality).toBeLessThan(0.75);
  });
});
