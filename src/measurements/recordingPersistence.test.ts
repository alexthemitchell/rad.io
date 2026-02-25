import { describe, expect, it } from 'vitest';
import {
  appendRecorderChunk,
  buildSigmfMetadataDraft,
  createAudioExport,
  createBookmark,
  createMemoryRecordingStore,
  createRecorderSession,
  createRecordingFromSession,
  createReproBundle,
  createStructuredAnnotation,
  createTrustStamp,
  createWorkspaceStateBundle,
  deterministicReplay,
  enforceRetentionPolicy,
  importIqInterchange,
  mergeAnnotations,
  quickTapExportFromRingBuffer,
  renderOfflineDeterministicDemod,
  type ReplayReproMetadata,
  type RecordingRecord,
  validateInteropRequiredMetadataChecklist,
  createIqInterchangeExport
} from './recordingPersistence';

const createManifest = (): ReplayReproMetadata => ({
  appVersion: '0.0.1',
  sourceType: 'MOCK',
  demodMode: 'NFM',
  sampleRateHz: 2_048_000,
  centerFrequencyHz: 162_400_000,
  tunedFrequencyHz: 162_400_000,
  ppmCorrection: 1.25,
  driftEstimateHzPerSec: 0.12,
  driftConfidence: 0.86,
  afcEnabled: true,
  lockState: 'locked',
  calibrationOffsetHz: 2,
  calibrationOffsetDb: -0.4,
  loOffsetHz: 1250,
  ifOffsetHz: -250,
  discontinuityTimeline: [
    {
      sequence: 4,
      sampleIndex: 8192,
      droppedSamples: 0,
      cause: 'retune'
    }
  ]
});

const createRecord = (): RecordingRecord => {
  let session = createRecorderSession({ chunkDurationMs: 1000, replayWindowMs: 3000 });
  session = appendRecorderChunk(session, new Uint8Array([128, 128, 129, 127]), new Float32Array([0.1, 0.2]), '2026-02-25T00:00:00.000Z');
  session = appendRecorderChunk(session, new Uint8Array([130, 126, 131, 125]), new Float32Array([0.3, 0.4]), '2026-02-25T00:00:01.000Z');

  const trustStamp = createTrustStamp({
    sessionGrade: 'measurement',
    calibrationState: 'calibrated',
    droppedSamples: 0,
    audioUnderruns: 0,
    rfChainAssumptions: ['direct-sample-path']
  });

  const annotation = createStructuredAnnotation({
    startMs: 0,
    endMs: 1200,
    centerFrequencyHz: 162_400_000,
    bandwidthHz: 12_500,
    tags: ['voice', 'weather'],
    note: 'NOAA weather burst'
  });

  const metadata = buildSigmfMetadataDraft({
    description: 'Phase 6.2 fixture',
    sampleRateHz: 2_048_000,
    centerFrequencyHz: 162_400_000,
    displayFrequencyHz: 162_400_000,
    ppmCorrection: 1.25,
    loOffsetHz: 1250,
    ifOffsetHz: -250,
    gainStages: { lna: 16, vga: 12 },
    rfChainSnapshot: 'antenna->lna->sdr',
    replay: createManifest(),
    trustStamp,
    annotations: [annotation]
  });

  const record = createRecordingFromSession({
    session,
    metadata,
    manifest: createManifest(),
    trustStamp,
    bookmarks: [createBookmark('NOAA', 162_400_000)],
    devicePreset: {
      id: 'preset-a',
      name: 'NOAA preset',
      sampleRateHz: 2_048_000,
      gains: { lna: 16 },
      ppmCorrection: 1.25,
      loOffsetHz: 1250,
      ifOffsetHz: -250
    }
  });

  return record;
};

describe('recordingPersistence', () => {
  it('builds SigMF metadata and enforces interop required metadata hard gate', () => {
    const record = createRecord();
    const checklist = validateInteropRequiredMetadataChecklist(record.metadata);
    expect(checklist.ok).toBe(true);
    expect(checklist.missing).toEqual([]);

    const broken = {
      ...record.metadata,
      captures: [{ ...record.metadata.captures[0], 'rad:rf_chain_snapshot': '' }]
    };
    const failed = validateInteropRequiredMetadataChecklist(broken);
    expect(failed.ok).toBe(false);
    expect(failed.missing).toContain('captures[0].rad:rf_chain_snapshot');
  });

  it('persists recordings in memory store and applies retention and quota policy', async () => {
    const store = createMemoryRecordingStore();
    const a = { ...createRecord(), id: 'rec-a', createdAtIso: '2026-02-20T00:00:00.000Z', expiresAtIso: '2026-02-24T00:00:00.000Z' };
    const b = { ...createRecord(), id: 'rec-b', createdAtIso: '2026-02-21T00:00:00.000Z' };
    const c = { ...createRecord(), id: 'rec-c', createdAtIso: '2026-02-22T00:00:00.000Z' };

    await store.putRecording(a);
    await store.putRecording(b);
    await store.putRecording(c);

    const retention = await enforceRetentionPolicy({
      store,
      maxRecordings: 1,
      maxBytes: 100000,
      nowIso: '2026-02-25T00:00:00.000Z'
    });

    expect(retention.deletedForExpiry).toContain('rec-a');
    const remaining = await store.listRecordings();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('rec-c');
  });

  it('supports instant replay ring buffer and quick tap export (post-DDC IQ + post-demod audio)', () => {
    let session = createRecorderSession({ chunkDurationMs: 1000, replayWindowMs: 2500 });
    session = appendRecorderChunk(session, new Uint8Array([1, 2, 3, 4]), new Float32Array([0.1]), '2026-02-25T00:00:00.000Z');
    session = appendRecorderChunk(session, new Uint8Array([5, 6, 7, 8]), new Float32Array([0.2]), '2026-02-25T00:00:01.000Z');
    session = appendRecorderChunk(session, new Uint8Array([9, 10, 11, 12]), new Float32Array([0.3]), '2026-02-25T00:00:02.000Z');

    expect(session.ringBufferChunks).toHaveLength(3);

    const metadata = createRecord().metadata;
    const tap = quickTapExportFromRingBuffer(session, metadata);
    expect(tap.postDdcIq).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    expect(tap.postDemodAudio).toEqual(new Float32Array([0.1, 0.2, 0.3]));
    expect(tap.metadataJson).toContain('core:sample_rate');
  });

  it('produces deterministic replay and offline deterministic demod render', () => {
    const record = createRecord();
    const replayA = deterministicReplay(record);
    const replayB = deterministicReplay(record);

    expect(replayA.digest).toBe(replayB.digest);
    expect(replayA.replayedIq).toEqual(replayB.replayedIq);
    expect(replayA.replayedAudio).toEqual(replayB.replayedAudio);

    const offline = renderOfflineDeterministicDemod(record);
    expect(offline.length).toBeGreaterThan(0);
    expect(offline[0]).toBeCloseTo(0);
  });

  it('exports standardized IQ profiles and imports interchange deterministically', () => {
    const record = createRecord();
    const cu8 = createIqInterchangeExport(record, 'cu8');
    const cs16 = createIqInterchangeExport(record, 'cs16_le');
    const cf32 = createIqInterchangeExport(record, 'cf32_le');

    expect(cu8.filename.endsWith('.cu8.iq')).toBe(true);
    expect(cs16.filename.endsWith('.cs16_le.iq')).toBe(true);
    expect(cf32.filename.endsWith('.cf32_le.iq')).toBe(true);

    const parsed = importIqInterchange({
      iqBytes: cs16.bytes,
      sidecarJson: cs16.metadataSidecarJson,
      expectedProfile: 'cs16_le'
    });

    expect(parsed.profile).toBe('cs16_le');
    expect(parsed.iqCi8.length).toBeGreaterThan(0);
  });

  it('creates audio exports for WAV and FLAC with metadata', () => {
    const samples = new Float32Array([0, 0.25, -0.5, 1, -1]);
    const wav = createAudioExport({
      filenameBase: 'audio-a',
      samples,
      sampleRateHz: 48_000,
      format: 'wav',
      metadata: { mode: 'NFM' }
    });
    const flac = createAudioExport({
      filenameBase: 'audio-b',
      samples,
      sampleRateHz: 48_000,
      format: 'flac',
      metadata: { mode: 'NFM' }
    });

    expect(wav.filename).toBe('audio-a.wav');
    expect(wav.bytes[0]).toBe('R'.charCodeAt(0));
    expect(flac.filename).toBe('audio-b.flac');
    expect(flac.bytes[0]).toBe('f'.charCodeAt(0));
  });

  it('creates repro manifest + one-click replay entrypoint + trust stamped scene bundle', () => {
    const record = createRecord();
    const bundle = createReproBundle({
      record,
      iqProfile: 'cf32_le',
      audioFormat: 'wav'
    });

    expect(bundle.manifestJson).toContain('recordingId');
    expect(bundle.replayEntrypointJson).toContain('launchHint');
    expect(bundle.sceneJson).toContain('pipelineGraphVersion');
    expect(bundle.sigmfMetaJson).toContain('rad:trust_stamp');
    expect(bundle.iqExport.profile).toBe('cf32_le');
  });

  it('handles workspace state import/export plus annotation merge and bookmarks/device presets', async () => {
    const store = createMemoryRecordingStore();
    const first = createStructuredAnnotation({
      startMs: 0,
      endMs: 100,
      centerFrequencyHz: 100,
      bandwidthHz: 10,
      tags: ['a'],
      note: 'first'
    });
    const second = { ...first, id: 'override', note: 'second' };
    const merged = mergeAnnotations([first], [second]);
    expect(merged).toHaveLength(2);

    const workspace = createWorkspaceStateBundle({
      vfos: [{ id: 'main', offsetHz: 0, enabled: true }],
      markers: [{ id: 'm1', frequencyHz: 100_000_000, label: 'M1' }],
      selectedBandPlan: 'na-vhf',
      calibrationProfiles: { default: { offsetHz: 3, offsetDb: -0.2 } },
      uiState: { zoom: 4, palette: 'professional', panelLayout: 'default' },
      bookmarks: [createBookmark('A', 100_000_000)],
      annotations: [first],
      devicePresets: [createRecord().devicePreset]
    });

    await store.putWorkspaceBundle(workspace);
    const loaded = await store.getWorkspaceBundle();
    expect(loaded?.schemaVersion).toBe(1);
    expect(loaded?.bookmarks).toHaveLength(1);
    expect(loaded?.devicePresets).toHaveLength(1);
  });
});

