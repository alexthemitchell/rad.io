import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISDRDevice } from './ISDRDevice';
import type { SDRStreamFrame } from './streamFrame';
import { MockDevice } from './MockDevice';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import {
  createRetuneGainClockBackpressureScenario,
  createUsbChaosFaultScenario,
  type ScriptedRfScenario
} from '../fixtures/scenarios/scriptedRfScenarios';
import { createUsbTraceReplayScenario } from '../fixtures/scenarios/usbTraceReplay';

const applyScriptedScenario = async (
  device: ISDRDevice,
  frames: SDRStreamFrame[],
  scenario: ScriptedRfScenario
): Promise<void> => {
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
      continue;
    }

    if (event.type === 'usb_short_packet_burst') {
      for (let burst = 0; burst < event.bursts; burst += 1) {
        vi.setSystemTime(new Date(Date.now() + event.wallClockJumpMsPerBurst));
        await vi.advanceTimersByTimeAsync(4);
      }
      continue;
    }

    if (event.type === 'usb_stall_storm') {
      for (let burst = 0; burst < event.bursts; burst += 1) {
        vi.setSystemTime(new Date(Date.now() + event.wallClockJumpMsPerBurst));
        await vi.advanceTimersByTimeAsync(6);
      }
      continue;
    }

    if (event.type === 'usb_reset_mid_stream') {
      await device.stop();
      await vi.advanceTimersByTimeAsync(4);
      await device.start((_chunk, frame) => {
        if (frame) {
          frames.push(frame);
        }
      });
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
    await applyScriptedScenario(makeDevice(), frames, createRetuneGainClockBackpressureScenario());

    expect(frames.length).toBeGreaterThan(0);

    const causes = new Set(frames.map((frame) => frame.discontinuity?.cause).filter((cause): cause is NonNullable<typeof cause> => Boolean(cause)));

    expect(causes.has('restart')).toBe(true);
    expect(causes.has('retune')).toBe(true);
    expect(causes.has('sample_rate_change')).toBe(true);
    expect(causes.has('dropped_samples')).toBe(true);
  });

  it('replays converted USB trace and chaos events deterministically in simulated devices', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const replayScenario = createUsbTraceReplayScenario([
      { ts: '2026-02-23T00:00:00.000Z', event: 'bulk.in', status: 'ok', bytes: 1024 },
      { ts: '2026-02-23T00:00:00.070Z', event: 'bulk.in.error', status: 'stall' },
      { ts: '2026-02-23T00:00:00.140Z', event: 'recover.stall', status: 'ok' },
      { ts: '2026-02-23T00:00:00.210Z', event: 'stream.stop', status: 'ok' }
    ]);

    const chaosScenario = createUsbChaosFaultScenario();

    const frames: SDRStreamFrame[] = [];
    await applyScriptedScenario(new MockDevice(), frames, replayScenario);
    await applyScriptedScenario(new MockDevice(), frames, chaosScenario);

    const causes = new Set(frames.map((frame) => frame.discontinuity?.cause).filter((cause): cause is NonNullable<typeof cause> => Boolean(cause)));
    expect(causes.has('restart')).toBe(true);
    expect(causes.has('dropped_samples')).toBe(true);
  });
});
