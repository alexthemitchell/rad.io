export type SessionProvenanceParameter =
  | 'frequency_hz'
  | 'demod_mode'
  | 'fine_tune_hz'
  | 'ppm_correction'
  | 'bandwidth_hz'
  | 'gain_profile'
  | 'latency_policy'
  | 'clock_sync_policy';

export type SessionParameterChangeEntry = {
  parameter: SessionProvenanceParameter;
  oldValue: number | string | boolean | null;
  newValue: number | string | boolean | null;
  wallClockMs: number;
  sessionOffsetMs: number | null;
};

export const appendSessionParameterChangeEntry = (
  current: SessionParameterChangeEntry[],
  parameter: SessionProvenanceParameter,
  oldValue: number | string | boolean | null,
  newValue: number | string | boolean | null,
  sessionStartedUnixMs: number | null,
  maxEntries = 512,
  nowUnixMs = Date.now()
): SessionParameterChangeEntry[] => {
  const next: SessionParameterChangeEntry = {
    parameter,
    oldValue,
    newValue,
    wallClockMs: nowUnixMs,
    sessionOffsetMs:
      typeof sessionStartedUnixMs === 'number' ? Math.max(0, nowUnixMs - sessionStartedUnixMs) : null
  };

  const withNext = [...current, next];
  if (withNext.length <= maxEntries) {
    return withNext;
  }

  return withNext.slice(withNext.length - maxEntries);
};
