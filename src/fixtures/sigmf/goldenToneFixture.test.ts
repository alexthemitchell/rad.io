import { describe, expect, it } from 'vitest';
import { createGoldenToneFixtureBundle } from './goldenToneFixture';

const fnv1a32 = (bytes: Uint8Array): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
};

describe('goldenToneFixture', () => {
  it('generates deterministic metadata and IQ bytes', () => {
    const fixtureA = createGoldenToneFixtureBundle();
    const fixtureB = createGoldenToneFixtureBundle();

    expect(fixtureA.metadata.sampleRateHz).toBe(2_000_000);
    expect(fixtureA.metadata.centerFrequencyHz).toBe(101_100_000);
    expect(fixtureA.metadata.calibrationStatus).toBe('uncalibrated');

    expect(fixtureA.iqData.byteLength).toBe(8192);
    expect(fixtureA.iqData).toEqual(fixtureB.iqData);

    // Golden checksum to catch accidental fixture drift.
    expect(fnv1a32(fixtureA.iqData)).toBe(0x17588bc5);
  });
});
