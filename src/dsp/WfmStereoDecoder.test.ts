import { describe, expect, it } from 'vitest';
import { WfmStereoDecoder } from './WfmStereoDecoder';

describe('WfmStereoDecoder', () => {
  it('detects pilot lock on composite-like signal', () => {
    const sr = 50_000;
    const samples = new Float32Array(4096);

    for (let i = 0; i < samples.length; i += 1) {
      const t = i / sr;
      const mono = Math.sin(2 * Math.PI * 1_000 * t) * 0.25;
      const pilot = Math.sin(2 * Math.PI * 19_000 * t) * 0.1;
      const stereo = Math.sin(2 * Math.PI * 38_000 * t) * 0.08;
      samples[i] = mono + pilot + stereo;
    }

    const decoder = new WfmStereoDecoder();
    const state = decoder.process(samples, sr);

    expect(state.locked).toBe(true);
    expect(state.pilotLevel).toBeGreaterThan(0.08);
  });
});
