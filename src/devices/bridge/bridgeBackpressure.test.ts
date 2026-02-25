import { describe, expect, it } from 'vitest';
import {
  acknowledgeBridgeFrames,
  canSendBridgeFrame,
  enqueueBridgeFrame,
  negotiateBridgeRate
} from './bridgeBackpressure';

describe('bridgeBackpressure', () => {
  it('negotiates clamped rate and recommendation', () => {
    const result = negotiateBridgeRate({
      requestedIqRateHz: 5_000_000,
      maxLatencyMs: 180,
      availableBufferFrames: 20
    });

    expect(result.selectedIqRateHz).toBe(3_200_000);
    expect(result.recommendation).toBe('stable');
    expect(result.frameBatchSize).toBe(8);
    expect(result.trace.length).toBeGreaterThan(1);
  });

  it('tracks flow window in-flight frame accounting', () => {
    const initial = { capacityFrames: 2, inFlightFrames: 0 };
    expect(canSendBridgeFrame(initial)).toBe(true);

    const one = enqueueBridgeFrame(initial);
    const two = enqueueBridgeFrame(one);
    expect(canSendBridgeFrame(two)).toBe(false);

    const acked = acknowledgeBridgeFrames(two, 1);
    expect(acked.inFlightFrames).toBe(1);
    expect(canSendBridgeFrame(acked)).toBe(true);
  });
});
