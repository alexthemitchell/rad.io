export type BridgeRateNegotiationRequest = {
  requestedIqRateHz: number;
  maxLatencyMs: number;
  availableBufferFrames: number;
};

export type BridgeRateNegotiationResult = {
  selectedIqRateHz: number;
  frameBatchSize: number;
  recommendation: 'stable' | 'balanced' | 'low-latency';
  trace: string[];
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const negotiateBridgeRate = (request: BridgeRateNegotiationRequest): BridgeRateNegotiationResult => {
  const trace: string[] = [];

  const selectedIqRateHz = clamp(Math.round(request.requestedIqRateHz), 250_000, 3_200_000);
  if (selectedIqRateHz !== request.requestedIqRateHz) {
    trace.push(`iq-rate clamped ${request.requestedIqRateHz} -> ${selectedIqRateHz}`);
  } else {
    trace.push(`iq-rate accepted ${selectedIqRateHz}`);
  }

  const boundedFrames = clamp(request.availableBufferFrames, 2, 32);
  const frameBatchSize = boundedFrames <= 4 ? 2 : boundedFrames <= 12 ? 4 : 8;

  const recommendation = request.maxLatencyMs <= 70
    ? 'low-latency'
    : request.maxLatencyMs >= 140
      ? 'stable'
      : 'balanced';

  trace.push(`buffer frames ${request.availableBufferFrames} -> batch ${frameBatchSize}`);
  trace.push(`latency ${request.maxLatencyMs}ms -> ${recommendation}`);

  return {
    selectedIqRateHz,
    frameBatchSize,
    recommendation,
    trace
  };
};

export type BridgeFlowWindow = {
  capacityFrames: number;
  inFlightFrames: number;
};

export const canSendBridgeFrame = (window: BridgeFlowWindow): boolean =>
  window.inFlightFrames < Math.max(1, window.capacityFrames);

export const acknowledgeBridgeFrames = (window: BridgeFlowWindow, ackedFrames: number): BridgeFlowWindow => ({
  capacityFrames: Math.max(1, window.capacityFrames),
  inFlightFrames: Math.max(0, window.inFlightFrames - Math.max(0, ackedFrames))
});

export const enqueueBridgeFrame = (window: BridgeFlowWindow): BridgeFlowWindow => ({
  capacityFrames: Math.max(1, window.capacityFrames),
  inFlightFrames: window.inFlightFrames + 1
});
