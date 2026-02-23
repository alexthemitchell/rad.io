import { createSigmfFixtureBundle, type SigmfFixtureBundle } from './schema';

const GOLDEN_TONE_METADATA = {
  fixtureSchemaVersion: 1,
  recordingSchemaVersion: 1,
  fixtureId: 'golden-tone-ci8-v1',
  title: 'Deterministic Complex Tone (CI8)',
  sampleRateHz: 2_000_000,
  centerFrequencyHz: 101_100_000,
  calibrationStatus: 'uncalibrated',
  dataType: 'ci8',
  description: 'Deterministic fixed-phase complex tone for replay regression.'
} as const;

export const generateDeterministicToneIq = (): Uint8Array => {
  const complexSampleCount = 4096;
  const cyclesPerBuffer = 64;
  const amplitude = 60;
  const iq = new Uint8Array(complexSampleCount * 2);

  for (let n = 0; n < complexSampleCount; n += 1) {
    const phase = (2 * Math.PI * cyclesPerBuffer * n) / complexSampleCount;
    const i = Math.round(Math.cos(phase) * amplitude);
    const q = Math.round(Math.sin(phase) * amplitude);

    iq[(n * 2)] = Math.max(0, Math.min(255, i + 128));
    iq[(n * 2) + 1] = Math.max(0, Math.min(255, q + 128));
  }

  return iq;
};

export const createGoldenToneFixtureBundle = (): SigmfFixtureBundle => {
  return createSigmfFixtureBundle(GOLDEN_TONE_METADATA, generateDeterministicToneIq());
};

export const goldenToneFixtureBundle = createGoldenToneFixtureBundle();
