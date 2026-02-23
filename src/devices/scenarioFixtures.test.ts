import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISDRDevice } from './ISDRDevice';
import type { SDRStreamFrame } from './streamFrame';
import { MockDevice } from './MockDevice';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import { createRetuneGainClockBackpressureScenario } from '../fixtures/scenarios/scriptedRfScenarios';

const applyScriptedScenario = async (
  device: ISDRDevice,
  frames: SDRStreamFrame[]
): Promise<void> => {
  const scenario = createRetuneGainClockBackpressureScenario();

  await device.open();
  await device.start((_chunk, frame) => {
    if (frame) {
      frames.push(frame);
    }
  });

  let elapsedMs = 0;

  for (const event of scenario.events) {
    const delta = Math.max(0, event.atMs - elapsedMs);
    elapsedMs = event.atMs;
    await vi.advanceTimersByTimeAsync(delta);

    if (event.type === 'retune') {
      await device.setFrequency(event.frequencyHz);
      continue;
    }

    if (event.type === 'gain_step') {
      const gainStage = device.getGainStages().find((stage) => stage.name === event.stageName);
      if (gainStage) {
        await device.setGain(event.stageName, event.gainValue);
      }
      continue;
    }

    if (event.type === 'sample_rate_step') {
      await device.setSampleRate(event.sampleRateHz);
      continue;
    }

    if (event.type === 'clock_step') {
      vi.setSystemTime(new Date(Date.now() + event.wallClockJumpMs));
      continue;
    }

    if (event.type === 'backpressure') {
      vi.setSystemTime(new Date(Date.now() + event.wallClockJumpMs));
      await vi.advanceTimersByTimeAsync(12);
    }
  }

  await vi.advanceTimersByTimeAsync(30);
  await device.stop();
  await device.close();
};

afterEach(() => {
  vi.useRealTimers();
});

describe('deterministic scenario fixtures', () => {
  it.each([
    ['MockDevice', () => new MockDevice()],
    ['FileDevice', () => new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 1024 })]
  ])('%s reproduces scripted retune/gain/clock/backpressure events', async (_name, makeDevice) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const frames: SDRStreamFrame[] = [];
    await applyScriptedScenario(makeDevice(), frames);

    expect(frames.length).toBeGreaterThan(0);

    const causes = new Set(frames.map((frame) => frame.discontinuity?.cause).filter((cause): cause is NonNullable<typeof cause> => Boolean(cause)));

    expect(causes.has('restart')).toBe(true);
    expect(causes.has('retune')).toBe(true);
    expect(causes.has('sample_rate_change')).toBe(true);
    expect(causes.has('dropped_samples')).toBe(true);
  });
});
