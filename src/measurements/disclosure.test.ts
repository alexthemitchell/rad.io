import { describe, expect, it } from 'vitest';
import { createMeasurementCalibrationDisclosure } from './disclosure';
import { createKnownSignalFixtureLibrary } from '../fixtures/sigmf/knownSignalFixtureLibrary';

describe('createMeasurementCalibrationDisclosure', () => {
  it('returns uncalibrated disclosure when fixture metadata is absent', () => {
    const disclosure = createMeasurementCalibrationDisclosure();

    expect(disclosure.frequency.state).toBe('uncalibrated');
    expect(disclosure.level.state).toBe('uncalibrated');
    expect(disclosure.uncertaintyModel.uncertaintyUnknown).toBe(true);
    expect(disclosure.disclosureText.uiBadgeShort).toBe('Uncalibrated');
  });

  it('derives approximate confidence from factory fixture metadata', () => {
    const fixtures = createKnownSignalFixtureLibrary();
    const disclosure = createMeasurementCalibrationDisclosure(fixtures['fm-pilot-ci8-v1'].metadata);

    expect(disclosure.frequency.state).toBe('approximate');
    expect(disclosure.level.state).toBe('approximate');
    expect(disclosure.timebase.state).toBe('external-disciplined');
    expect(disclosure.frequency.residualUncertaintyPpm).toBeGreaterThan(0);
    expect(disclosure.level.residualUncertaintyDb).toBeCloseTo(3, 6);
    expect(disclosure.disclosureText.uiBadgeShort).toBe('Approximate');
  });

  it('supports calibrated state when full user calibration evidence is present', () => {
    const disclosure = createMeasurementCalibrationDisclosure({
      fixtureSchemaVersion: 2,
      recordingSchemaVersion: 1,
      fixtureId: 'calibrated-user-fixture',
      title: 'Calibrated Fixture',
      sampleRateHz: 2_000_000,
      centerFrequencyHz: 100_000_000,
      calibrationStatus: 'user',
      dataType: 'ci8',
      calibratedLevelOffsetDb: -0.5,
      calibratedFrequencyOffsetHz: 8,
      referenceClock: {
        source: 'gpsdo',
        nominalFrequencyHz: 10_000_000,
        measuredPpm: 0.02
      }
    });

    expect(disclosure.frequency.state).toBe('calibrated');
    expect(disclosure.level.state).toBe('calibrated');
    expect(disclosure.timebase.state).toBe('external-disciplined');
    expect(disclosure.uncertaintyModel.uncertaintyUnknown).toBe(false);
    expect(disclosure.disclosureText.uiBadgeShort).toBe('Calibrated');
  });
});
