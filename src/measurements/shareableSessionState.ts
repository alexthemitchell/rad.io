import type { DemodMode } from '../telemetry/runtimeTelemetryContract';

export type ShareableLatencyPolicy = 'low-latency' | 'stable';

export type ShareableSessionStateV1 = {
  version: 1;
  frequencyHz: number;
  demodMode: DemodMode;
  fineFreqHz: number;
  ppmCorrection: number;
  streamSampleRateHz: number;
  bandwidthHz: number;
  latencyPolicy: ShareableLatencyPolicy;
  zoomLevel: number;
};

const DEMOD_MODES: ReadonlySet<DemodMode> = new Set(['WFM', 'AM', 'NFM', 'SAM', 'USB', 'LSB', 'CW']);
const LATENCY_POLICIES: ReadonlySet<ShareableLatencyPolicy> = new Set(['low-latency', 'stable']);
const STREAM_SAMPLE_RATE_OPTIONS: ReadonlySet<number> = new Set([250_000, 500_000, 1_000_000, 2_000_000, 2_400_000]);

const SHAREABLE_STATE_VERSION = 1;

const toBase64Url = (input: string): string => {
  const base64 = btoa(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (input: string): string | null => {
  if (input.length === 0) {
    return null;
  }

  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  try {
    return atob(padded);
  } catch {
    return null;
  }
};

const sanitizeNumber = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value < min || value > max) {
    return null;
  }

  return value;
};

export const encodeShareableSessionState = (state: ShareableSessionStateV1): string => {
  const payload = JSON.stringify(state);
  return toBase64Url(payload);
};

export const decodeShareableSessionState = (encoded: string): ShareableSessionStateV1 | null => {
  const decoded = fromBase64Url(encoded);
  if (!decoded) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== SHAREABLE_STATE_VERSION) {
    return null;
  }

  const frequencyHz = sanitizeNumber(candidate.frequencyHz, 100_000, 6_000_000_000);
  const fineFreqHz = sanitizeNumber(candidate.fineFreqHz, -2_000_000, 2_000_000);
  const ppmCorrection = sanitizeNumber(candidate.ppmCorrection, -1_000, 1_000);
  const bandwidthHz = sanitizeNumber(candidate.bandwidthHz, 1_000, 1_000_000);
  const zoomLevel = sanitizeNumber(candidate.zoomLevel, 1, 16);

  if (
    frequencyHz === null ||
    fineFreqHz === null ||
    ppmCorrection === null ||
    bandwidthHz === null ||
    zoomLevel === null
  ) {
    return null;
  }

  const demodModeCandidate = candidate.demodMode;
  if (typeof demodModeCandidate !== 'string' || !DEMOD_MODES.has(demodModeCandidate as DemodMode)) {
    return null;
  }
  const demodMode = demodModeCandidate as DemodMode;

  const latencyPolicyCandidate = candidate.latencyPolicy;
  if (typeof latencyPolicyCandidate !== 'string' || !LATENCY_POLICIES.has(latencyPolicyCandidate as ShareableLatencyPolicy)) {
    return null;
  }
  const latencyPolicy = latencyPolicyCandidate as ShareableLatencyPolicy;

  const streamSampleRateHz = candidate.streamSampleRateHz;
  if (typeof streamSampleRateHz !== 'number' || !STREAM_SAMPLE_RATE_OPTIONS.has(streamSampleRateHz)) {
    return null;
  }

  return {
    version: SHAREABLE_STATE_VERSION,
    frequencyHz,
    demodMode,
    fineFreqHz,
    ppmCorrection,
    streamSampleRateHz,
    bandwidthHz,
    latencyPolicy,
    zoomLevel
  };
};
