import { describe, expect, it } from 'vitest';
import { ToneDecoder } from './ToneDecoder';

describe('ToneDecoder', () => {
  it('detects dominant ctcss tone from synthetic NFM-style audio', () => {
    const sampleRateHz = 50_000;
    const samples = new Float32Array(4096);
    const toneHz = 127.3;

    for (let i = 0; i < samples.length; i += 1) {
      const t = i / sampleRateHz;
      samples[i] = Math.sin(2 * Math.PI * toneHz * t) * 0.3;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decodeCtcss(samples, sampleRateHz);

    expect(state.active).toBe(true);
    expect(state.ctcssHz).toBeCloseTo(127.3, 1);
    expect(state.confidence).toBeGreaterThan(0.1);
  });

  it('stays inactive for broadband noise-like input', () => {
    const sampleRateHz = 50_000;
    const samples = new Float32Array(4096);

    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = ((i * 17) % 23 - 11) / 23;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decodeCtcss(samples, sampleRateHz);

    expect(state.active).toBe(false);
    expect(state.ctcssHz).toBeNull();
  });
});
