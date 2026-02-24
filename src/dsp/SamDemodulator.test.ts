import { describe, expect, it } from 'vitest';
import { SamDemodulator } from './SamDemodulator';

describe('SamDemodulator', () => {
  it('demodulates AM-like carrier into non-zero audio', () => {
    const demod = new SamDemodulator();
    const len = 4096;
    const iq = new Float32Array(len * 2);
    const audio = new Float32Array(len);

    for (let i = 0; i < len; i += 1) {
      const m = 1 + 0.35 * Math.sin((2 * Math.PI * 1000 * i) / 48_000);
      const ph = (2 * Math.PI * 7000 * i) / 48_000;
      iq[i * 2] = 128 * m * Math.cos(ph);
      iq[(i * 2) + 1] = 128 * m * Math.sin(ph);
    }

    demod.process(iq, audio);
    let rms = 0;
    for (let i = 0; i < audio.length; i += 1) rms += audio[i] * audio[i];
    rms = Math.sqrt(rms / audio.length);
    expect(rms).toBeGreaterThan(0.01);
  });
});
