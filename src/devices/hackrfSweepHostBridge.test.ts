import { describe, expect, it, vi } from 'vitest';
import {
  HACKRF_SWEEP_BRIDGE_CAPABILITY_ID,
  probeHackrfSweepHostBridge,
  runHackrfSweepViaHostBridge,
  type HackrfSweepHostBridgeApi
} from './hackrfSweepHostBridge';

describe('hackrfSweepHostBridge', () => {
  it('reports unavailable when bridge object is missing', () => {
    const probe = probeHackrfSweepHostBridge({});
    expect(probe.available).toBe(false);
    expect(probe.reason).toContain('__RADIO_HOST_BRIDGE__');
  });

  it('reports available when bridge advertises hackrf-sweep capability', () => {
    const bridge: HackrfSweepHostBridgeApi = {
      providerLabel: 'bridge-daemon',
      protocolVersion: 1,
      capabilities: [HACKRF_SWEEP_BRIDGE_CAPABILITY_ID],
      runHackrfSweep: vi.fn(async () => ({
        points: [{ frequencyHz: 100_000_000, powerDbfs: -40 }],
        elapsedMs: 125
      }))
    };

    const probe = probeHackrfSweepHostBridge({ __RADIO_HOST_BRIDGE__: bridge });
    expect(probe.available).toBe(true);
    expect(probe.providerLabel).toBe('bridge-daemon');
    expect(probe.bridge).not.toBeNull();
    expect(probe.bridge?.capabilities).toEqual([HACKRF_SWEEP_BRIDGE_CAPABILITY_ID]);
  });

  it('rejects bridge that does not advertise hackrf-sweep capability', () => {
    const bridge: HackrfSweepHostBridgeApi = {
      providerLabel: 'bridge-daemon',
      protocolVersion: 1,
      capabilities: ['stream'],
      runHackrfSweep: vi.fn(async () => ({
        points: [{ frequencyHz: 100_000_000, powerDbfs: -40 }],
        elapsedMs: 125
      }))
    };

    const probe = probeHackrfSweepHostBridge({ __RADIO_HOST_BRIDGE__: bridge });
    expect(probe.available).toBe(false);
    expect(probe.reason).toContain('not advertised');
  });

  it('runs host sweep and normalizes diagnostics', async () => {
    const bridge: HackrfSweepHostBridgeApi = {
      protocolVersion: 1,
      capabilities: [HACKRF_SWEEP_BRIDGE_CAPABILITY_ID],
      runHackrfSweep: vi.fn(async () => ({
        points: [
          { frequencyHz: 99_900_000, powerDbfs: -45.2 },
          { frequencyHz: 100_100_000, powerDbfs: -47.8 }
        ],
        elapsedMs: 83,
        diagnostics: ['used hackrf_sweep -w 1000000']
      }))
    };

    const result = await runHackrfSweepViaHostBridge({
      bridge,
      request: {
        startFrequencyHz: 99_500_000,
        stopFrequencyHz: 100_500_000,
        stepHz: 250_000,
        sampleRateHz: 2_000_000,
        timeoutMs: 20_000
      }
    });

    expect(result.points).toHaveLength(2);
    expect(result.elapsedMs).toBe(83);
    expect(result.diagnostics).toEqual(['used hackrf_sweep -w 1000000']);
  });

  it('fails when host bridge returns no points', async () => {
    const bridge: HackrfSweepHostBridgeApi = {
      protocolVersion: 1,
      capabilities: [HACKRF_SWEEP_BRIDGE_CAPABILITY_ID],
      runHackrfSweep: vi.fn(async () => ({
        points: [],
        elapsedMs: 1
      }))
    };

    await expect(runHackrfSweepViaHostBridge({
      bridge,
      request: {
        startFrequencyHz: 99_500_000,
        stopFrequencyHz: 100_500_000,
        stepHz: 250_000,
        sampleRateHz: 2_000_000,
        timeoutMs: 20_000
      }
    })).rejects.toThrow('no sweep points');
  });
});
