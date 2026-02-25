import { describe, expect, it } from 'vitest';
import {
  applyDetectorMode,
  applyTraceMath,
  buildCandidateSignalStats,
  computeAnalyzerSemantics,
  deriveSignalWarnings,
  estimateNoiseFloorEnbwAware,
  stitchSweepSegments
} from './analyzerSemantics';

describe('analyzerSemantics', () => {
  it('computes RBW/VBW from FFT size and ENBW', () => {
    const semantics = computeAnalyzerSemantics({
      sampleRateHz: 2_000_000,
      fftSize: 2048,
      vbwAveragingFrames: 4,
      windowMode: 'hann'
    });

    expect(semantics.enbwBins).toBeCloseTo(1.5, 6);
    expect(semantics.rbwHz).toBeCloseTo((2_000_000 / 2048) * 1.5, 6);
    expect(semantics.vbwHz).toBeCloseTo(semantics.rbwHz / 4, 6);
  });

  it('supports detector extensions min-hold and p95', () => {
    const history = [
      new Float32Array([-80, -70, -60]),
      new Float32Array([-75, -68, -59]),
      new Float32Array([-90, -65, -58])
    ];

    const minHold = applyDetectorMode(history, 'min-hold');
    const p95 = applyDetectorMode(history, 'p95');

    expect(Array.from(minHold)).toEqual([-90, -70, -60]);
    expect(p95[0]).toBeCloseTo(-75, 6);
    expect(p95[1]).toBeCloseTo(-65, 6);
    expect(p95[2]).toBeCloseTo(-58, 6);
  });

  it('applies trace math modes', () => {
    const a = new Float32Array([-70, -60, -50]);
    const b = new Float32Array([-80, -64, -48]);

    expect(Array.from(applyTraceMath(a, b, 'a-minus-b'))).toEqual([10, 4, -2]);
    expect(Array.from(applyTraceMath(a, b, 'max-a-b'))).toEqual([-70, -60, -48]);
  });

  it('estimates ENBW-aware noise floor and candidate stats', () => {
    const trace = new Float32Array(128).fill(-110);
    trace[40] = -68;
    trace[41] = -66;

    const stats = buildCandidateSignalStats({
      trace,
      peaks: [{ binIndex: 41, powerDbfs: -66, prominenceDb: 20 }],
      enbwBins: 1.5,
      persistenceHistory: [trace, trace]
    });

    expect(estimateNoiseFloorEnbwAware(trace, 1.5)).toBeLessThan(-110);
    expect(stats.strongestPeakSnrDb).toBeGreaterThan(35);
    expect(stats.occupancy01).toBeGreaterThan(0);
  });

  it('derives false-signal warnings from trace shape and telemetry hints', () => {
    const trace = new Float32Array(128).fill(-120);
    trace[64] = -70;
    trace[3] = -72;
    trace[20] = -80;
    trace[108] = -79;

    const warnings = deriveSignalWarnings({
      trace,
      centerFrequencyHz: 100_000_000,
      sampleRateHz: 2_000_000,
      peaks: [
        { binIndex: 3, powerDbfs: -72, prominenceDb: 30 },
        { binIndex: 20, powerDbfs: -80, prominenceDb: 22 },
        { binIndex: 108, powerDbfs: -79, prominenceDb: 21 }
      ],
      noiseFloorDbfs: -120,
      spurDensity01: 0.05
    });

    expect(warnings.some((warning) => warning.kind === 'dc-spur')).toBe(true);
    expect(warnings.some((warning) => warning.kind === 'aliasing-risk')).toBe(true);
    expect(warnings.some((warning) => warning.kind === 'image-risk')).toBe(true);
    expect(warnings.some((warning) => warning.kind === 'spur-density')).toBe(true);
  });

  it('stitches sweep segments using max power for overlapping bins', () => {
    const segmentA = new Float32Array(8).fill(-100);
    const segmentB = new Float32Array(8).fill(-102);
    segmentA[6] = -65;
    segmentB[2] = -62;

    const stitched = stitchSweepSegments([
      {
        centerFrequencyHz: 100_000_000,
        sampleRateHz: 800_000,
        trace: segmentA
      },
      {
        centerFrequencyHz: 100_400_000,
        sampleRateHz: 800_000,
        trace: segmentB
      }
    ]);

    expect(stitched.length).toBeGreaterThan(8);
    expect(stitched.some((point) => point.powerDbfs === -62)).toBe(true);
  });
});
