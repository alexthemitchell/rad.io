import { afterEach, describe, expect, it, vi } from 'vitest';
import { RtlSdrDevice } from './RtlSdrDevice';
import type { SDRStreamFrame } from './streamFrame';

afterEach(() => {
  vi.useRealTimers();
});

describe('RtlSdrDevice', () => {
  it('enforces direct-sampling HF frequency bounds', async () => {
    const device = new RtlSdrDevice();

    await device.open();
    await device.setFrequency(14_200_000);
    await device.setDirectSamplingMode('q-branch');

    await expect(device.setFrequency(88_100_000)).rejects.toThrow(/HF tuning only/);
    await device.setDirectSamplingMode('off');
    await expect(device.setFrequency(88_100_000)).resolves.toBeUndefined();

    await device.close();
  });

  it('reports direct-sampling mode in debug snapshot and capability model', async () => {
    const device = new RtlSdrDevice();

    expect(device.getCapabilityModel().sampleFormat.sampleType).toBe('u8');

    await device.open();
    await device.setFrequency(7_100_000);
    await device.setDirectSamplingMode('i-branch');

    const snapshot = device.getDebugSnapshot?.();
    expect(snapshot?.driver).toBe('RtlSdrDevice');
    expect(snapshot?.recentTrace?.[0]?.detail).toBe('i-branch');

    await device.close();
  });

  it('streams frames with restart/retune/sample-rate discontinuities and stable sequence math', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T00:00:00.000Z'));

    const device = new RtlSdrDevice();
    const frames: SDRStreamFrame[] = [];

    await device.open();
    await device.start((_data, frame) => {
      if (frame) {
        frames.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(30);
    await device.setFrequency(100_900_000);
    await vi.advanceTimersByTimeAsync(20);
    await device.setSampleRate(1_024_000);
    await vi.advanceTimersByTimeAsync(30);
    await device.stop();
    await device.close();

    expect(frames.length).toBeGreaterThan(4);
    expect(frames[0].discontinuity?.cause).toBe('restart');
    expect(frames.some((frame) => frame.discontinuity?.cause === 'retune')).toBe(true);
    expect(frames.some((frame) => frame.discontinuity?.cause === 'sample_rate_change')).toBe(true);

    for (let i = 1; i < frames.length; i += 1) {
      const previous = frames[i - 1];
      const current = frames[i];
      expect(current.sequence).toBe(previous.sequence + 1);
      expect(current.timestampNs).toBeGreaterThan(previous.timestampNs);
      expect(current.sampleIndex).toBe(previous.sampleIndex + previous.sampleCount + current.droppedSamples);
    }

    expect(device.getStateMachineSnapshot?.().state).toBe('idle');
  });
});
