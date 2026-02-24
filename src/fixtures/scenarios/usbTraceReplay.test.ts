import { describe, expect, it } from 'vitest';
import { createUsbTraceReplayScenario } from './usbTraceReplay';

describe('createUsbTraceReplayScenario', () => {
  it('maps USB trace rows into deterministic replay events', () => {
    const scenario = createUsbTraceReplayScenario([
      { ts: '2026-02-24T00:00:00.000Z', event: 'bulk.in', status: 'ok', bytes: 16_384 },
      { ts: '2026-02-24T00:00:00.050Z', event: 'bulk.in', status: 'ok', bytes: 1_024 },
      { ts: '2026-02-24T00:00:00.090Z', event: 'bulk.in.error', status: 'stall' },
      { ts: '2026-02-24T00:00:00.140Z', event: 'recover.stall', status: 'ok' },
      { ts: '2026-02-24T00:00:00.180Z', event: 'stream.stop', status: 'ok' }
    ]);

    expect(scenario.scenarioId).toBe('usb-trace-replay-v1');
    expect(scenario.events.length).toBe(4);
    expect(scenario.events.map((event) => event.type)).toEqual([
      'usb_short_packet_burst',
      'usb_stall_storm',
      'usb_stall_storm',
      'usb_reset_mid_stream'
    ]);
    expect(scenario.events[0].atMs).toBeLessThanOrEqual(scenario.events[1].atMs);
  });

  it('returns empty replay for empty trace input', () => {
    const scenario = createUsbTraceReplayScenario([]);
    expect(scenario.events).toHaveLength(0);
  });
});
