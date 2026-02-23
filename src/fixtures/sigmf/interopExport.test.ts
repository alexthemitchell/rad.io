import { describe, expect, it } from 'vitest';
import { createKnownSignalFixtureLibrary } from './knownSignalFixtureLibrary';
import { createFixtureInteropExportBundle } from './interopExport';

const fnv1a32 = (bytes: Uint8Array): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
};

describe('createFixtureInteropExportBundle', () => {
  it('exports SigMF metadata, raw IQ sidecar, and WAV render deterministically', () => {
    const fixtures = createKnownSignalFixtureLibrary();
    const fixture = fixtures['nfm-tone-ci8-v1'];

    const exportA = createFixtureInteropExportBundle(fixture);
    const exportB = createFixtureInteropExportBundle(fixture);

    expect(exportA.sigmfMetaFilename).toBe('nfm-tone-ci8-v1.sigmf-meta');
    expect(exportA.sigmfDataFilename).toBe('nfm-tone-ci8-v1.sigmf-data');
    expect(exportA.wavFilename).toBe('nfm-tone-ci8-v1.wav');
    expect(exportA.sigmfMetaJson).toEqual(exportB.sigmfMetaJson);
    expect(exportA.rawIqSidecar).toEqual(exportB.rawIqSidecar);
    expect(exportA.wavAudioRender).toEqual(exportB.wavAudioRender);

    const parsedMeta = JSON.parse(exportA.sigmfMetaJson) as {
      global: {
        'core:sample_rate': number;
        'core:extensions': {
          'rad:time_alignment': unknown;
        };
      };
      captures: Array<{ 'core:frequency': number }>;
      annotations: Array<{ 'core:sample_count': number }>;
    };

    expect(parsedMeta.global['core:sample_rate']).toBe(fixture.metadata.sampleRateHz);
    expect(parsedMeta.global['core:extensions']['rad:time_alignment']).toBeDefined();
    expect(parsedMeta.captures[0]['core:frequency']).toBe(fixture.metadata.centerFrequencyHz);
    expect(parsedMeta.annotations[0]['core:sample_count']).toBe(fixture.iqData.length / 2);

    expect(exportA.rawIqSidecar.byteLength).toBe(fixture.iqData.byteLength);
    expect(exportA.wavAudioRender.byteLength).toBeGreaterThan(44);

    expect(fnv1a32(exportA.rawIqSidecar)).toBe(0x52038be8);
    expect(fnv1a32(exportA.wavAudioRender)).toBe(0x3d73ef2f);
  });
});
