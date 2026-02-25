import { binIndexToFrequencyHz, getWindowEnbwBins, type AnalyzerWindowMode, type SpectrumPeak } from './analyzerControls';

export type AnalyzerDetectorMode = 'sample' | 'peak' | 'rms' | 'avg' | 'min-hold' | 'p95';
export type AnalyzerTraceMathMode = 'a' | 'a-minus-b' | 'max-a-b';

export type AnalyzerSemanticsSummary = {
  binWidthHz: number;
  rbwHz: number;
  vbwHz: number;
  enbwBins: number;
};

export type CandidateSignalStats = {
  noiseFloorDbfs: number;
  strongestPeakDbfs: number;
  strongestPeakSnrDb: number;
  occupancy01: number;
  persistence01: number;
};

export type SignalWarning = {
  id: string;
  kind: 'dc-spur' | 'aliasing-risk' | 'image-risk' | 'spur-density';
  severity: 'info' | 'warn';
  summary: string;
  why: string;
  mitigation: 'lo-shift' | 'bandwidth-clamp' | 'notch-preset' | 'none';
  frequencyHz: number | null;
};

export type SpurArtifactAnnotation = {
  id: string;
  frequencyHz: number;
  kind: 'device' | 'internal' | 'external';
  label: string;
  masked: boolean;
};

export type SweepSegment = {
  centerFrequencyHz: number;
  sampleRateHz: number;
  trace: Float32Array;
};

export type SweptPoint = {
  frequencyHz: number;
  powerDbfs: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toLinearPower = (db: number): number => {
  if (!Number.isFinite(db)) {
    return 0;
  }
  return Math.pow(10, db / 10);
};

const fromLinearPower = (power: number): number => {
  const safe = Math.max(power, 1e-15);
  return 10 * Math.log10(safe);
};

const percentile = (values: number[], p01: number): number => {
  if (values.length === 0) {
    return -Infinity;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * p01)));
  return sorted[idx];
};

export const computeAnalyzerSemantics = (input: {
  sampleRateHz: number;
  fftSize: number;
  vbwAveragingFrames: number;
  windowMode: AnalyzerWindowMode;
}): AnalyzerSemanticsSummary => {
  const safeFftSize = Math.max(1, Math.floor(input.fftSize));
  const binWidthHz = input.sampleRateHz / safeFftSize;
  const enbwBins = getWindowEnbwBins(input.windowMode);
  const rbwHz = Math.max(0, binWidthHz * enbwBins);
  const vbwHz = rbwHz / Math.max(1, Math.floor(input.vbwAveragingFrames));
  return {
    binWidthHz,
    rbwHz,
    vbwHz,
    enbwBins
  };
};

export const applyDetectorMode = (
  history: readonly Float32Array[],
  detectorMode: AnalyzerDetectorMode
): Float32Array => {
  if (history.length === 0) {
    return new Float32Array(0);
  }

  const latest = history[history.length - 1];
  const len = latest.length;
  const out = new Float32Array(len);

  if (detectorMode === 'sample') {
    return latest.slice();
  }

  for (let i = 0; i < len; i += 1) {
    const samples = history.map((frame) => frame[i]);

    if (detectorMode === 'peak') {
      out[i] = samples.reduce((max, value) => Math.max(max, value), -Infinity);
      continue;
    }

    if (detectorMode === 'min-hold') {
      out[i] = samples.reduce((min, value) => Math.min(min, value), Infinity);
      continue;
    }

    if (detectorMode === 'p95') {
      out[i] = percentile(samples, 0.95);
      continue;
    }

    if (detectorMode === 'avg') {
      const meanLinear = samples.reduce((sum, value) => sum + toLinearPower(value), 0) / samples.length;
      out[i] = fromLinearPower(meanLinear);
      continue;
    }

    const meanSquare = samples.reduce((sum, value) => {
      const p = toLinearPower(value);
      return sum + (p * p);
    }, 0) / samples.length;
    out[i] = fromLinearPower(Math.sqrt(Math.max(meanSquare, 0)));
  }

  return out;
};

export const applyTraceMath = (
  traceA: Float32Array,
  traceB: Float32Array | null,
  mode: AnalyzerTraceMathMode
): Float32Array => {
  if (mode === 'a' || !traceB || traceB.length !== traceA.length) {
    return traceA.slice();
  }

  const next = new Float32Array(traceA.length);
  for (let i = 0; i < traceA.length; i += 1) {
    if (mode === 'a-minus-b') {
      next[i] = traceA[i] - traceB[i];
    } else {
      next[i] = Math.max(traceA[i], traceB[i]);
    }
  }
  return next;
};

export const estimateNoiseFloorEnbwAware = (
  trace: Float32Array,
  enbwBins: number
): number => {
  if (trace.length === 0) {
    return -Infinity;
  }

  const sorted = Array.from(trace).sort((a, b) => a - b);
  const lower = Math.floor(sorted.length * 0.05);
  const upper = Math.max(lower + 1, Math.ceil(sorted.length * 0.35));
  const slice = sorted.slice(lower, upper);
  const meanLinear = slice.reduce((sum, value) => sum + toLinearPower(value), 0) / Math.max(1, slice.length);
  const enbwDb = 10 * Math.log10(Math.max(enbwBins, 1e-9));
  return fromLinearPower(meanLinear) - enbwDb;
};

export const buildCandidateSignalStats = (input: {
  trace: Float32Array;
  peaks: readonly SpectrumPeak[];
  enbwBins: number;
  persistenceHistory?: readonly Float32Array[];
}): CandidateSignalStats => {
  const noiseFloorDbfs = estimateNoiseFloorEnbwAware(input.trace, input.enbwBins);
  const strongestPeakDbfs = input.peaks.length > 0
    ? input.peaks[0].powerDbfs
    : (input.trace.length > 0 ? input.trace.reduce((max, value) => Math.max(max, value), -Infinity) : -Infinity);
  const strongestPeakSnrDb = strongestPeakDbfs - noiseFloorDbfs;

  const occupiedBins = input.trace.reduce((sum, value) => sum + (value >= noiseFloorDbfs + 6 ? 1 : 0), 0);
  const occupancy01 = input.trace.length > 0 ? occupiedBins / input.trace.length : 0;

  const history = input.persistenceHistory ?? [];
  let persistence01 = occupancy01;
  if (history.length > 0 && input.trace.length > 0) {
    let activeCount = 0;
    for (let i = 0; i < input.trace.length; i += 1) {
      let activeFrames = 0;
      for (const frame of history) {
        if (frame.length !== input.trace.length) {
          continue;
        }
        if (frame[i] >= noiseFloorDbfs + 6) {
          activeFrames += 1;
        }
      }
      if (activeFrames / history.length >= 0.5) {
        activeCount += 1;
      }
    }
    persistence01 = activeCount / input.trace.length;
  }

  return {
    noiseFloorDbfs,
    strongestPeakDbfs,
    strongestPeakSnrDb,
    occupancy01: clamp01(occupancy01),
    persistence01: clamp01(persistence01)
  };
};

export const deriveSignalWarnings = (input: {
  trace: Float32Array;
  centerFrequencyHz: number;
  sampleRateHz: number;
  peaks: readonly SpectrumPeak[];
  noiseFloorDbfs: number;
  spurDensity01: number;
}): SignalWarning[] => {
  if (input.trace.length === 0) {
    return [];
  }

  const warnings: SignalWarning[] = [];
  const centerBin = Math.floor(input.trace.length / 2);
  const dcDb = input.trace[centerBin] ?? -Infinity;

  if (dcDb >= input.noiseFloorDbfs + 12) {
    warnings.push({
      id: 'dc-spur',
      kind: 'dc-spur',
      severity: 'warn',
      summary: 'DC/LO spur near center',
      why: 'Center bin power is significantly above estimated noise floor.',
      mitigation: 'lo-shift',
      frequencyHz: input.centerFrequencyHz
    });
  }

  const edgeMarginBins = Math.max(4, Math.floor(input.trace.length * 0.05));
  const edgeRiskPeak = input.peaks.find((peak) => peak.binIndex < edgeMarginBins || peak.binIndex >= input.trace.length - edgeMarginBins);
  if (edgeRiskPeak) {
    warnings.push({
      id: 'aliasing-risk',
      kind: 'aliasing-risk',
      severity: 'warn',
      summary: 'Possible aliasing/image near FFT edge',
      why: 'A dominant peak is close to the Nyquist edge of the displayed span.',
      mitigation: 'bandwidth-clamp',
      frequencyHz: binIndexToFrequencyHz(edgeRiskPeak.binIndex, input.trace.length, input.centerFrequencyHz, input.sampleRateHz)
    });
  }

  if (input.peaks.length >= 2) {
    const mirrored = input.peaks.find((peak) => {
      const mirrorBin = (centerBin * 2) - peak.binIndex;
      return input.peaks.some((candidate) => Math.abs(candidate.binIndex - mirrorBin) <= 2);
    });

    if (mirrored) {
      warnings.push({
        id: 'image-risk',
        kind: 'image-risk',
        severity: 'info',
        summary: 'Mirrored peak pair suggests image response',
        why: 'Symmetric peaks around center can indicate IQ image leakage.',
        mitigation: 'notch-preset',
        frequencyHz: binIndexToFrequencyHz(mirrored.binIndex, input.trace.length, input.centerFrequencyHz, input.sampleRateHz)
      });
    }
  }

  if (input.spurDensity01 > 0.03) {
    warnings.push({
      id: 'spur-density',
      kind: 'spur-density',
      severity: 'info',
      summary: 'Elevated spur density detected',
      why: 'RF impurity telemetry indicates a higher-than-normal spur ratio.',
      mitigation: 'none',
      frequencyHz: null
    });
  }

  return warnings;
};

export const applyArtifactMaskToPeaks = (
  peaks: readonly SpectrumPeak[],
  annotations: readonly SpurArtifactAnnotation[],
  traceLength: number,
  centerFrequencyHz: number,
  sampleRateHz: number,
  maskToleranceHz: number
): SpectrumPeak[] => {
  const active = annotations.filter((annotation) => annotation.masked);
  if (active.length === 0) {
    return [...peaks];
  }

  return peaks.filter((peak) => {
    const peakHz = binIndexToFrequencyHz(peak.binIndex, traceLength, centerFrequencyHz, sampleRateHz);
    return !active.some((annotation) => Math.abs(annotation.frequencyHz - peakHz) <= maskToleranceHz);
  });
};

export const stitchSweepSegments = (segments: readonly SweepSegment[]): SweptPoint[] => {
  const stitched = new Map<number, number>();

  for (const segment of segments) {
    const { trace, centerFrequencyHz, sampleRateHz } = segment;
    for (let i = 0; i < trace.length; i += 1) {
      const frequencyHz = Math.round(binIndexToFrequencyHz(i, trace.length, centerFrequencyHz, sampleRateHz));
      const existing = stitched.get(frequencyHz);
      if (existing === undefined || trace[i] > existing) {
        stitched.set(frequencyHz, trace[i]);
      }
    }
  }

  return Array.from(stitched.entries())
    .map(([frequencyHz, powerDbfs]) => ({ frequencyHz, powerDbfs }))
    .sort((a, b) => a.frequencyHz - b.frequencyHz);
};
