export type UsbStreamingProfileName = 'low-latency' | 'balanced' | 'stable';

export type UsbStreamingProfile = {
  name: UsbStreamingProfileName;
  transferSizeBytes: number;
  retryDelayMs: number;
  maxConsecutiveFailures: number;
};

export type UsbSchedulingTelemetryInput = {
  transferIntervalMsAvg: number;
  transferIntervalMsJitter: number;
  shortPacketRatio: number;
  retryCount: number;
  bulkInErrorCount: number;
  audioUnderruns: number;
  droppedFrameEvents: number;
};

export const USB_STREAMING_PROFILES: Record<UsbStreamingProfileName, UsbStreamingProfile> = {
  'low-latency': {
    name: 'low-latency',
    transferSizeBytes: 8_192,
    retryDelayMs: 10,
    maxConsecutiveFailures: 6
  },
  balanced: {
    name: 'balanced',
    transferSizeBytes: 16_384,
    retryDelayMs: 20,
    maxConsecutiveFailures: 8
  },
  stable: {
    name: 'stable',
    transferSizeBytes: 32_768,
    retryDelayMs: 30,
    maxConsecutiveFailures: 12
  }
};

export const recommendUsbStreamingProfile = (input: UsbSchedulingTelemetryInput): UsbStreamingProfileName => {
  const stressed =
    input.audioUnderruns > 0
    || input.droppedFrameEvents > 0
    || input.bulkInErrorCount > 0
    || input.retryCount > 5
    || input.transferIntervalMsJitter > 5
    || input.shortPacketRatio > 0.2;

  if (stressed) {
    return 'stable';
  }

  const veryClean =
    input.transferIntervalMsJitter < 1.2
    && input.shortPacketRatio < 0.05
    && input.retryCount === 0
    && input.bulkInErrorCount === 0
    && input.audioUnderruns === 0
    && input.droppedFrameEvents === 0
    && input.transferIntervalMsAvg < 8;

  if (veryClean) {
    return 'low-latency';
  }

  return 'balanced';
};

export type UsbAutoTuneCounters = {
  bulkInErrorCount: number;
  retryCount: number;
  transferIntervalMsJitter: number;
  shortPacketRatio: number;
  droppedFrameEvents: number;
  audioUnderruns: number;
};

export const scoreUsbProfileWindow = (before: UsbAutoTuneCounters, after: UsbAutoTuneCounters): number => {
  const deltaErrors = Math.max(0, after.bulkInErrorCount - before.bulkInErrorCount);
  const deltaRetries = Math.max(0, after.retryCount - before.retryCount);
  const deltaDrops = Math.max(0, after.droppedFrameEvents - before.droppedFrameEvents);
  const deltaUnderruns = Math.max(0, after.audioUnderruns - before.audioUnderruns);

  return (
    -deltaErrors * 100
    -deltaRetries * 12
    -deltaDrops * 20
    -deltaUnderruns * 20
    -after.transferIntervalMsJitter * 2
    -after.shortPacketRatio * 50
  );
};
