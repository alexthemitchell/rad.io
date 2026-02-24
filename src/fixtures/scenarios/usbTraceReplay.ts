import type { DeviceDebugSnapshot } from '../../devices/ISDRDevice';
import type { ScenarioEvent, ScriptedRfScenario } from './scriptedRfScenarios';

const replayBaseTime = (traceTs: string, firstTs: number): number => {
  const ts = Date.parse(traceTs);
  if (!Number.isFinite(ts)) {
    return 0;
  }
  return Math.max(0, Math.round(ts - firstTs));
};

export const createUsbTraceReplayScenario = (
  trace: NonNullable<DeviceDebugSnapshot['recentTrace']>
): ScriptedRfScenario => {
  if (trace.length === 0) {
    return {
      scenarioId: 'usb-trace-replay-empty-v1',
      title: 'USB trace replay (empty)',
      events: []
    };
  }

  const firstTs = Date.parse(trace[0].ts);
  const events: ScenarioEvent[] = [];

  for (const row of trace) {
    const atMs = replayBaseTime(row.ts, firstTs);
    const eventName = String(row.event || '').toLowerCase();
    const status = String(row.status || '').toLowerCase();

    if (eventName.includes('bulk.in') && (status.includes('error') || eventName.includes('error'))) {
      events.push({ atMs, type: 'usb_stall_storm', bursts: 1, wallClockJumpMsPerBurst: 130 });
      continue;
    }

    if (eventName.includes('bulk.in') && typeof row.bytes === 'number' && row.bytes > 0 && row.bytes < 8_192) {
      events.push({ atMs, type: 'usb_short_packet_burst', bursts: 1, wallClockJumpMsPerBurst: 70 });
      continue;
    }

    if (eventName.includes('recover.stall') || eventName.includes('clearhalt')) {
      events.push({ atMs, type: 'usb_stall_storm', bursts: 1, wallClockJumpMsPerBurst: 180 });
      continue;
    }

    if (eventName.includes('stream.stop') || eventName.includes('stream.start')) {
      events.push({ atMs, type: 'usb_reset_mid_stream' });
    }
  }

  return {
    scenarioId: 'usb-trace-replay-v1',
    title: 'USB trace replay converted to deterministic scenario events',
    events: events.sort((a, b) => a.atMs - b.atMs)
  };
};
