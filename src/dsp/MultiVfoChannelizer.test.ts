import { describe, expect, it } from 'vitest';
import { MultiVfoChannelizer } from './MultiVfoChannelizer';

const createToneIq = (lenComplex: number, toneHz: number, sampleRateHz: number): Int8Array => {
  const out = new Int8Array(lenComplex * 2);
  for (let i = 0; i < lenComplex; i += 1) {
    const ph = (2 * Math.PI * toneHz * i) / sampleRateHz;
    out[i * 2] = Math.round(Math.cos(ph) * 100);
    out[i * 2 + 1] = Math.round(Math.sin(ph) * 100);
  }
  return out;
};

describe('MultiVfoChannelizer', () => {
  it('produces phase-coherent outputs for identical VFO offsets', () => {
    const sr = 2_000_000;
    const channelizer = new MultiVfoChannelizer(sr);
    channelizer.setVfos([
      { id: 'a', offsetHz: 25_000 },
      { id: 'b', offsetHz: 25_000 }
    ]);

    const input = createToneIq(2048, 40_000, sr);
    const [a, b] = channelizer.process(input);

    expect(a.iq.length).toBe(b.iq.length);
    let maxDiff = 0;
    for (let i = 0; i < a.iq.length; i += 1) {
      maxDiff = Math.max(maxDiff, Math.abs(a.iq[i] - b.iq[i]));
    }
    expect(maxDiff).toBeLessThan(1e-6);
  });

  it('reports deterministic zero group delay across VFO outputs', () => {
    const sr = 1_000_000;
    const channelizer = new MultiVfoChannelizer(sr);
    channelizer.setVfos([
      { id: 'main', offsetHz: 0 },
      { id: 'sub', offsetHz: -12_500 }
    ]);

    const input = createToneIq(1024, 10_000, sr);
    const frames = channelizer.process(input);

    expect(frames).toHaveLength(2);
    expect(frames[0].groupDelaySamples).toBe(0);
    expect(frames[1].groupDelaySamples).toBe(0);
  });

  it('deduplicates VFO ids and clamps offsets to safe range', () => {
    const sr = 1_000_000;
    const channelizer = new MultiVfoChannelizer(sr);
    channelizer.setVfos([
      { id: 'main', offsetHz: 700_000 },
      { id: 'main', offsetHz: -700_000 },
      { id: 'aux', offsetHz: -900_000 }
    ]);

    const vfos = channelizer.getVfos();
    expect(vfos).toHaveLength(2);
    expect(vfos[0].id).toBe('main');
    expect(vfos[0].offsetHz).toBe(450_000);
    expect(vfos[1].offsetHz).toBe(-450_000);
  });
});
