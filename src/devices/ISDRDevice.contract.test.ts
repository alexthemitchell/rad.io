import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockDevice } from './MockDevice';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import type { ISDRDevice } from './ISDRDevice';
import type { SDRStreamFrame } from './streamFrame';

const makeDeterministicDevices = (): Array<{ name: string; make: () => ISDRDevice }> => [
  { name: 'MockDevice', make: () => new MockDevice() },
  { name: 'FileDevice', make: () => new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 1024 }) }
];

afterEach(() => {
  vi.useRealTimers();
});

describe('ISDRDevice contract conformance (deterministic sources)', () => {
  it.each(makeDeterministicDevices())('%s exposes stream continuity contract with explicit retune/sample-rate discontinuities', ({ make }) => {
    const device = make();
    const continuity = device.getStreamContinuityContract?.();

    expect(continuity).toBeDefined();
    expect(continuity?.timestampModel).toBe('monotonic-with-explicit-gaps');
    expect(continuity?.sampleIndexModel).toBe('continuous-with-gap-accounting');
    expect(continuity?.discontinuityOperations.some((entry) => entry.operation === 'retune' && entry.cause === 'retune')).toBe(true);
    expect(continuity?.discontinuityOperations.some((entry) => entry.operation === 'sample_rate_change' && entry.cause === 'sample_rate_change')).toBe(true);
  });

  it.each(makeDeterministicDevices())('%s exposes and applies IQ/front-end correction toggle state contracts', async ({ make }) => {
    const device = make();

    expect(device.getIqControlState?.().swapEnabled).toBe(false);
    expect(device.getFrontEndCorrectionState?.().dcOffsetEnabled).toBe(false);

    await device.setIqControlState?.({ swapEnabled: true, invertEnabled: true });
    await device.setFrontEndCorrectionState?.({ dcOffsetEnabled: true, iqBalanceEnabled: true });

    expect(device.getIqControlState?.().swapEnabled).toBe(true);
    expect(device.getIqControlState?.().invertEnabled).toBe(true);
    expect(device.getFrontEndCorrectionState?.().dcOffsetEnabled).toBe(true);
    expect(device.getFrontEndCorrectionState?.().iqBalanceEnabled).toBe(true);
  });

  it.each(makeDeterministicDevices())('%s exposes and applies RF power + GPIO control contracts', async ({ make }) => {
    const device = make();

    expect(device.getRfPowerState?.().biasTeeEnabled).toBe(false);
    expect(device.getRfPowerState?.().ampEnabled).toBe(false);
    expect(device.getGpioState?.().outputPins).toEqual({});

    await device.setRfPowerState?.({ biasTeeEnabled: true, ampEnabled: true });
    await device.setGpioState?.({ outputPins: { GPIO0: true, GPIO2: false } });

    expect(device.getRfPowerState?.().biasTeeEnabled).toBe(true);
    expect(device.getRfPowerState?.().ampEnabled).toBe(true);
    expect(device.getGpioState?.().outputPins).toEqual({ GPIO0: true, GPIO2: false });
  });

  it.each(makeDeterministicDevices())('%s state machine transitions include open -> streaming -> open -> idle', async ({ make }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T00:00:00.000Z'));

    const device = make();

    await device.open();
    expect(device.getStateMachineSnapshot?.().state).toBe('open');

    await device.start(() => {
      // callback intentionally empty for contract-state validation
    });
    expect(device.getStateMachineSnapshot?.().state).toBe('streaming');

    await vi.advanceTimersByTimeAsync(20);
    await device.stop();
    expect(device.getStateMachineSnapshot?.().state).toBe('open');

    await device.close();
    expect(device.getStateMachineSnapshot?.().state).toBe('idle');
  });

  it.each(makeDeterministicDevices())('%s enforces hard continuity gates for sequence/sampleIndex/timestamps and operation discontinuities', async ({ make }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T00:00:00.000Z'));

    const device = make();
    const frames: SDRStreamFrame[] = [];

    await device.open();
    await device.start((_data, frame) => {
      if (frame) {
        frames.push(frame);
      }
    });

    await vi.advanceTimersByTimeAsync(30);
    await device.setFrequency(100_500_000);
    await vi.advanceTimersByTimeAsync(20);
    await device.setSampleRate(1_000_000);
    await vi.advanceTimersByTimeAsync(30);
    await device.stop();
    await device.close();

    expect(frames.length).toBeGreaterThan(3);

    for (let i = 0; i < frames.length; i += 1) {
      const current = frames[i];

      if (i === 0) {
        expect(current.discontinuity?.cause).toBe('restart');
        continue;
      }

      const prev = frames[i - 1];
      expect(current.sequence).toBe(prev.sequence + 1);
      expect(current.sampleIndex).toBe(prev.sampleIndex + prev.sampleCount + current.droppedSamples);
      expect(current.timestampNs).toBeGreaterThan(prev.timestampNs);

      if (current.droppedSamples > 0) {
        expect(current.discontinuity?.cause).toBe('dropped_samples');
      }
    }

    expect(frames.some((frame) => frame.discontinuity?.cause === 'retune')).toBe(true);
    expect(frames.some((frame) => frame.discontinuity?.cause === 'sample_rate_change')).toBe(true);
  });
});
