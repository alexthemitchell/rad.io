import { describe, expect, it } from 'vitest';
import {
  evaluateFmScanCandidate,
  isStationCandidate,
  mergeNearbyCandidates,
  type FmStationCandidate
} from './FmBandScanner';

function baseRds(overrides: Partial<{ synced: boolean; totalGroups: number; ps: string; callsignCandidate: string | null; piCode: number | null; }> = {}) {
  return {
    synced: false,
    totalGroups: 0,
    ps: '',
    callsignCandidate: null,
    piCode: null,
    ...overrides
  };
}

describe('FmBandScanner', () => {
  it('classifies strong candidate from prominence', () => {
    const fft = new Float32Array(2048).fill(-96);
    fft[64] = -54;

    const measurement = evaluateFmScanCandidate(fft, baseRds());

    expect(measurement.prominenceDb).toBeGreaterThan(30);
    expect(measurement.quality).toBe('strong');
    expect(isStationCandidate(measurement)).toBe(true);
  });

  it('boosts quality when RDS is synced', () => {
    const fft = new Float32Array(1024).fill(-92);
    fft[100] = -88;

    const measurement = evaluateFmScanCandidate(
      fft,
      baseRds({ synced: true, totalGroups: 120, ps: 'WXYZ' })
    );

    expect(measurement.rdsSynced).toBe(true);
    expect(measurement.quality).toBe('strong');
    expect(measurement.score).toBeGreaterThan(12);
    expect(isStationCandidate(measurement)).toBe(true);
  });

  it('merges nearby candidates using highest score', () => {
    const candidates: FmStationCandidate[] = [
      {
        frequencyHz: 100_100_000,
        measurement: {
          peakDb: -40,
          noiseFloorDb: -85,
          prominenceDb: 45,
          rdsSynced: false,
          rdsGroups: 0,
          score: 45,
          quality: 'strong'
        },
        ps: '',
        callsignCandidate: null,
        piCode: null
      },
      {
        frequencyHz: 100_180_000,
        measurement: {
          peakDb: -38,
          noiseFloorDb: -85,
          prominenceDb: 47,
          rdsSynced: true,
          rdsGroups: 90,
          score: 60,
          quality: 'strong'
        },
        ps: 'NEWS',
        callsignCandidate: 'KQRS',
        piCode: 0x1234
      },
      {
        frequencyHz: 101_700_000,
        measurement: {
          peakDb: -50,
          noiseFloorDb: -88,
          prominenceDb: 38,
          rdsSynced: false,
          rdsGroups: 0,
          score: 38,
          quality: 'strong'
        },
        ps: '',
        callsignCandidate: null,
        piCode: null
      }
    ];

    const merged = mergeNearbyCandidates(candidates, 150_000);

    expect(merged).toHaveLength(2);
    expect(merged[0].frequencyHz).toBe(100_180_000);
    expect(merged[0].ps).toBe('NEWS');
    expect(merged[1].frequencyHz).toBe(101_700_000);
  });
});
