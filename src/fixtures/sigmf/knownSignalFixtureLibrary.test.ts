import { describe, expect, it } from 'vitest';
import { createKnownSignalFixtureLibrary, type KnownSignalFixtureId } from './knownSignalFixtureLibrary';

const fnv1a32 = (bytes: Uint8Array): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
};

const REQUIRED_FIXTURES: KnownSignalFixtureId[] = [
  'fm-pilot-ci8-v1',
  'am-carrier-ci8-v1',
  'nfm-tone-ci8-v1',
  'noaa-wx-ci8-v1',
  'time-beacon-ci8-v1',
  'clean-tone-noise-ci8-v1',
  'mains-hum-ci8-v1',
  'dc-spike-ci8-v1',
  'impulsive-noise-ci8-v1'
];

describe('knownSignalFixtureLibrary', () => {
  it('contains required deterministic known-signal fixtures', () => {
    const fixtures = createKnownSignalFixtureLibrary();

    for (const fixtureId of REQUIRED_FIXTURES) {
      expect(fixtures[fixtureId]).toBeDefined();
      expect(fixtures[fixtureId].iqData.byteLength).toBe(8192);
      expect(fixtures[fixtureId].metadata.fixtureId).toBe(fixtureId);
      expect(fixtures[fixtureId].metadata.dataType).toBe('ci8');
    }
  });

  it('is deterministic across calls and carries calibrated metadata where present', () => {
    const fixtureSetA = createKnownSignalFixtureLibrary();
    const fixtureSetB = createKnownSignalFixtureLibrary();

    for (const fixtureId of Object.keys(fixtureSetA) as KnownSignalFixtureId[]) {
      expect(fixtureSetA[fixtureId].metadata).toEqual(fixtureSetB[fixtureId].metadata);
      expect(fixtureSetA[fixtureId].iqData).toEqual(fixtureSetB[fixtureId].iqData);
    }

    const fmPilot = fixtureSetA['fm-pilot-ci8-v1'].metadata;
    expect(fmPilot.calibratedLevelOffsetDb).toBeCloseTo(-0.3, 6);
    expect(fmPilot.calibratedFrequencyOffsetHz).toBeCloseTo(14.5, 6);
    expect(fmPilot.referenceClock?.source).toBe('gpsdo');
    expect(fmPilot.wallClock?.capturedAtUtc).toBe('2026-02-23T00:00:00.000Z');
  });

  it('locks fixture bytes with golden checksums', () => {
    const fixtures = createKnownSignalFixtureLibrary();

    const checksums: Record<KnownSignalFixtureId, number> = {
      'fm-pilot-ci8-v1': 0xa8e2f86a,
      'am-carrier-ci8-v1': 0xd2896fa8,
      'nfm-tone-ci8-v1': 0x52038be8,
      'noaa-wx-ci8-v1': 0xd032b07c,
      'time-beacon-ci8-v1': 0x95b49279,
      'clean-tone-noise-ci8-v1': 0x5bfc282a,
      'mains-hum-ci8-v1': 0xaa0f6cc9,
      'dc-spike-ci8-v1': 0x24d09159,
      'impulsive-noise-ci8-v1': 0x34cf11ed,
      'heterodyne-ci8-v1': 0x9d05d305
    };

    for (const fixtureId of Object.keys(checksums) as KnownSignalFixtureId[]) {
      expect(fnv1a32(fixtures[fixtureId].iqData)).toBe(checksums[fixtureId]);
    }
  });
});
