import { describe, expect, it } from 'vitest';
import { IqCorrection } from './IqCorrection';

describe('IqCorrection', () => {
  it('removes DC offset and balances I/Q gain on interleaved IQ', () => {
    const samples = new Float32Array(2048);

    for (let i = 0; i < samples.length / 2; i += 1) {
      const t = i / 256;
      samples[i * 2] = Math.cos(2 * Math.PI * 0.05 * t) * 0.35 + 0.22;
      samples[i * 2 + 1] = Math.sin(2 * Math.PI * 0.05 * t) * 0.75 - 0.14;
    }

    const correction = new IqCorrection();
    const state = correction.applyInPlace(samples);

    let sumI = 0;
    let sumQ = 0;
    let energyI = 0;
    let energyQ = 0;

    for (let i = 0; i < samples.length / 2; i += 1) {
      const iVal = samples[i * 2];
      const qVal = samples[i * 2 + 1];
      sumI += iVal;
      sumQ += qVal;
      energyI += iVal * iVal;
      energyQ += qVal * qVal;
    }

    const meanI = sumI / (samples.length / 2);
    const meanQ = sumQ / (samples.length / 2);
    const rmsI = Math.sqrt(energyI / (samples.length / 2));
    const rmsQ = Math.sqrt(energyQ / (samples.length / 2));

    expect(Math.abs(meanI)).toBeLessThan(0.02);
    expect(Math.abs(meanQ)).toBeLessThan(0.02);
    expect(Math.abs(rmsI - rmsQ)).toBeLessThan(0.08);
    expect(state.gainI).not.toBe(1);
    expect(state.gainQ).not.toBe(1);
  });

  it('is no-op when disabled', () => {
    const samples = new Float32Array([1, 2, 3, 4]);
    const correction = new IqCorrection();
    correction.setEnabled(false);
    const state = correction.applyInPlace(samples);

    expect(samples).toEqual(new Float32Array([1, 2, 3, 4]));
    expect(state.enabled).toBe(false);
  });
});
