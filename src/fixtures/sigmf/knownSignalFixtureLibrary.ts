import { createSigmfFixtureBundle, type SigmfFixtureBundle, type SigmfFixtureMetadata } from './schema';

export type KnownSignalFixtureId =
  | 'fm-pilot-ci8-v1'
  | 'am-carrier-ci8-v1'
  | 'nfm-tone-ci8-v1'
  | 'noaa-wx-ci8-v1'
  | 'time-beacon-ci8-v1'
  | 'clean-tone-noise-ci8-v1'
  | 'mains-hum-ci8-v1'
  | 'dc-spike-ci8-v1'
  | 'impulsive-noise-ci8-v1'
  | 'heterodyne-ci8-v1';

type LibraryEntry = {
  metadata: SigmfFixtureMetadata;
  iqData: Uint8Array;
};

const COMPLEX_SAMPLE_COUNT = 4096;

const clampUnit = (value: number): number => {
  return Math.max(-1, Math.min(1, value));
};

const clampCi8Byte = (value: number): number => {
  return Math.max(0, Math.min(255, value));
};

const encodeFloatIqToCi8 = (interleavedIq: Float32Array): Uint8Array => {
  const out = new Uint8Array(interleavedIq.length);

  for (let i = 0; i < interleavedIq.length; i += 1) {
    out[i] = clampCi8Byte(Math.round(clampUnit(interleavedIq[i]) * 127 + 128));
  }

  return out;
};

const lcg = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const writeTone = (
  interleavedIq: Float32Array,
  sampleRateHz: number,
  toneHz: number,
  amplitude: number,
  phaseStartRad = 0
): void => {
  for (let n = 0; n < COMPLEX_SAMPLE_COUNT; n += 1) {
    const phase = phaseStartRad + ((2 * Math.PI * toneHz) / sampleRateHz) * n;
    interleavedIq[n * 2] += Math.cos(phase) * amplitude;
    interleavedIq[(n * 2) + 1] += Math.sin(phase) * amplitude;
  }
};

const createFmTone = (
  sampleRateHz: number,
  audioToneHz: number,
  frequencyDeviationHz: number,
  amplitude: number
): Float32Array => {
  const iq = new Float32Array(COMPLEX_SAMPLE_COUNT * 2);
  let phase = 0;

  for (let n = 0; n < COMPLEX_SAMPLE_COUNT; n += 1) {
    const mod = Math.sin((2 * Math.PI * audioToneHz * n) / sampleRateHz);
    const instantaneousHz = frequencyDeviationHz * mod;
    phase += (2 * Math.PI * instantaneousHz) / sampleRateHz;

    iq[n * 2] = Math.cos(phase) * amplitude;
    iq[(n * 2) + 1] = Math.sin(phase) * amplitude;
  }

  return iq;
};

const createAmEnvelope = (
  sampleRateHz: number,
  audioToneHz: number,
  carrierLevel: number,
  modulationDepth: number,
  carrierOffsetHz: number
): Float32Array => {
  const iq = new Float32Array(COMPLEX_SAMPLE_COUNT * 2);

  for (let n = 0; n < COMPLEX_SAMPLE_COUNT; n += 1) {
    const envelope = carrierLevel + modulationDepth * Math.sin((2 * Math.PI * audioToneHz * n) / sampleRateHz);
    const carrierPhase = (2 * Math.PI * carrierOffsetHz * n) / sampleRateHz;

    iq[n * 2] = Math.cos(carrierPhase) * envelope;
    iq[(n * 2) + 1] = Math.sin(carrierPhase) * envelope;
  }

  return iq;
};

const addDeterministicNoise = (interleavedIq: Float32Array, seed: number, amplitude: number): void => {
  const random = lcg(seed);

  for (let i = 0; i < interleavedIq.length; i += 1) {
    const centered = (random() * 2) - 1;
    interleavedIq[i] += centered * amplitude;
  }
};

const addDcSpike = (
  interleavedIq: Float32Array,
  spikeCenterSample: number,
  spikeLengthSamples: number,
  spikeI: number,
  spikeQ: number
): void => {
  const start = Math.max(0, spikeCenterSample - Math.floor(spikeLengthSamples / 2));
  const end = Math.min(COMPLEX_SAMPLE_COUNT, start + spikeLengthSamples);

  for (let sample = start; sample < end; sample += 1) {
    interleavedIq[sample * 2] += spikeI;
    interleavedIq[(sample * 2) + 1] += spikeQ;
  }
};

const addImpulsiveNoise = (interleavedIq: Float32Array, seed: number, pulseCount: number, amplitude: number): void => {
  const random = lcg(seed);

  for (let i = 0; i < pulseCount; i += 1) {
    const sample = Math.floor(random() * COMPLEX_SAMPLE_COUNT);
    const width = 1 + Math.floor(random() * 4);

    for (let j = 0; j < width; j += 1) {
      const idx = sample + j;
      if (idx >= COMPLEX_SAMPLE_COUNT) {
        break;
      }

      const sign = random() > 0.5 ? 1 : -1;
      interleavedIq[idx * 2] += sign * amplitude;
      interleavedIq[(idx * 2) + 1] -= sign * (amplitude * 0.8);
    }
  }
};

const createFixtureMetadata = (
  fixtureId: KnownSignalFixtureId,
  title: string,
  sampleRateHz: number,
  centerFrequencyHz: number,
  calibrationStatus: SigmfFixtureMetadata['calibrationStatus'],
  description: string,
  extras?: Partial<SigmfFixtureMetadata>
): SigmfFixtureMetadata => {
  return {
    fixtureSchemaVersion: 2,
    recordingSchemaVersion: 1,
    fixtureId,
    title,
    sampleRateHz,
    centerFrequencyHz,
    calibrationStatus,
    dataType: 'ci8',
    description,
    ...extras
  };
};

const buildKnownSignalFixtures = (): Record<KnownSignalFixtureId, LibraryEntry> => {
  const wfmSampleRate = 228_000;
  const amSampleRate = 96_000;
  const nfmSampleRate = 192_000;
  const commonCenterHz = 101_100_000;

  const fmPilotIq = createFmTone(wfmSampleRate, 19_000, 75_000, 0.82);
  addDeterministicNoise(fmPilotIq, 0x0f1c_a5d3, 0.018);

  const amCarrierIq = createAmEnvelope(amSampleRate, 1_000, 0.72, 0.22, 2_500);
  addDeterministicNoise(amCarrierIq, 0x2e7b_1901, 0.01);

  const nfmToneIq = createFmTone(nfmSampleRate, 1_000, 2_500, 0.86);
  addDeterministicNoise(nfmToneIq, 0x9371_aa02, 0.012);

  const noaaWxIq = createFmTone(wfmSampleRate, 1_050, 4_200, 0.8);
  addDeterministicNoise(noaaWxIq, 0x4f2c_a013, 0.01);

  const timeBeaconIq = createAmEnvelope(amSampleRate, 1_000, 0.62, 0.2, 0);
  for (let n = 0; n < COMPLEX_SAMPLE_COUNT; n += 1) {
    const gate = n % 480 < 48 ? 1 : 0.35;
    timeBeaconIq[n * 2] *= gate;
    timeBeaconIq[(n * 2) + 1] *= gate;
  }
  addDeterministicNoise(timeBeaconIq, 0x0cda_1122, 0.008);

  const cleanToneNoiseIq = new Float32Array(COMPLEX_SAMPLE_COUNT * 2);
  writeTone(cleanToneNoiseIq, nfmSampleRate, 12_500, 0.78, Math.PI / 9);
  addDeterministicNoise(cleanToneNoiseIq, 0x7bcd_0f11, 0.022);

  const mainsHumIq = createAmEnvelope(amSampleRate, 60, 0.7, 0.2, 0);
  addDeterministicNoise(mainsHumIq, 0x4b1c_dd22, 0.008);

  const dcSpikeIq = new Float32Array(cleanToneNoiseIq);
  addDcSpike(dcSpikeIq, 1400, 12, 0.78, -0.62);

  const impulsiveNoiseIq = new Float32Array(cleanToneNoiseIq);
  addImpulsiveNoise(impulsiveNoiseIq, 0x83aa_44f1, 18, 0.85);

  const heterodyneIq = new Float32Array(COMPLEX_SAMPLE_COUNT * 2);
  writeTone(heterodyneIq, amSampleRate, 9_000, 0.48);
  writeTone(heterodyneIq, amSampleRate, 9_850, 0.42, Math.PI / 7);
  addDeterministicNoise(heterodyneIq, 0xa2ed_3001, 0.007);

  return {
    'fm-pilot-ci8-v1': {
      metadata: createFixtureMetadata(
        'fm-pilot-ci8-v1',
        'Deterministic WFM Pilot Fixture',
        wfmSampleRate,
        commonCenterHz,
        'factory',
        'WFM fixture with deterministic 19 kHz pilot and known calibration offsets.',
        {
          calibratedLevelOffsetDb: -0.3,
          calibratedFrequencyOffsetHz: 14.5,
          referenceClock: {
            source: 'gpsdo',
            nominalFrequencyHz: 10_000_000,
            measuredPpm: 0.04
          },
          wallClock: {
            capturedAtUtc: '2026-02-23T00:00:00.000Z',
            unixEpochMs: 1_772_809_600_000
          },
          timeAlignment: {
            wallClockAligned: true,
            alignmentUncertaintyMs: 1.5,
            referenceDiscipline: {
              source: '1pps',
              locked: true,
              measuredPpm: 0.04
            }
          }
        }
      ),
      iqData: encodeFloatIqToCi8(fmPilotIq)
    },
    'am-carrier-ci8-v1': {
      metadata: createFixtureMetadata(
        'am-carrier-ci8-v1',
        'Deterministic AM Carrier Fixture',
        amSampleRate,
        commonCenterHz,
        'factory',
        'AM carrier with deterministic 1 kHz envelope tone for envelope detector regressions.',
        {
          calibratedLevelOffsetDb: 0.15,
          calibratedFrequencyOffsetHz: -2.2
        }
      ),
      iqData: encodeFloatIqToCi8(amCarrierIq)
    },
    'nfm-tone-ci8-v1': {
      metadata: createFixtureMetadata(
        'nfm-tone-ci8-v1',
        'Deterministic NFM Tone Fixture',
        nfmSampleRate,
        commonCenterHz,
        'factory',
        'NFM fixture with 1 kHz modulation and 2.5 kHz deviation for narrowband demod checks.'
      ),
      iqData: encodeFloatIqToCi8(nfmToneIq)
    },
    'noaa-wx-ci8-v1': {
      metadata: createFixtureMetadata(
        'noaa-wx-ci8-v1',
        'Deterministic NOAA Weather Fixture',
        wfmSampleRate,
        162_550_000,
        'factory',
        'Narrow-FM weather-style fixture with deterministic 1050 Hz alert-like modulation.'
      ),
      iqData: encodeFloatIqToCi8(noaaWxIq)
    },
    'time-beacon-ci8-v1': {
      metadata: createFixtureMetadata(
        'time-beacon-ci8-v1',
        'Deterministic Time Beacon Fixture',
        amSampleRate,
        5_000_000,
        'factory',
        'AM-style beacon clip with deterministic gated tone bursts for timing/lock tests.'
      ),
      iqData: encodeFloatIqToCi8(timeBeaconIq)
    },
    'clean-tone-noise-ci8-v1': {
      metadata: createFixtureMetadata(
        'clean-tone-noise-ci8-v1',
        'Deterministic Clean Tone In Noise',
        nfmSampleRate,
        commonCenterHz,
        'uncalibrated',
        'Single clean complex tone in deterministic additive noise for baseline SNR checks.'
      ),
      iqData: encodeFloatIqToCi8(cleanToneNoiseIq)
    },
    'mains-hum-ci8-v1': {
      metadata: createFixtureMetadata(
        'mains-hum-ci8-v1',
        'Deterministic Mains Hum Fixture',
        amSampleRate,
        commonCenterHz,
        'uncalibrated',
        'AM-style fixture with deterministic 60 Hz hum profile for interference mitigation tests.'
      ),
      iqData: encodeFloatIqToCi8(mainsHumIq)
    },
    'dc-spike-ci8-v1': {
      metadata: createFixtureMetadata(
        'dc-spike-ci8-v1',
        'Deterministic DC Spike Fixture',
        nfmSampleRate,
        commonCenterHz,
        'uncalibrated',
        'Clean tone in noise with an embedded deterministic DC spike event.'
      ),
      iqData: encodeFloatIqToCi8(dcSpikeIq)
    },
    'impulsive-noise-ci8-v1': {
      metadata: createFixtureMetadata(
        'impulsive-noise-ci8-v1',
        'Deterministic Impulsive Noise Fixture',
        nfmSampleRate,
        commonCenterHz,
        'uncalibrated',
        'Clean-tone baseline with deterministic impulsive bursts for mitigation regressions.'
      ),
      iqData: encodeFloatIqToCi8(impulsiveNoiseIq)
    },
    'heterodyne-ci8-v1': {
      metadata: createFixtureMetadata(
        'heterodyne-ci8-v1',
        'Deterministic Single-Tone Heterodyne Fixture',
        amSampleRate,
        commonCenterHz,
        'uncalibrated',
        'Two nearby tones with a deterministic beat frequency for heterodyne interference checks.'
      ),
      iqData: encodeFloatIqToCi8(heterodyneIq)
    }
  };
};

export const createKnownSignalFixtureLibrary = (): Record<KnownSignalFixtureId, SigmfFixtureBundle> => {
  const rawFixtures = buildKnownSignalFixtures();

  return {
    'fm-pilot-ci8-v1': createSigmfFixtureBundle(rawFixtures['fm-pilot-ci8-v1'].metadata, rawFixtures['fm-pilot-ci8-v1'].iqData),
    'am-carrier-ci8-v1': createSigmfFixtureBundle(rawFixtures['am-carrier-ci8-v1'].metadata, rawFixtures['am-carrier-ci8-v1'].iqData),
    'nfm-tone-ci8-v1': createSigmfFixtureBundle(rawFixtures['nfm-tone-ci8-v1'].metadata, rawFixtures['nfm-tone-ci8-v1'].iqData),
    'noaa-wx-ci8-v1': createSigmfFixtureBundle(rawFixtures['noaa-wx-ci8-v1'].metadata, rawFixtures['noaa-wx-ci8-v1'].iqData),
    'time-beacon-ci8-v1': createSigmfFixtureBundle(rawFixtures['time-beacon-ci8-v1'].metadata, rawFixtures['time-beacon-ci8-v1'].iqData),
    'clean-tone-noise-ci8-v1': createSigmfFixtureBundle(rawFixtures['clean-tone-noise-ci8-v1'].metadata, rawFixtures['clean-tone-noise-ci8-v1'].iqData),
    'mains-hum-ci8-v1': createSigmfFixtureBundle(rawFixtures['mains-hum-ci8-v1'].metadata, rawFixtures['mains-hum-ci8-v1'].iqData),
    'dc-spike-ci8-v1': createSigmfFixtureBundle(rawFixtures['dc-spike-ci8-v1'].metadata, rawFixtures['dc-spike-ci8-v1'].iqData),
    'impulsive-noise-ci8-v1': createSigmfFixtureBundle(rawFixtures['impulsive-noise-ci8-v1'].metadata, rawFixtures['impulsive-noise-ci8-v1'].iqData),
    'heterodyne-ci8-v1': createSigmfFixtureBundle(rawFixtures['heterodyne-ci8-v1'].metadata, rawFixtures['heterodyne-ci8-v1'].iqData)
  };
};

export const knownSignalFixtureLibrary = createKnownSignalFixtureLibrary();
