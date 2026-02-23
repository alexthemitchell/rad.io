export type FmScanRdsTelemetry = {
  synced: boolean;
  totalGroups: number;
  ps: string;
  callsignCandidate: string | null;
  piCode: number | null;
};

export type FmScanMeasurement = {
  peakDb: number;
  noiseFloorDb: number;
  prominenceDb: number;
  rdsSynced: boolean;
  rdsGroups: number;
  score: number;
  quality: 'weak' | 'candidate' | 'strong';
};

export type FmStationCandidate = {
  frequencyHz: number;
  measurement: FmScanMeasurement;
  ps: string;
  callsignCandidate: string | null;
  piCode: number | null;
};

export type FmScanEvaluationOptions = {
  dcGuardBins?: number;
  noisePercentile?: number;
  candidateProminenceDb?: number;
  strongProminenceDb?: number;
};

const defaultOptions: Required<FmScanEvaluationOptions> = {
  dcGuardBins: 16,
  noisePercentile: 0.7,
  candidateProminenceDb: 8,
  strongProminenceDb: 16
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return -Infinity;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(1, p));
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * clamped));
  return sorted[index];
}

export function evaluateFmScanCandidate(
  fftData: Float32Array,
  rdsTelemetry: FmScanRdsTelemetry,
  options: FmScanEvaluationOptions = {}
): FmScanMeasurement {
  const config = { ...defaultOptions, ...options };

  if (fftData.length === 0) {
    return {
      peakDb: -Infinity,
      noiseFloorDb: -Infinity,
      prominenceDb: 0,
      rdsSynced: rdsTelemetry.synced,
      rdsGroups: rdsTelemetry.totalGroups,
      score: 0,
      quality: 'weak'
    };
  }

  const center = Math.floor(fftData.length / 2);
  const nonDcBins: number[] = [];

  for (let i = 0; i < fftData.length; i += 1) {
    if (Math.abs(i - center) <= config.dcGuardBins) {
      continue;
    }
    nonDcBins.push(fftData[i]);
  }

  const peakDb = nonDcBins.length > 0
    ? nonDcBins.reduce((max, value) => Math.max(max, value), -Infinity)
    : fftData.reduce((max, value) => Math.max(max, value), -Infinity);

  const noiseFloorDb = percentile(nonDcBins, config.noisePercentile);
  const prominenceDb = Number.isFinite(peakDb) && Number.isFinite(noiseFloorDb)
    ? peakDb - noiseFloorDb
    : 0;

  const rdsScore = rdsTelemetry.synced
    ? 12 + Math.min(6, rdsTelemetry.totalGroups / 20)
    : 0;
  const metadataScore = rdsTelemetry.ps.trim().length > 0 ? 3 : 0;
  const score = prominenceDb + rdsScore + metadataScore;

  let quality: FmScanMeasurement['quality'] = 'weak';
  if (prominenceDb >= config.strongProminenceDb || rdsTelemetry.synced) {
    quality = 'strong';
  } else if (prominenceDb >= config.candidateProminenceDb) {
    quality = 'candidate';
  }

  return {
    peakDb,
    noiseFloorDb,
    prominenceDb,
    rdsSynced: rdsTelemetry.synced,
    rdsGroups: rdsTelemetry.totalGroups,
    score,
    quality
  };
}

export function isStationCandidate(
  measurement: FmScanMeasurement,
  minimumProminenceDb = defaultOptions.candidateProminenceDb
): boolean {
  return measurement.prominenceDb >= minimumProminenceDb || measurement.rdsSynced;
}

export function mergeNearbyCandidates(
  candidates: FmStationCandidate[],
  mergeWindowHz = 150_000
): FmStationCandidate[] {
  if (candidates.length <= 1) {
    return [...candidates];
  }

  const sorted = [...candidates].sort((a, b) => a.frequencyHz - b.frequencyHz);
  const merged: FmStationCandidate[] = [];

  for (const candidate of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(candidate);
      continue;
    }

    if (candidate.frequencyHz - previous.frequencyHz > mergeWindowHz) {
      merged.push(candidate);
      continue;
    }

    if (candidate.measurement.score > previous.measurement.score) {
      merged[merged.length - 1] = candidate;
    }
  }

  return merged;
}
