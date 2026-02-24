export type AnalyzerAveragingMode = 'off' | 'exp' | 'linear';

export type SpectrumBinRange = {
  startBinInclusive: number;
  endBinExclusive: number;
};

export type SpectrumPeak = {
  binIndex: number;
  powerDbfs: number;
  prominenceDb: number;
};

export type MarkerReadout = {
  frequencyHz: number;
  binIndex: number;
  powerDbfs: number;
  inView: boolean;
};

const DB_EPSILON = 1e-6;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const percentile = (values: number[], p01: number): number => {
  if (values.length === 0) {
    return -Infinity;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.floor((sorted.length - 1) * p01), 0, sorted.length - 1);
  return sorted[index];
};

export const clampAveragingValue = (
  mode: AnalyzerAveragingMode,
  value: number
): number => {
  if (mode === 'exp') {
    return clamp(value, 0.05, 0.95);
  }

  if (mode === 'linear') {
    return Math.round(clamp(value, 2, 64));
  }

  return 0;
};

export const getVisibleSpectrumBinRange = (totalBins: number, zoom: number): SpectrumBinRange => {
  const safeBins = Math.max(16, Math.floor(totalBins));
  const viewLen = Math.max(16, Math.floor(safeBins / Math.max(zoom, 1)));
  const startBinInclusive = Math.max(0, Math.floor((safeBins - viewLen) / 2));
  const endBinExclusive = Math.min(safeBins, startBinInclusive + viewLen);

  return {
    startBinInclusive,
    endBinExclusive
  };
};

export const blendAveragedTrace = (
  previousTrace: Float32Array | null,
  incomingTrace: Float32Array,
  mode: AnalyzerAveragingMode,
  value: number
): Float32Array => {
  if (incomingTrace.length === 0) {
    return new Float32Array(0);
  }

  if (mode === 'off' || previousTrace === null || previousTrace.length !== incomingTrace.length) {
    return incomingTrace.slice();
  }

  const next = new Float32Array(incomingTrace.length);

  if (mode === 'exp') {
    const alpha = clampAveragingValue('exp', value);
    for (let i = 0; i < incomingTrace.length; i += 1) {
      const prev = previousTrace[i];
      const raw = incomingTrace[i];
      next[i] = prev + (raw - prev) * alpha;
    }
    return next;
  }

  const frames = clampAveragingValue('linear', value);
  for (let i = 0; i < incomingTrace.length; i += 1) {
    const prev = previousTrace[i];
    const raw = incomingTrace[i];
    next[i] = prev + (raw - prev) / frames;
  }

  return next;
};

export const updatePeakHoldTrace = (
  previousPeakHold: Float32Array | null,
  trace: Float32Array,
  elapsedSec: number,
  enabled: boolean,
  decayDbPerSec = 2.2
): Float32Array | null => {
  if (!enabled || trace.length === 0) {
    return null;
  }

  if (previousPeakHold === null || previousPeakHold.length !== trace.length) {
    return trace.slice();
  }

  const safeElapsedSec = Math.max(elapsedSec, 0.001);
  const decayed = new Float32Array(trace.length);

  for (let i = 0; i < trace.length; i += 1) {
    const held = previousPeakHold[i] - decayDbPerSec * safeElapsedSec;
    decayed[i] = Math.max(trace[i], held);
  }

  return decayed;
};

export const binIndexToFrequencyHz = (
  binIndex: number,
  totalBins: number,
  centerFrequencyHz: number,
  sampleRateHz: number
): number => {
  const safeBins = Math.max(1, totalBins);
  const centerBin = Math.floor(safeBins / 2);
  const hzPerBin = sampleRateHz / safeBins;
  const offsetBins = binIndex - centerBin;
  return centerFrequencyHz + offsetBins * hzPerBin;
};

export const frequencyHzToBinIndex = (
  frequencyHz: number,
  totalBins: number,
  centerFrequencyHz: number,
  sampleRateHz: number
): number => {
  const safeBins = Math.max(1, totalBins);
  const centerBin = Math.floor(safeBins / 2);
  const hzPerBin = sampleRateHz / safeBins;
  if (!Number.isFinite(hzPerBin) || Math.abs(hzPerBin) < DB_EPSILON) {
    return centerBin;
  }

  const offsetBins = Math.round((frequencyHz - centerFrequencyHz) / hzPerBin);
  return clamp(centerBin + offsetBins, 0, safeBins - 1);
};

export const findStrongestPeakInRange = (
  trace: Float32Array,
  range: SpectrumBinRange,
  dcGuardBins = 16
): SpectrumPeak | null => {
  if (trace.length === 0) {
    return null;
  }

  const start = clamp(range.startBinInclusive, 0, trace.length - 1);
  const end = clamp(range.endBinExclusive, start + 1, trace.length);
  const centerBin = Math.floor(trace.length / 2);

  let peakBin = -1;
  let peakPower = -Infinity;
  const values: number[] = [];

  for (let i = start; i < end; i += 1) {
    if (Math.abs(i - centerBin) <= dcGuardBins) {
      continue;
    }
    const value = trace[i];
    values.push(value);
    if (value > peakPower) {
      peakPower = value;
      peakBin = i;
    }
  }

  if (peakBin < 0) {
    return null;
  }

  const noiseFloorDb = percentile(values, 0.2);
  return {
    binIndex: peakBin,
    powerDbfs: peakPower,
    prominenceDb: Number.isFinite(noiseFloorDb) ? peakPower - noiseFloorDb : 0
  };
};

export const findNearestQualifiedPeak = (
  trace: Float32Array,
  targetBin: number,
  range: SpectrumBinRange,
  minimumProminenceDb: number
): SpectrumPeak | null => {
  if (trace.length < 3) {
    return null;
  }

  const start = clamp(range.startBinInclusive, 1, trace.length - 2);
  const end = clamp(range.endBinExclusive, start + 1, trace.length - 1);
  const values: number[] = [];

  for (let i = start; i < end; i += 1) {
    values.push(trace[i]);
  }

  const noiseFloorDb = percentile(values, 0.2);
  const candidates: SpectrumPeak[] = [];

  for (let i = start; i < end; i += 1) {
    const value = trace[i];
    const left = trace[i - 1];
    const right = trace[i + 1];
    if (value < left || value < right) {
      continue;
    }

    const prominenceDb = Number.isFinite(noiseFloorDb) ? value - noiseFloorDb : 0;
    if (prominenceDb < minimumProminenceDb) {
      continue;
    }

    candidates.push({
      binIndex: i,
      powerDbfs: value,
      prominenceDb
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const aDistance = Math.abs(a.binIndex - targetBin);
    const bDistance = Math.abs(b.binIndex - targetBin);
    if (aDistance !== bDistance) {
      return aDistance - bDistance;
    }
    return b.powerDbfs - a.powerDbfs;
  });

  return candidates[0];
};

export const resolveMarkerReadout = (
  markerFrequencyHz: number | null,
  trace: Float32Array,
  centerFrequencyHz: number,
  sampleRateHz: number,
  visibleRange: SpectrumBinRange
): MarkerReadout | null => {
  if (markerFrequencyHz === null || trace.length === 0) {
    return null;
  }

  const markerBin = frequencyHzToBinIndex(markerFrequencyHz, trace.length, centerFrequencyHz, sampleRateHz);
  const inView = markerBin >= visibleRange.startBinInclusive && markerBin < visibleRange.endBinExclusive;

  return {
    frequencyHz: markerFrequencyHz,
    binIndex: markerBin,
    powerDbfs: trace[markerBin],
    inView
  };
};
