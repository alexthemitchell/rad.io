import { describe, expect, it } from 'vitest';
import { assessBufferTelemetry, buildAsciiOccupancyTrend } from './bufferTelemetry';

describe('buffer telemetry', () => {
  it('assesses occupancy and issue counters across usb/dsp/audio', () => {
    const result = assessBufferTelemetry({
      audioQueueAheadMs: 90,
      audioTargetQueueMs: 120,
      dspTotalMs: 8,
      usbTransferJitterMs: 2,
      usbRetryCount: 1,
      usbErrorCount: 0,
      droppedFrameEvents: 2,
      audioUnderruns: 3
    });

    expect(result.occupancy01.audio).toBeCloseTo(0.75, 2);
    expect(result.occupancy01.dsp).toBeCloseTo(0.4, 2);
    expect(result.counters.usbIssues).toBe(1);
    expect(result.counters.dspIssues).toBe(2);
    expect(result.counters.audioIssues).toBe(3);
  });

  it('builds ascii occupancy trends from normalized samples', () => {
    const trend = buildAsciiOccupancyTrend([0, 0.25, 0.5, 0.75, 1]);

    expect(trend.length).toBe(5);
    expect(trend).not.toBe('');
  });
});
