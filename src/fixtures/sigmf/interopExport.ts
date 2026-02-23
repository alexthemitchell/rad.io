import type { SigmfFixtureBundle } from './schema';

export type FixtureInteropExportBundle = {
  fixtureId: string;
  sigmfMetaFilename: string;
  sigmfDataFilename: string;
  wavFilename: string;
  sigmfMetaJson: string;
  rawIqSidecar: Uint8Array;
  wavAudioRender: Uint8Array;
};

const sanitizeFileId = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
};

const ci8ToMonoAudio = (iqData: Uint8Array): Float32Array => {
  const sampleCount = iqData.length / 2;
  const out = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    out[i] = (iqData[i * 2] - 128) / 128;
  }

  return out;
};

const writeWavHeader = (target: DataView, sampleRateHz: number, sampleCount: number): void => {
  const byteRate = sampleRateHz * 2;
  const dataChunkBytes = sampleCount * 2;

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      target.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  target.setUint32(4, 36 + dataChunkBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  target.setUint32(16, 16, true);
  target.setUint16(20, 1, true);
  target.setUint16(22, 1, true);
  target.setUint32(24, sampleRateHz, true);
  target.setUint32(28, byteRate, true);
  target.setUint16(32, 2, true);
  target.setUint16(34, 16, true);
  writeAscii(36, 'data');
  target.setUint32(40, dataChunkBytes, true);
};

export const renderMonoWavAudio = (samples: Float32Array, sampleRateHz: number): Uint8Array => {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);

  writeWavHeader(view, sampleRateHz, samples.length);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcm = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    view.setInt16(44 + i * 2, pcm, true);
  }

  return out;
};

export const createFixtureInteropExportBundle = (fixture: SigmfFixtureBundle): FixtureInteropExportBundle => {
  const fileId = sanitizeFileId(fixture.metadata.fixtureId);
  const sigmfMetaFilename = `${fileId}.sigmf-meta`;
  const sigmfDataFilename = `${fileId}.sigmf-data`;
  const wavFilename = `${fileId}.wav`;

  const sigmfMeta = {
    global: {
      'core:version': '1.0.0',
      'core:datatype': fixture.metadata.dataType,
      'core:sample_rate': fixture.metadata.sampleRateHz,
      'core:hw': 'rad.io fixture-generator',
      'core:description': fixture.metadata.description ?? fixture.metadata.title,
      'core:extensions': {
        'rad:fixture_schema_version': fixture.metadata.fixtureSchemaVersion,
        'rad:recording_schema_version': fixture.metadata.recordingSchemaVersion,
        'rad:calibration_status': fixture.metadata.calibrationStatus,
        'rad:reference_clock': fixture.metadata.referenceClock ?? null,
        'rad:wall_clock': fixture.metadata.wallClock ?? null,
        'rad:time_alignment': fixture.metadata.timeAlignment ?? null
      }
    },
    captures: [
      {
        'core:sample_start': 0,
        'core:frequency': fixture.metadata.centerFrequencyHz,
        'core:datetime': fixture.metadata.wallClock?.capturedAtUtc ?? null
      }
    ],
    annotations: [
      {
        'core:sample_start': 0,
        'core:sample_count': fixture.iqData.length / 2,
        'core:label': fixture.metadata.fixtureId
      }
    ]
  };

  return {
    fixtureId: fixture.metadata.fixtureId,
    sigmfMetaFilename,
    sigmfDataFilename,
    wavFilename,
    sigmfMetaJson: JSON.stringify(sigmfMeta, null, 2),
    rawIqSidecar: new Uint8Array(fixture.iqData),
    wavAudioRender: renderMonoWavAudio(ci8ToMonoAudio(fixture.iqData), fixture.metadata.sampleRateHz)
  };
};
