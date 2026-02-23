import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISDRDevice, SDRDataCallback } from './ISDRDevice';
import type { SDRStreamFrame } from './streamFrame';
import { MockDevice } from './MockDevice';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';

const makeSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const assertFrameInvariants = (frames: SDRStreamFrame[]): void => {
  expect(frames.length).toBeGreaterThan(0);

  const baseSequence = frames[0].sequence;

  for (let i = 0; i < frames.length; i += 1) {
    const current = frames[i];

    expect(current.sequence).toBe(baseSequence + i);
    expect(current.sampleIndex).toBeGreaterThanOrEqual(0);
    expect(current.sampleCount).toBeGreaterThan(0);
    expect(current.droppedSamples).toBeGreaterThanOrEqual(0);
    expect(current.timestampNs).toBeGreaterThanOrEqual(0);
    expect(current.sampleClock?.truthMode).toBe('unknown');

    if (current.discontinuity) {
      expect(current.discontinuity.sequence).toBe(current.sequence);
      expect(current.discontinuity.sampleIndex).toBe(current.sampleIndex);

      if (current.discontinuity.cause === 'dropped_samples') {
        expect(current.droppedSamples).toBeGreaterThan(0);
      }
    }

    if (i === 0) {
      continue;
    }

    const previous = frames[i - 1];
    expect(current.sequence).toBe(previous.sequence + 1);
    expect(current.sampleIndex).toBe(previous.sampleIndex + previous.sampleCount + current.droppedSamples);
    expect(current.timestampNs).toBeGreaterThan(previous.timestampNs);

    if (current.droppedSamples > 0) {
      expect(current.discontinuity).toBeDefined();
    }
  }
};

const runRandomizedSequence = async (seed: number, makeDevice: () => ISDRDevice): Promise<SDRStreamFrame[]> => {
  const random = makeSeededRandom(seed);
  const sampleRates = [250_000, 500_000, 1_000_000, 2_000_000, 2_400_000];
  const frames: SDRStreamFrame[] = [];

  const onData: SDRDataCallback = (_data, frame) => {
    if (frame) {
      frames.push(frame);
    }
  };

  const device = makeDevice();
  await device.open();

  let isStreaming = false;
  for (let i = 0; i < 120; i += 1) {
    const op = random();

    if (!isStreaming) {
      if (op < 0.45) {
        await device.start(onData);
        isStreaming = true;
      } else if (op < 0.7) {
        const nextRate = sampleRates[Math.floor(random() * sampleRates.length)];
        await device.setSampleRate(nextRate);
      } else {
        const nextFreq = 88_000_000 + Math.floor(random() * 20_000_000);
        await device.setFrequency(nextFreq);
      }
    } else if (op < 0.25) {
      await device.stop();
      isStreaming = false;
    } else if (op < 0.5) {
      const nextFreq = 88_000_000 + Math.floor(random() * 20_000_000);
      await device.setFrequency(nextFreq);
    } else if (op < 0.75) {
      const nextRate = sampleRates[Math.floor(random() * sampleRates.length)];
      await device.setSampleRate(nextRate);
    }

    const advanceMs = 1 + Math.floor(random() * 24);
    await vi.advanceTimersByTimeAsync(advanceMs);
  }

  if (isStreaming) {
    await device.stop();
  }

  await vi.advanceTimersByTimeAsync(10);
  await device.close();

  return frames;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('stream frame randomized invariants', () => {
  it.each([
    ['MockDevice', 0x23f00d11, () => new MockDevice()],
    ['FileDevice', 0x23f00d12, () => new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 512 })]
  ])('%s preserves frame contracts under randomized start/stop/retune/rate changes (seed=%s)', async (_name, seed, makeDevice) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const frames = await runRandomizedSequence(seed, makeDevice);

    assertFrameInvariants(frames);
    expect(frames.some((frame) => frame.discontinuity?.cause === 'restart')).toBe(true);
    expect(frames.some((frame) => frame.discontinuity?.cause === 'retune' || frame.discontinuity?.cause === 'sample_rate_change')).toBe(true);
  });
});
