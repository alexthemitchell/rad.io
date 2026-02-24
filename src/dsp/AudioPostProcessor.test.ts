import { describe, expect, it } from 'vitest';
import { AudioPostProcessor, applyInterferencePreset, type FilterConfig } from './AudioPostProcessor';

const goertzelPower = (signal: Float32Array, sampleRateHz: number, targetHz: number) => {
  const omega = (2 * Math.PI * targetHz) / sampleRateHz;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < signal.length; i += 1) {
    q0 = coeff * q1 - q2 + signal[i];
    q2 = q1;
    q1 = q0;
  }

  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  return real * real + imag * imag;
};

const createSignal = (sampleRateHz: number, len: number) => {
  const out = new Float32Array(len);

  for (let i = 0; i < len; i += 1) {
    const t = i / sampleRateHz;
    const hum = Math.sin(2 * Math.PI * 60 * t) * 0.7;
    const tone = Math.sin(2 * Math.PI * 1_000 * t) * 0.5;
    out[i] = hum + tone;
  }

  return out;
};

describe('AudioPostProcessor', () => {
  const baseConfig: FilterConfig = {
    profile: 'sharp',
    lowCutHz: 0,
    highCutHz: 12_000,
    sampleRateHz: 50_000,
    notchHz: null,
    notchQ: 10
  };

  it('hum-notch preset reduces 60 Hz energy', () => {
    const source = createSignal(50_000, 50_000);
    const baseline = source.slice();
    const processed = source.slice();

    const processor = new AudioPostProcessor(baseConfig);
    processor.setConfig(applyInterferencePreset(baseConfig, 'hum-notch'));
    processor.processInPlace(processed);

    const baselineHum = goertzelPower(baseline, 50_000, 60);
    const processedHum = goertzelPower(processed, 50_000, 60);

    expect(processedHum).toBeLessThan(baselineHum * 0.4);
  });

  it('dc-spike preset enforces high-pass style low-cut floor', () => {
    const config = applyInterferencePreset(baseConfig, 'dc-spike-reduction');

    expect(config.lowCutHz).toBeGreaterThanOrEqual(120);
    expect(config.notchHz).toBeNull();
  });
});
