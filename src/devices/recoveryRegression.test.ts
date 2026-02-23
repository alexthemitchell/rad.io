import { describe, expect, it, vi } from 'vitest';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import type { SDRStreamFrame } from './streamFrame';
import { AudioSink } from '../audio/AudioSink';

class MockGainParam {
  value = 1;
  cancelScheduledValues(): void {}
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class MockAudioContext {
  currentTime = 0;
  destination = {};

  constructor() {}

  createGain() {
    return {
      gain: new MockGainParam(),
      connect: () => {}
    };
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return {
      duration: length / sampleRate,
      getChannelData: () => data
    };
  }

  createBufferSource() {
    return {
      buffer: null as unknown,
      connect: () => {},
      start: () => {}
    };
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

const countDropEvents = (frames: SDRStreamFrame[]): { droppedSamples: number; droppedEvents: number } => {
  return frames.reduce(
    (acc, frame) => {
      const isDropEvent = frame.discontinuity?.cause === 'dropped_samples';
      return {
        droppedSamples: acc.droppedSamples + frame.droppedSamples,
        droppedEvents: acc.droppedEvents + (isDropEvent ? 1 : 0)
      };
    },
    { droppedSamples: 0, droppedEvents: 0 }
  );
};

describe('recovery regressions (current architecture)', () => {
  it('increments dropped-sample counters and emits dropped-samples discontinuities under forced scheduling gaps', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const device = new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 1024 });
    const frames: SDRStreamFrame[] = [];

    await device.open();
    await device.start((_chunk, frame) => {
      if (frame) {
        frames.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(25);

    // Simulate event-loop stall by jumping wall-clock ahead before the next tick.
    vi.setSystemTime(new Date(Date.now() + 250));
    await vi.advanceTimersByTimeAsync(2);

    vi.setSystemTime(new Date(Date.now() + 180));
    await vi.advanceTimersByTimeAsync(2);

    await device.stop();
    await device.close();
    vi.useRealTimers();

    const counts = countDropEvents(frames);
    expect(counts.droppedSamples).toBeGreaterThan(0);
    expect(counts.droppedEvents).toBeGreaterThan(0);
  });

  it('preserves frame invariants through induced dropouts and explicit stream restart recovery', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const device = new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 2048 });
    const firstRun: SDRStreamFrame[] = [];

    await device.open();
    await device.start((_chunk, frame) => {
      if (frame) {
        firstRun.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(20);
    vi.setSystemTime(new Date(Date.now() + 320));
    await vi.advanceTimersByTimeAsync(2);
    await device.stop();

    const secondRun: SDRStreamFrame[] = [];
    await device.start((_chunk, frame) => {
      if (frame) {
        secondRun.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(12);
    await device.stop();
    await device.close();
    vi.useRealTimers();

    expect(firstRun.length).toBeGreaterThan(2);
    expect(secondRun.length).toBeGreaterThan(0);
    expect(firstRun.some((frame) => frame.discontinuity?.cause === 'dropped_samples')).toBe(true);
    expect(secondRun[0].discontinuity?.cause).toBe('restart');

    for (let i = 1; i < firstRun.length; i += 1) {
      const previous = firstRun[i - 1];
      const current = firstRun[i];

      expect(current.sequence).toBe(previous.sequence + 1);
      expect(current.sampleIndex).toBe(previous.sampleIndex + previous.sampleCount + current.droppedSamples);
      expect(current.timestampNs).toBeGreaterThan(previous.timestampNs);
    }
  });

  it('tracks audio concealment and pop suppression counters during underrun recovery', async () => {
    vi.useFakeTimers();
    const originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;
    (globalThis as { AudioContext?: unknown }).AudioContext = MockAudioContext;

    const sink = new AudioSink(50_000);
    await sink.start();

    // Initial push schedules cleanly.
    sink.push(new Float32Array(1024));

    // Force an underrun and verify concealment/pop-suppression accounting.
    ((sink as unknown as { ctx?: { currentTime: number } }).ctx as { currentTime: number }).currentTime = 1;
    sink.push(new Float32Array(1024));

    const stats = sink.getStats();
    expect(stats.underruns).toBeGreaterThan(0);
    expect(stats.concealmentEvents).toBeGreaterThan(0);
    expect(stats.popSuppressionEvents).toBeGreaterThan(0);

    sink.stop();
    (globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext;
    vi.useRealTimers();
  });
});
