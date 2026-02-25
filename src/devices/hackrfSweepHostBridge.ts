import type { SweptPoint } from '../dsp/analyzerSemantics';

export const HACKRF_SWEEP_BRIDGE_CAPABILITY_ID = 'hackrf-sweep';

export type HackrfSweepHostRequest = {
  startFrequencyHz: number;
  stopFrequencyHz: number;
  stepHz: number;
  sampleRateHz: number;
  timeoutMs: number;
};

export type HackrfSweepHostResponse = {
  points: SweptPoint[];
  elapsedMs: number;
  diagnostics?: string[];
};

export type HackrfSweepBridgeProbe = {
  available: boolean;
  providerLabel?: string;
  reason?: string;
};

export type HackrfSweepHostBridgeApi = {
  providerLabel?: string;
  protocolVersion: number;
  capabilities: readonly string[];
  runHackrfSweep: (request: HackrfSweepHostRequest) => Promise<HackrfSweepHostResponse>;
};

type HostWindowLike = {
  __RADIO_HOST_BRIDGE__?: unknown;
};

const isFinitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const asBridgeApi = (candidate: unknown): HackrfSweepHostBridgeApi | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const bridge = candidate as Partial<HackrfSweepHostBridgeApi>;
  if (typeof bridge.runHackrfSweep !== 'function') {
    return null;
  }

  if (!Number.isFinite(bridge.protocolVersion ?? NaN)) {
    return null;
  }

  if (!Array.isArray(bridge.capabilities) || !bridge.capabilities.every((entry) => typeof entry === 'string')) {
    return null;
  }

  return {
    providerLabel: bridge.providerLabel,
    protocolVersion: bridge.protocolVersion ?? 0,
    capabilities: bridge.capabilities,
    runHackrfSweep: bridge.runHackrfSweep
  };
};

export const probeHackrfSweepHostBridge = (
  hostWindow: HostWindowLike | null = typeof window === 'undefined' ? null : (window as HostWindowLike)
): HackrfSweepBridgeProbe & { bridge: HackrfSweepHostBridgeApi | null } => {
  if (!hostWindow) {
    return {
      available: false,
      reason: 'Host bridge probe unavailable outside browser window context.',
      bridge: null
    };
  }

  const bridge = asBridgeApi(hostWindow.__RADIO_HOST_BRIDGE__);
  if (!bridge) {
    return {
      available: false,
      reason: 'window.__RADIO_HOST_BRIDGE__ missing or invalid.',
      bridge: null
    };
  }

  if (bridge.protocolVersion < 1) {
    return {
      available: false,
      reason: `Unsupported host bridge protocol version ${bridge.protocolVersion}.`,
      providerLabel: bridge.providerLabel,
      bridge: null
    };
  }

  if (!bridge.capabilities.includes(HACKRF_SWEEP_BRIDGE_CAPABILITY_ID)) {
    return {
      available: false,
      reason: 'Host bridge connected but hackrf-sweep capability is not advertised.',
      providerLabel: bridge.providerLabel,
      bridge: null
    };
  }

  return {
    available: true,
    providerLabel: bridge.providerLabel,
    bridge
  };
};

const validateSweepRequest = (request: HackrfSweepHostRequest): string | null => {
  if (!isFinitePositive(request.startFrequencyHz)) {
    return 'Sweep request start frequency must be positive and finite.';
  }

  if (!isFinitePositive(request.stopFrequencyHz)) {
    return 'Sweep request stop frequency must be positive and finite.';
  }

  if (request.stopFrequencyHz <= request.startFrequencyHz) {
    return 'Sweep request stop frequency must be greater than start frequency.';
  }

  if (!isFinitePositive(request.stepHz)) {
    return 'Sweep request step must be positive and finite.';
  }

  if (!isFinitePositive(request.sampleRateHz)) {
    return 'Sweep request sample rate must be positive and finite.';
  }

  if (!isFinitePositive(request.timeoutMs)) {
    return 'Sweep request timeout must be positive and finite.';
  }

  return null;
};

const normalizeSweepResponse = (response: HackrfSweepHostResponse): HackrfSweepHostResponse => {
  const points = Array.isArray(response.points)
    ? response.points.filter(
        (point) => isFinitePositive(point.frequencyHz) && Number.isFinite(point.powerDbfs)
      )
    : [];

  const diagnostics = Array.isArray(response.diagnostics)
    ? response.diagnostics.filter((entry) => typeof entry === 'string').slice(0, 16)
    : [];

  return {
    points,
    elapsedMs: Number.isFinite(response.elapsedMs) && response.elapsedMs >= 0 ? response.elapsedMs : 0,
    diagnostics
  };
};

export const runHackrfSweepViaHostBridge = async (input: {
  bridge: HackrfSweepHostBridgeApi;
  request: HackrfSweepHostRequest;
}): Promise<HackrfSweepHostResponse> => {
  const requestIssue = validateSweepRequest(input.request);
  if (requestIssue) {
    throw new Error(requestIssue);
  }

  const response = await input.bridge.runHackrfSweep(input.request);
  const normalized = normalizeSweepResponse(response);
  if (normalized.points.length === 0) {
    throw new Error('Host bridge returned no sweep points.');
  }

  return normalized;
};
