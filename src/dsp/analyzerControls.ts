export type AnalyzerAveragingMode = 'off' | 'exp' | 'linear';
export type AnalyzerWindowMode = 'rectangular' | 'hann' | 'blackman-harris';
export type AnalyzerPeakHoldMode = 'decay' | 'max';

export type SpectrumBinRange = {
  startBinInclusive: number;
  endBinExclusive: number;
};

export type SpectrumPeak = {
  binIndex: number;
  powerDbfs: number;
  prominenceDb: number;
};

export type OccupiedBandwidthEstimate = {
  lowerFrequencyHz: number;
  upperFrequencyHz: number;
  bandwidthHz: number;
  percentPower: number;
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

const blackmanHarrisWeight = (phase: number): number => {
  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;
  const twoPiPhase = 2 * Math.PI * phase;
  return a0
    - a1 * Math.cos(twoPiPhase)
    + a2 * Math.cos(2 * twoPiPhase)
    - a3 * Math.cos(3 * twoPiPhase);
};

export const applyWindowToTrace = (
  trace: Float32Array,
  windowMode: AnalyzerWindowMode
): Float32Array => {
  if (trace.length === 0 || windowMode === 'rectangular') {
    return trace.slice();
  }

  const windowed = new Float32Array(trace.length);
  const denom = Math.max(1, trace.length - 1);
  for (let i = 0; i < trace.length; i += 1) {
    const phase = i / denom;
    const weight = windowMode === 'hann'
      ? 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)
      : blackmanHarrisWeight(phase);
    windowed[i] = trace[i] * weight;
  }

  return windowed;
};

export const getWindowEnbwBins = (windowMode: AnalyzerWindowMode): number => {
  if (windowMode === 'hann') {
    return 1.5;
  }
  if (windowMode === 'blackman-harris') {
    return 2.0;
  }
  return 1;
};

export const updatePeakHoldTrace = (
  previousPeakHold: Float32Array | null,
  trace: Float32Array,
  elapsedSec: number,
  enabled: boolean,
  decayDbPerSec = 2.2,
  mode: AnalyzerPeakHoldMode = 'decay'
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
    const held = mode === 'max'
      ? previousPeakHold[i]
      : previousPeakHold[i] - decayDbPerSec * safeElapsedSec;
    decayed[i] = Math.max(trace[i], held);
  }

  return decayed;
};

export const estimateOccupiedBandwidthHz = (
  trace: Float32Array,
  range: SpectrumBinRange,
  centerFrequencyHz: number,
  sampleRateHz: number,
  percentPower = 0.99
): OccupiedBandwidthEstimate | null => {
  if (trace.length === 0) {
    return null;
  }

  const start = clamp(range.startBinInclusive, 0, trace.length - 1);
  const end = clamp(range.endBinExclusive, start + 1, trace.length);
  const peak = findStrongestPeakInRange(trace, range);
  if (!peak) {
    return null;
  }

  const powers = new Float64Array(trace.length);
  let totalPower = 0;
  for (let i = start; i < end; i += 1) {
    const linear = Math.pow(10, trace[i] / 10);
    powers[i] = linear;
    totalPower += linear;
  }

  if (!Number.isFinite(totalPower) || totalPower <= DB_EPSILON) {
    return null;
  }

  const targetPower = totalPower * clamp(percentPower, 0.5, 0.9999);
  let includedPower = powers[peak.binIndex];
  let lowerBin = peak.binIndex;
  let upperBin = peak.binIndex;

  while (includedPower < targetPower && (lowerBin > start || upperBin < end - 1)) {
    const nextLeftPower = lowerBin > start ? powers[lowerBin - 1] : -1;
    const nextRightPower = upperBin < end - 1 ? powers[upperBin + 1] : -1;

    if (nextRightPower > nextLeftPower) {
      upperBin += 1;
      includedPower += Math.max(0, nextRightPower);
    } else {
      lowerBin -= 1;
      includedPower += Math.max(0, nextLeftPower);
    }
  }

  const lowerFrequencyHz = binIndexToFrequencyHz(lowerBin, trace.length, centerFrequencyHz, sampleRateHz);
  const upperFrequencyHz = binIndexToFrequencyHz(upperBin, trace.length, centerFrequencyHz, sampleRateHz);

  return {
    lowerFrequencyHz,
    upperFrequencyHz,
    bandwidthHz: Math.max(0, upperFrequencyHz - lowerFrequencyHz),
    percentPower: clamp(percentPower, 0.5, 0.9999)
  };
};

export const listStrongestPeaks = (
  trace: Float32Array,
  range: SpectrumBinRange,
  minimumProminenceDb: number,
  limit = 5
): SpectrumPeak[] => {
  if (trace.length < 3) {
    return [];
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
    const center = trace[i];
    if (center < trace[i - 1] || center < trace[i + 1]) {
      continue;
    }

    const prominenceDb = Number.isFinite(noiseFloorDb) ? center - noiseFloorDb : 0;
    if (prominenceDb < minimumProminenceDb) {
      continue;
    }

    candidates.push({
      binIndex: i,
      powerDbfs: center,
      prominenceDb
    });
  }

  candidates.sort((a, b) => b.powerDbfs - a.powerDbfs);
  return candidates.slice(0, Math.max(1, Math.floor(limit)));
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
