import { describe, expect, it } from 'vitest';
import { createSigmfFixtureBundle, parseSigmfFixtureMetadata } from './schema';

describe('SigMF fixture schema', () => {
  it('parses legacy baseline metadata without calibrated fields', () => {
    const metadata = parseSigmfFixtureMetadata({
      fixtureSchemaVersion: 1,
      recordingSchemaVersion: 1,
      fixtureId: 'legacy-ci8-v1',
      title: 'Legacy Fixture',
      sampleRateHz: 2_000_000,
      centerFrequencyHz: 101_100_000,
      calibrationStatus: 'uncalibrated',
      dataType: 'ci8'
    });

    expect(metadata.fixtureId).toBe('legacy-ci8-v1');
    expect(metadata.calibratedLevelOffsetDb).toBeUndefined();
    expect(metadata.calibratedFrequencyOffsetHz).toBeUndefined();
    expect(metadata.referenceClock).toBeUndefined();
    expect(metadata.wallClock).toBeUndefined();
  });

  it('parses calibrated metadata with reference and wall-clock fields', () => {
    const metadata = parseSigmfFixtureMetadata({
      fixtureSchemaVersion: 2,
      recordingSchemaVersion: 1,
      fixtureId: 'calibrated-ci8-v2',
      title: 'Calibrated Fixture',
      sampleRateHz: 228_000,
      centerFrequencyHz: 99_500_000,
      calibrationStatus: 'factory',
      dataType: 'ci8',
      calibratedLevelOffsetDb: -0.25,
      calibratedFrequencyOffsetHz: 8.75,
      referenceClock: {
        source: 'gpsdo',
        nominalFrequencyHz: 10_000_000,
        measuredPpm: 0.05
      },
      wallClock: {
        capturedAtUtc: '2026-02-23T00:00:00.000Z',
        unixEpochMs: 1_772_809_600_000
      },
      timeAlignment: {
        wallClockAligned: true,
        alignmentUncertaintyMs: 1.25,
        referenceDiscipline: {
          source: '1pps',
          locked: true,
          measuredPpm: 0.02
        }
      }
    });

    expect(metadata.calibratedLevelOffsetDb).toBeCloseTo(-0.25, 6);
    expect(metadata.calibratedFrequencyOffsetHz).toBeCloseTo(8.75, 6);
    expect(metadata.referenceClock?.source).toBe('gpsdo');
    expect(metadata.referenceClock?.nominalFrequencyHz).toBe(10_000_000);
    expect(metadata.wallClock?.capturedAtUtc).toBe('2026-02-23T00:00:00.000Z');
    expect(metadata.timeAlignment?.wallClockAligned).toBe(true);
    expect(metadata.timeAlignment?.referenceDiscipline?.source).toBe('1pps');
  });

  it('rejects invalid optional calibrated metadata fields', () => {
    expect(() =>
      parseSigmfFixtureMetadata({
        fixtureSchemaVersion: 2,
        recordingSchemaVersion: 1,
        fixtureId: 'bad-clock',
        title: 'Bad Clock',
        sampleRateHz: 228_000,
        centerFrequencyHz: 101_100_000,
        calibrationStatus: 'factory',
        dataType: 'ci8',
        referenceClock: {
          source: 'gpsdo',
          nominalFrequencyHz: 0
        }
      })
    ).toThrow('referenceClock.nominalFrequencyHz');

    expect(() =>
      parseSigmfFixtureMetadata({
        fixtureSchemaVersion: 2,
        recordingSchemaVersion: 1,
        fixtureId: 'bad-wall-clock',
        title: 'Bad Wall Clock',
        sampleRateHz: 228_000,
        centerFrequencyHz: 101_100_000,
        calibrationStatus: 'factory',
        dataType: 'ci8',
        wallClock: {
          capturedAtUtc: 'not-a-date'
        }
      })
    ).toThrow('wallClock.capturedAtUtc');

    expect(() =>
      parseSigmfFixtureMetadata({
        fixtureSchemaVersion: 2,
        recordingSchemaVersion: 1,
        fixtureId: 'bad-time-alignment',
        title: 'Bad Time Alignment',
        sampleRateHz: 228_000,
        centerFrequencyHz: 101_100_000,
        calibrationStatus: 'factory',
        dataType: 'ci8',
        timeAlignment: {
          referenceDiscipline: {
            source: 'bad-source',
            locked: true
          }
        }
      })
    ).toThrow('timeAlignment.referenceDiscipline.source');
  });

  it('creates fixture bundle with validated metadata and ci8 data', () => {
    const fixture = createSigmfFixtureBundle(
      {
        fixtureSchemaVersion: 2,
        recordingSchemaVersion: 1,
        fixtureId: 'bundle-ci8-v2',
        title: 'Bundle Fixture',
        sampleRateHz: 96_000,
        centerFrequencyHz: 88_300_000,
        calibrationStatus: 'user',
        dataType: 'ci8',
        calibratedLevelOffsetDb: 1.5
      },
      new Uint8Array([128, 127, 140, 120])
    );

    expect(fixture.metadata.fixtureId).toBe('bundle-ci8-v2');
    expect(fixture.iqData.byteLength).toBe(4);
  });
});
