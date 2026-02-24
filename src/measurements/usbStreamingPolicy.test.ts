import { describe, expect, it } from 'vitest';
import {
  recommendUsbStreamingProfile,
  scoreUsbProfileWindow,
  USB_STREAMING_PROFILES
} from './usbStreamingPolicy';

describe('usbStreamingPolicy', () => {
  it('recommends stable profile under stressed telemetry', () => {
    const profile = recommendUsbStreamingProfile({
      transferIntervalMsAvg: 10,
      transferIntervalMsJitter: 6,
      shortPacketRatio: 0.24,
      retryCount: 8,
      bulkInErrorCount: 1,
      audioUnderruns: 1,
      droppedFrameEvents: 2
    });

    expect(profile).toBe('stable');
    expect(USB_STREAMING_PROFILES[profile].transferSizeBytes).toBeGreaterThan(16_000);
  });

  it('recommends low-latency profile for clean transfer conditions', () => {
    const profile = recommendUsbStreamingProfile({
      transferIntervalMsAvg: 6,
      transferIntervalMsJitter: 0.9,
      shortPacketRatio: 0.01,
      retryCount: 0,
      bulkInErrorCount: 0,
      audioUnderruns: 0,
      droppedFrameEvents: 0
    });

    expect(profile).toBe('low-latency');
  });

  it('scores windows lower when errors and jitter increase', () => {
    const baseline = {
      bulkInErrorCount: 1,
      retryCount: 2,
      transferIntervalMsJitter: 1.5,
      shortPacketRatio: 0.05,
      droppedFrameEvents: 3,
      audioUnderruns: 1
    };

    const cleanScore = scoreUsbProfileWindow(baseline, {
      ...baseline,
      transferIntervalMsJitter: 1,
      shortPacketRatio: 0.04
    });

    const noisyScore = scoreUsbProfileWindow(baseline, {
      bulkInErrorCount: 2,
      retryCount: 6,
      transferIntervalMsJitter: 7,
      shortPacketRatio: 0.28,
      droppedFrameEvents: 5,
      audioUnderruns: 3
    });

    expect(noisyScore).toBeLessThan(cleanScore);
  });
});
