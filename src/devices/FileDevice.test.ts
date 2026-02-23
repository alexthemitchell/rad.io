import { describe, expect, it, vi } from 'vitest';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import type { SDRStreamFrame } from './streamFrame';

const collectBytes = (view: DataView): Uint8Array => {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
};

describe('FileDevice', () => {
  it('replays deterministic SigMF chunks across restarts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const fixture = createGoldenToneFixtureBundle();
    const device = new FileDevice(fixture, { chunkSizeBytes: 128 });

    const firstRun: Uint8Array[] = [];
    const firstRunFrames: SDRStreamFrame[] = [];
    await device.open();
    await device.start((chunk, frame) => {
      firstRun.push(collectBytes(chunk));
      if (frame) {
        firstRunFrames.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(4);
    await device.stop();

    const secondRun: Uint8Array[] = [];
    const secondRunFrames: SDRStreamFrame[] = [];
    await device.close();
    await device.open();
    await device.start((chunk, frame) => {
      secondRun.push(collectBytes(chunk));
      if (frame) {
        secondRunFrames.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(4);
    await device.stop();
    await device.close();

    expect(firstRun.length).toBeGreaterThan(0);
    expect(secondRun.length).toBe(firstRun.length);
    expect(firstRunFrames.length).toBe(firstRun.length);
    expect(secondRunFrames.length).toBe(secondRun.length);

    for (let i = 0; i < firstRun.length; i += 1) {
      expect(Array.from(firstRun[i])).toEqual(Array.from(secondRun[i]));

      const frameA = firstRunFrames[i];
      const frameB = secondRunFrames[i];

      expect(frameA.sequence).toBe(i);
      expect(frameB.sequence).toBe(i);

      if (i > 0) {
        expect(frameA.sampleIndex).toBe(firstRunFrames[i - 1].sampleIndex + firstRunFrames[i - 1].sampleCount + frameA.droppedSamples);
      }

      expect(frameA.timestampNs).toBe(Math.floor((frameA.sampleIndex * 1_000_000_000) / frameA.sampleRate));
    }

    expect(firstRunFrames[0].discontinuity?.cause).toBe('restart');
    expect(secondRunFrames[0].discontinuity?.cause).toBe('restart');

    vi.useRealTimers();
  });
});
