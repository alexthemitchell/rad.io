import { describe, expect, it } from 'vitest';
import { AmDemodulator } from './AmDemodulator';
import { NfmDemodulator } from './NfmDemodulator';
import { WfmDemodulator } from './WfmDemodulator';
import { createKnownSignalFixtureLibrary, type KnownSignalFixtureId } from '../fixtures/sigmf/knownSignalFixtureLibrary';

const toInt8Iq = (ci8: Uint8Array): Int8Array => {
  const output = new Int8Array(ci8.length);

  for (let i = 0; i < ci8.length; i += 1) {
    output[i] = ci8[i] - 128;
  }

  return output;
};

const demodFixture = (
  fixtureId: KnownSignalFixtureId,
  demod: { process: (input: Int8Array, output: Float32Array) => void }
): { audio: Float32Array; sampleRateHz: number } => {
  const fixture = createKnownSignalFixtureLibrary()[fixtureId];
  const iq = toInt8Iq(fixture.iqData);
  const audio = new Float32Array(iq.length / 2);

  demod.process(iq, audio);

  return {
    audio,
    sampleRateHz: fixture.metadata.sampleRateHz
  };
};

const goertzelPower = (
  signal: Float32Array,
  sampleRateHz: number,
  frequencyHz: number,
  startSample = 0,
  endSample = signal.length
): number => {
  const start = Math.max(0, startSample);
  const end = Math.min(signal.length, endSample);
  const length = Math.max(1, end - start);
  const omega = (2 * Math.PI * frequencyHz) / sampleRateHz;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = start; i < end; i += 1) {
    q0 = coeff * q1 - q2 + signal[i];
    q2 = q1;
    q1 = q0;
  }

  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  return (real * real + imag * imag) / length;
};

const dominantToneInBand = (
  signal: Float32Array,
  sampleRateHz: number,
  minHz: number,
  maxHz: number,
  stepHz: number,
  startSample = 0,
  endSample = signal.length
): { frequencyHz: number; power: number } => {
  let bestFrequencyHz = minHz;
  let bestPower = -Infinity;

  for (let frequencyHz = minHz; frequencyHz <= maxHz; frequencyHz += stepHz) {
    const power = goertzelPower(signal, sampleRateHz, frequencyHz, startSample, endSample);
    if (power > bestPower) {
      bestPower = power;
      bestFrequencyHz = frequencyHz;
    }
  }

  return {
    frequencyHz: bestFrequencyHz,
    power: bestPower
  };
};

const maxAbsInWindow = (signal: Float32Array, start: number, end: number): number => {
  let max = 0;
  for (let i = Math.max(0, start); i < Math.min(signal.length, end); i += 1) {
    max = Math.max(max, Math.abs(signal[i]));
  }
  return max;
};

describe('Golden demod outputs from deterministic fixtures', () => {
  it('WFM pilot fixture demodulates with strong 19 kHz tone energy', () => {
    const result = demodFixture('fm-pilot-ci8-v1', new WfmDemodulator());
    const start = 128;

    const aroundPilot = dominantToneInBand(result.audio, result.sampleRateHz, 18_700, 19_300, 5, start);
    const offBand = dominantToneInBand(result.audio, result.sampleRateHz, 15_000, 16_000, 10, start);

    expect(aroundPilot.frequencyHz).toBeGreaterThanOrEqual(18_900);
    expect(aroundPilot.frequencyHz).toBeLessThanOrEqual(19_100);
    expect(aroundPilot.power).toBeGreaterThan(offBand.power * 3);
  });

  it('AM carrier fixture demodulates with 1 kHz envelope tone', () => {
    const result = demodFixture('am-carrier-ci8-v1', new AmDemodulator());
    const start = 256;

    const target = dominantToneInBand(result.audio, result.sampleRateHz, 900, 1_100, 5, start);
    const low = dominantToneInBand(result.audio, result.sampleRateHz, 200, 400, 5, start);

    expect(target.frequencyHz).toBeGreaterThanOrEqual(960);
    expect(target.frequencyHz).toBeLessThanOrEqual(1_040);
    expect(target.power).toBeGreaterThan(low.power * 2.5);
  });

  it('NFM tone fixture demodulates with stable 1 kHz audio tone', () => {
    const result = demodFixture('nfm-tone-ci8-v1', new NfmDemodulator());
    const start = 256;

    const target = dominantToneInBand(result.audio, result.sampleRateHz, 900, 1_100, 5, start);
    const offTone = dominantToneInBand(result.audio, result.sampleRateHz, 1_800, 2_200, 5, start);

    expect(target.frequencyHz).toBeGreaterThanOrEqual(960);
    expect(target.frequencyHz).toBeLessThanOrEqual(1_040);
    expect(target.power).toBeGreaterThan(offTone.power * 2);
  });
});

describe('Interference fixtures against demod paths', () => {
  it('DC spike fixture shows larger transient than clean tone baseline under WFM demod', () => {
    const clean = demodFixture('clean-tone-noise-ci8-v1', new WfmDemodulator());
    const dcSpike = demodFixture('dc-spike-ci8-v1', new WfmDemodulator());

    const cleanPeak = maxAbsInWindow(clean.audio, 1380, 1430);
    const spikePeak = maxAbsInWindow(dcSpike.audio, 1380, 1430);

    expect(spikePeak).toBeGreaterThan(cleanPeak * 1.4);
  });

  it('mains hum fixture demodulates to a dominant 60 Hz component in AM path', () => {
    const result = demodFixture('mains-hum-ci8-v1', new AmDemodulator());
    const start = 256;

    const hum = dominantToneInBand(result.audio, result.sampleRateHz, 45, 75, 1, start);
    const overtone = dominantToneInBand(result.audio, result.sampleRateHz, 110, 140, 1, start);

    expect(hum.frequencyHz).toBeGreaterThanOrEqual(56);
    expect(hum.frequencyHz).toBeLessThanOrEqual(64);
    expect(hum.power).toBeGreaterThan(overtone.power * 1.5);
  });

  it('heterodyne fixture produces deterministic beat tone in AM demod output', () => {
    const result = demodFixture('heterodyne-ci8-v1', new AmDemodulator());
    const start = 256;

    const beat = dominantToneInBand(result.audio, result.sampleRateHz, 780, 920, 2, start);
    const nearby = dominantToneInBand(result.audio, result.sampleRateHz, 500, 680, 2, start);

    expect(beat.frequencyHz).toBeGreaterThanOrEqual(820);
    expect(beat.frequencyHz).toBeLessThanOrEqual(880);
    expect(beat.power).toBeGreaterThan(nearby.power * 1.5);
  });

  it('impulsive-noise fixture produces stronger transients than clean baseline under NFM demod', () => {
    const clean = demodFixture('clean-tone-noise-ci8-v1', new NfmDemodulator());
    const impulsive = demodFixture('impulsive-noise-ci8-v1', new NfmDemodulator());

    const cleanPeak = maxAbsInWindow(clean.audio, 0, clean.audio.length);
    const impulsivePeak = maxAbsInWindow(impulsive.audio, 0, impulsive.audio.length);

    expect(impulsivePeak).toBeGreaterThan(cleanPeak * 1.2);
  });
});
