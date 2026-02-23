import { describe, expect, it, vi } from 'vitest';
import { FileDevice } from '../devices/FileDevice';
import type { SDRStreamFrame } from '../devices/streamFrame';
import { createKnownSignalFixtureLibrary } from '../fixtures/sigmf/knownSignalFixtureLibrary';
import { NfmDemodulator } from './NfmDemodulator';

const toInt8 = (chunk: DataView): Int8Array => {
  const src = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  const out = new Int8Array(src.length);

  for (let i = 0; i < src.length; i += 1) {
    out[i] = src[i] - 128;
  }

  return out;
};

const dominantToneHz = (signal: Float32Array, sampleRateHz: number, minHz: number, maxHz: number, stepHz: number): number => {
  let bestHz = minHz;
  let bestPower = -Infinity;

  for (let hz = minHz; hz <= maxHz; hz += stepHz) {
    const omega = (2 * Math.PI * hz) / sampleRateHz;
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
    const power = real * real + imag * imag;

    if (power > bestPower) {
      bestPower = power;
      bestHz = hz;
    }
  }

  return bestHz;
};

describe('end-to-end deterministic accuracy over retunes and long runs', () => {
  it('keeps NFM tone and stream invariants stable through long-run retune churn', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const fixture = createKnownSignalFixtureLibrary()['nfm-tone-ci8-v1'];
    const device = new FileDevice(fixture, { chunkSizeBytes: 1024 });
    const demod = new NfmDemodulator();

    const frames: SDRStreamFrame[] = [];
    const measuredToneHz: number[] = [];
    const audioRms: number[] = [];

    await device.open();

    await device.start((chunk, frame) => {
      if (frame) {
        frames.push(frame);
      }

      const iq = toInt8(chunk);
      const audio = new Float32Array(iq.length / 2);
      demod.process(iq, audio);

      const toneHz = dominantToneHz(audio, fixture.metadata.sampleRateHz, 900, 1_100, 5);
      measuredToneHz.push(toneHz);

      let sumSq = 0;
      for (let i = 0; i < audio.length; i += 1) {
        sumSq += audio[i] * audio[i];
      }
      audioRms.push(Math.sqrt(sumSq / Math.max(1, audio.length)));
    });

    for (let i = 0; i < 60; i += 1) {
      await vi.advanceTimersByTimeAsync(12);

      if (i > 0 && i % 10 === 0) {
        await device.setFrequency(99_000_000 + i * 10_000);
      }

      if (i > 0 && i % 15 === 0) {
        vi.setSystemTime(new Date(Date.now() + 220));
        await vi.advanceTimersByTimeAsync(2);
      }
    }

    await device.stop();
    await device.close();
    vi.useRealTimers();

    expect(frames.length).toBeGreaterThan(20);
    expect(measuredToneHz.length).toBe(frames.length);

    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i].sequence).toBe(frames[i - 1].sequence + 1);
      expect(frames[i].sampleIndex).toBe(frames[i - 1].sampleIndex + frames[i - 1].sampleCount + frames[i].droppedSamples);
      expect(frames[i].timestampNs).toBeGreaterThan(frames[i - 1].timestampNs);
    }

    const retuneDiscontinuities = frames.filter((frame) => frame.discontinuity?.cause === 'retune');
    const droppedDiscontinuities = frames.filter((frame) => frame.discontinuity?.cause === 'dropped_samples');
    expect(retuneDiscontinuities.length).toBeGreaterThan(0);
    expect(droppedDiscontinuities.length).toBeGreaterThan(0);

    const meanTone = measuredToneHz.reduce((acc, hz) => acc + hz, 0) / measuredToneHz.length;
    const maxToneError = measuredToneHz.reduce((max, hz) => Math.max(max, Math.abs(hz - 1_000)), 0);
    expect(meanTone).toBeGreaterThanOrEqual(980);
    expect(meanTone).toBeLessThanOrEqual(1_020);
    expect(maxToneError).toBeLessThanOrEqual(80);

    const meanRms = audioRms.reduce((acc, value) => acc + value, 0) / audioRms.length;
    const maxRmsDrift = audioRms.reduce((max, value) => Math.max(max, Math.abs(value - meanRms)), 0);
    expect(meanRms).toBeGreaterThan(0.03);
    expect(maxRmsDrift).toBeLessThan(meanRms * 0.45);
  });
});
