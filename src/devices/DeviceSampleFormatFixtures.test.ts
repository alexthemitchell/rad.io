import { describe, expect, it } from 'vitest';
import { HackRFDevice } from './HackRFDevice';
import { MockDevice } from './MockDevice';
import { FileDevice } from './FileDevice';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';
import { normalizeInterleavedIq, type SupportedSampleFormat } from './SampleFormatContract';

type SampleFixture = {
  name: string;
  makeDevice: () => {
    getCapabilityModel: () => {
      sampleFormat: {
        sampleType: 'u8' | 'i8' | 'i16' | 'f32' | 'unknown';
        iqOrder: 'iq' | 'qi' | 'unknown';
        interleaved: boolean;
      };
    };
  };
  format: SupportedSampleFormat;
  input: Uint8Array | Int8Array;
  expectedNormalized: number[];
};

const fixtures: SampleFixture[] = [
  {
    name: 'HackRF CI8 fixture',
    makeDevice: () => new HackRFDevice(),
    format: 'i8-iq-interleaved',
    input: new Int8Array([-128, 0, 127, -64]),
    expectedNormalized: [-1, 0, 127 / 128, -0.5]
  },
  {
    name: 'MockDevice CI8 fixture',
    makeDevice: () => new MockDevice(),
    format: 'i8-iq-interleaved',
    input: new Int8Array([-96, 32, 0, 64]),
    expectedNormalized: [-0.75, 0.25, 0, 0.5]
  },
  {
    name: 'FileDevice CU8 fixture',
    makeDevice: () => new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 128 }),
    format: 'u8-iq-interleaved',
    input: new Uint8Array([0, 128, 255, 64]),
    expectedNormalized: [-1, 0, 127 / 128, -0.5]
  }
];

describe('Per-device sample-format conformance fixtures', () => {
  it.each(fixtures)('$name declares explicit interleaved IQ format that matches fixture normalization', ({ makeDevice, format, input, expectedNormalized }) => {
    const capability = makeDevice().getCapabilityModel();

    expect(capability.sampleFormat.iqOrder).toBe('iq');
    expect(capability.sampleFormat.interleaved).toBe(true);

    const normalized = normalizeInterleavedIq(input, format);
    expect(normalized.format).toBe(format);
    expect(Array.from(normalized.normalizedIq)).toHaveLength(input.length);

    expectedNormalized.forEach((expected, index) => {
      expect(normalized.normalizedIq[index]).toBeCloseTo(expected, 6);
    });
  });

  it('keeps IQ swap/invert capability declarations consistent with each driver contract', () => {
    const hackrf = new HackRFDevice().getCapabilityModel();
    const mock = new MockDevice().getCapabilityModel();
    const file = new FileDevice(createGoldenToneFixtureBundle(), { chunkSizeBytes: 256 }).getCapabilityModel();

    expect(hackrf.sampleFormat.swapIQSupported).toBe('unsupported');
    expect(hackrf.sampleFormat.invertIQSupported).toBe('unsupported');

    expect(mock.sampleFormat.swapIQSupported).toBe('supported');
    expect(mock.sampleFormat.invertIQSupported).toBe('supported');

    expect(file.sampleFormat.swapIQSupported).toBe('supported');
    expect(file.sampleFormat.invertIQSupported).toBe('supported');
  });
});
