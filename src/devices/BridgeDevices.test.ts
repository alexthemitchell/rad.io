import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISDRDevice } from './ISDRDevice';
import type { SDRStreamFrame } from './streamFrame';
import { AirspyBridgeDevice } from './AirspyBridgeDevice';
import { SdrplayBridgeDevice } from './SdrplayBridgeDevice';
import { PlutoSdrBridgeDevice } from './PlutoSdrBridgeDevice';
import { LimeSdrBridgeDevice } from './LimeSdrBridgeDevice';

type BridgeFixture = {
  name: string;
  sourceType: 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR';
  make: () => ISDRDevice;
};

const FIXTURES: BridgeFixture[] = [
  {
    name: 'Airspy bridge',
    sourceType: 'AIRSPY',
    make: () => new AirspyBridgeDevice()
  },
  {
    name: 'SDRplay bridge',
    sourceType: 'SDRPLAY',
    make: () => new SdrplayBridgeDevice()
  },
  {
    name: 'Pluto bridge',
    sourceType: 'PLUTO',
    make: () => new PlutoSdrBridgeDevice()
  },
  {
    name: 'LimeSDR bridge',
    sourceType: 'LIMESDR',
    make: () => new LimeSdrBridgeDevice()
  }
];

afterEach(() => {
  vi.useRealTimers();
});

describe('Bridge-backed SDR devices', () => {
  it.each(FIXTURES)('%s completes handshake/auth/rate negotiation on open()', async ({ make, sourceType }) => {
    const device = make();

    await device.open();

    const capability = device.getCapabilityModel?.();
    expect(capability?.sourceType).toBe(sourceType);
    expect(capability?.supportedSampleRatesHz.length).toBeGreaterThan(0);

    const trace = device
      .getDebugSnapshot?.()
      ?.recentTrace
      ?.map((entry) => entry.event)
      ?.join('|');

    expect(trace).toContain('handshake-accepted');
    expect(trace).toContain('token-valid');
    expect(trace).toContain('rate-negotiated');

    await device.close();
  });

  it.each(FIXTURES)('%s streams with continuity and retune/sample-rate discontinuities', async ({ make }) => {
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

    await vi.advanceTimersByTimeAsync(80);
    await device.setFrequency(105_700_000);
    await vi.advanceTimersByTimeAsync(40);
    await device.setSampleRate(1_000_000);
    await vi.advanceTimersByTimeAsync(60);
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

  it.each(FIXTURES)('%s preserves RF/IQ/GPIO contract control surfaces', async ({ make }) => {
    const device = make();

    await device.open();

    await device.setIqControlState?.({ swapEnabled: true, invertEnabled: true });
    await device.setFrontEndCorrectionState?.({ dcOffsetEnabled: true, iqBalanceEnabled: true });
    await device.setRfPowerState?.({ biasTeeEnabled: true, ampEnabled: true });
    await device.setGpioState?.({ outputPins: { GPIO0: true } });

    expect(device.getIqControlState?.().swapEnabled).toBe(true);
    expect(device.getIqControlState?.().invertEnabled).toBe(true);
    expect(device.getFrontEndCorrectionState?.().dcOffsetEnabled).toBe(true);
    expect(device.getRfPowerState?.().biasTeeEnabled).toBe(true);
    expect(device.getGpioState?.().outputPins.GPIO0).toBe(true);

    await device.close();
  });
});
