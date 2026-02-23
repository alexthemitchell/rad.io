import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockDevice } from './MockDevice';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import type { ISDRDevice } from './ISDRDevice';
import type { SDRStreamFrame } from './streamFrame';

const runLongSimulatedSession = async (
  makeDevice: () => ISDRDevice,
  tickAdvanceMs: number
): Promise<SDRStreamFrame[]> => {
  const frames: SDRStreamFrame[] = [];
  const device = makeDevice();

  await device.open();
  await device.start((_chunk, frame) => {
    if (frame) {
      frames.push(frame);
    }
  });

  // Simulate a 3-hour run with one synthetic minute per loop iteration.
  for (let minute = 0; minute < 180; minute += 1) {
    vi.setSystemTime(new Date(Date.now() + 60_000));
    await vi.advanceTimersByTimeAsync(tickAdvanceMs);

    // Mid-run suspend/resume style gap.
    if (minute === 90) {
      vi.setSystemTime(new Date(Date.now() + 20 * 60_000));
      await vi.advanceTimersByTimeAsync(tickAdvanceMs);
    }
  }

  await device.stop();
  await device.close();

  return frames;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('long-run drift regressions', () => {
  it.each([
    ['MockDevice', () => new MockDevice(), 10],
    ['FileDevice', () => new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 2048 }), 2]
  ])('%s preserves monotonic timebase over simulated multi-hour sessions', async (_name, makeDevice, tickAdvanceMs) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const frames = await runLongSimulatedSession(makeDevice, tickAdvanceMs);
    expect(frames.length).toBeGreaterThan(60);

    let sawDroppedDiscontinuity = false;

    for (let i = 1; i < frames.length; i += 1) {
      const previous = frames[i - 1];
      const current = frames[i];

      expect(current.sequence).toBe(previous.sequence + 1);
      expect(current.sampleIndex).toBe(previous.sampleIndex + previous.sampleCount + current.droppedSamples);
      expect(current.timestampNs).toBeGreaterThan(previous.timestampNs);

      const expectedNsFromSampleIndex = Math.floor((current.sampleIndex * 1_000_000_000) / current.sampleRate);
      expect(Math.abs(current.timestampNs - expectedNsFromSampleIndex)).toBeLessThanOrEqual(2_000_000);

      if (current.discontinuity?.cause === 'dropped_samples') {
        sawDroppedDiscontinuity = true;
      }
    }

    expect(sawDroppedDiscontinuity).toBe(true);
  });
});
