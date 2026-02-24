export type BufferTelemetryInput = {
  audioQueueAheadMs: number;
  audioTargetQueueMs: number;
  dspTotalMs: number;
  usbTransferJitterMs: number;
  usbRetryCount: number;
  usbErrorCount: number;
  droppedFrameEvents: number;
  audioUnderruns: number;
};

export type BufferTelemetryAssessment = {
  occupancy01: {
    usb: number;
    dsp: number;
    audio: number;
  };
  counters: {
    usbIssues: number;
    dspIssues: number;
    audioIssues: number;
  };
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

export const assessBufferTelemetry = (input: BufferTelemetryInput): BufferTelemetryAssessment => {
  const targetQueue = Math.max(1, input.audioTargetQueueMs);
  const audioOccupancy = clamp01(input.audioQueueAheadMs / targetQueue);

  const dspBudgetMs = 20;
  const dspOccupancy = clamp01(input.dspTotalMs / dspBudgetMs);

  const usbStress = clamp01((input.usbTransferJitterMs / 12) + ((input.usbRetryCount + input.usbErrorCount) > 0 ? 0.2 : 0));
  const usbOccupancy = clamp01(1 - usbStress);

  return {
    occupancy01: {
      usb: usbOccupancy,
      dsp: dspOccupancy,
      audio: audioOccupancy
    },
    counters: {
      usbIssues: Math.max(0, input.usbRetryCount) + Math.max(0, input.usbErrorCount),
      dspIssues: Math.max(0, input.droppedFrameEvents),
      audioIssues: Math.max(0, input.audioUnderruns)
    }
  };
};

export const buildAsciiOccupancyTrend = (values01: number[]): string => {
  const chars = ' .:-=+*#%@';
  if (values01.length === 0) {
    return '';
  }

  let output = '';
  for (let i = 0; i < values01.length; i += 1) {
    const clamped = clamp01(values01[i]);
    const idx = Math.min(chars.length - 1, Math.max(0, Math.round(clamped * (chars.length - 1))));
    output += chars[idx];
  }

  return output;
};
