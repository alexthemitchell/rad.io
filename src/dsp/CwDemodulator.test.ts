import { describe, expect, it } from 'vitest';
import { CwDemodulator } from './CwDemodulator';

describe('CwDemodulator', () => {
  it('extracts keyed tone envelope', () => {
    const demod = new CwDemodulator();
    demod.setConfig(700, 48_000);

    const len = 4096;
    const iq = new Float32Array(len * 2);
    const audio = new Float32Array(len);

    for (let i = 0; i < len; i += 1) {
      const key = Math.floor(i / 256) % 2 === 0 ? 1 : 0.2;
      const ph = (2 * Math.PI * 700 * i) / 48_000;
      iq[i * 2] = 110 * key * Math.cos(ph);
      iq[(i * 2) + 1] = 110 * key * Math.sin(ph);
    }

    demod.process(iq, audio);
    let rms = 0;
    for (let i = 0; i < audio.length; i += 1) rms += audio[i] * audio[i];
    rms = Math.sqrt(rms / audio.length);
    expect(rms).toBeGreaterThan(0.005);
  });
});
