import { renderMonoWavAudio } from '../fixtures/sigmf/interopExport';

const RECORDING_DB_NAME = 'rad-io-recordings';
const RECORDING_DB_VERSION = 1;
const RECORDINGS_STORE = 'recordings';
const WORKSPACE_STORE = 'workspace';
const MAX_DEFAULT_ANNOTATIONS = 128;

export type SessionTrustGrade = 'measurement' | 'listening' | 'degraded';

export type TrustStamp = {
  schemaVersion: 1;
  sessionGrade: SessionTrustGrade;
  calibrationState: 'uncalibrated' | 'approximate' | 'calibrated';
  droppedSamples: number;
  audioUnderruns: number;
  rfChainAssumptions: string[];
  stampedAtIso: string;
};

export type StructuredAnnotation = {
  id: string;
  createdAtIso: string;
  startMs: number;
  endMs: number;
  centerFrequencyHz: number;
  bandwidthHz: number;
  tags: string[];
  note: string;
};

export type ReplayReproMetadata = {
  appVersion: string;
  sourceType: string;
  demodMode: string;
  sampleRateHz: number;
  centerFrequencyHz: number;
  tunedFrequencyHz: number;
  ppmCorrection: number;
  driftEstimateHzPerSec: number;
  driftConfidence: number;
  afcEnabled: boolean;
  lockState: string;
  calibrationOffsetHz?: number;
  calibrationOffsetDb?: number;
  loOffsetHz?: number;
  ifOffsetHz?: number;
  discontinuityTimeline: Array<{
    sequence: number;
    sampleIndex: number;
    droppedSamples: number;
    cause: string;
    wallClockMs?: number;
  }>;
};

export type SigmfEditableMetadata = {
  global: {
    [key: string]: unknown;
    'core:datatype': 'ci8' | 'cs16_le' | 'cf32_le' | 'cu8';
    'core:sample_rate': number;
    'core:description': string;
    'core:extensions': {
      [key: string]: unknown;
      'rad:recording_schema_version': number;
      'rad:trust_stamp': TrustStamp;
      'rad:replay': ReplayReproMetadata;
      'rad:rf_scene': {
        pipelineGraphVersion: string;
        analyzerStateVersion: string;
      };
    };
  };
  captures: Array<{
    'core:sample_start': number;
    'core:frequency': number;
    'core:datetime': string;
    'rad:display_frequency_hz': number;
    'rad:ppm_correction': number;
    'rad:lo_offset_hz': number;
    'rad:if_offset_hz': number;
    'rad:gain_stages': Record<string, number>;
    'rad:rf_chain_snapshot': string;
  }>;
  annotations: Array<{
    'core:sample_start': number;
    'core:sample_count': number;
    'core:label': string;
    'rad:tags': string[];
    'rad:note': string;
    'rad:frequency_hz': number;
    'rad:bandwidth_hz': number;
  }>;
};

export type RecordingChunk = {
  chunkIndex: number;
  recordedAtIso: string;
  iqDataCi8: Uint8Array;
  audioDataF32: Float32Array;
};

export type RecordingRecord = {
  id: string;
  createdAtIso: string;
  updatedAtIso: string;
  expiresAtIso?: string;
  metadata: SigmfEditableMetadata;
  manifest: ReplayReproMetadata;
  trustStamp: TrustStamp;
  bookmarks: Array<{ id: string; label: string; frequencyHz: number; createdAtIso: string }>;
  devicePreset: {
    id: string;
    name: string;
    sampleRateHz: number;
    gains: Record<string, number>;
    ppmCorrection: number;
    loOffsetHz: number;
    ifOffsetHz: number;
    vfoPresetRef?: string;
  };
  chunks: RecordingChunk[];
  chunkDurationMs: number;
  scheduledStartIso?: string;
};

export type WorkspaceStateBundle = {
  schemaVersion: 1;
  exportedAtIso: string;
  vfos: Array<{ id: string; offsetHz: number; enabled: boolean }>;
  markers: Array<{ id: string; frequencyHz: number; label: string }>;
  selectedBandPlan: string;
  calibrationProfiles: Record<string, { offsetHz: number; offsetDb: number }>;
  uiState: {
    zoom: number;
    palette: string;
    panelLayout: string;
  };
  bookmarks: RecordingRecord['bookmarks'];
  annotations: StructuredAnnotation[];
  devicePresets: RecordingRecord['devicePreset'][];
};

export type InterchangeIqProfile = 'cf32_le' | 'cs16_le' | 'cu8';

export type IqInterchangeExport = {
  filename: string;
  bytes: Uint8Array;
  metadataSidecarJson: string;
  profile: InterchangeIqProfile;
};

export type AudioExportFormat = 'wav' | 'flac';

export type AudioExport = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  metadataJson: string;
};

export type ReproBundle = {
  manifestJson: string;
  replayEntrypointJson: string;
  sceneJson: string;
  sigmfMetaJson: string;
  iqExport: IqInterchangeExport;
  audioExport: AudioExport;
};

export type StorageQuotaSnapshot = {
  quotaBytes: number;
  usageBytes: number;
  availableBytes: number;
  percentUsed: number;
};

export type RecorderSession = {
  id: string;
  startedAtIso: string;
  chunkDurationMs: number;
  scheduledStartIso?: string;
  chunks: RecordingChunk[];
  ringBufferChunks: RecordingChunk[];
  replayWindowMs: number;
};

export type RecordingStore = {
  listRecordings: () => Promise<RecordingRecord[]>;
  putRecording: (record: RecordingRecord) => Promise<void>;
  getRecording: (id: string) => Promise<RecordingRecord | null>;
  deleteRecording: (id: string) => Promise<void>;
  putWorkspaceBundle: (bundle: WorkspaceStateBundle) => Promise<void>;
  getWorkspaceBundle: () => Promise<WorkspaceStateBundle | null>;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const cloneBytes = (value: Uint8Array): Uint8Array => new Uint8Array(value);
const cloneFloat = (value: Float32Array): Float32Array => new Float32Array(value);

const makeId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const ci8IToFloatMono = (iqDataCi8: Uint8Array): Float32Array => {
  const out = new Float32Array(Math.floor(iqDataCi8.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = (iqDataCi8[i * 2] - 128) / 128;
  }
  return out;
};

const concatUint8 = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const concatFloat32 = (parts: Float32Array[]): Float32Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const textToBytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const createFlacDeterministicStub = (samples: Float32Array, metadataJson: string): Uint8Array => {
  const pcm16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = clamp(samples[i], -1, 1);
    pcm16[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }

  const head = textToBytes('fLaC');
  const meta = textToBytes(metadataJson);
  const pcmBytes = new Uint8Array(pcm16.buffer.slice(0));
  return concatUint8([head, meta, pcmBytes]);
};

export const createMemoryRecordingStore = (): RecordingStore => {
  const recordings = new Map<string, RecordingRecord>();
  let workspace: WorkspaceStateBundle | null = null;

  return {
    listRecordings: async () => Array.from(recordings.values()).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
    putRecording: async (record) => {
      recordings.set(record.id, record);
    },
    getRecording: async (id) => recordings.get(id) ?? null,
    deleteRecording: async (id) => {
      recordings.delete(id);
    },
    putWorkspaceBundle: async (bundle) => {
      workspace = bundle;
    },
    getWorkspaceBundle: async () => workspace
  };
};

const idbRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
};

const createIndexedDbStore = (): RecordingStore => {
  const openPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(RECORDING_DB_NAME, RECORDING_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
        db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });

  const withStore = async <T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
    const db = await openPromise;
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const value = await run(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
    });
    return value;
  };

  return {
    listRecordings: async () => withStore(RECORDINGS_STORE, 'readonly', async (store) => {
      const all = await idbRequest(store.getAll() as IDBRequest<RecordingRecord[]>);
      return all.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    }),
    putRecording: async (record) => {
      await withStore(RECORDINGS_STORE, 'readwrite', async (store) => {
        await idbRequest(store.put(record));
      });
    },
    getRecording: async (id) => withStore(RECORDINGS_STORE, 'readonly', async (store) => {
      const result = await idbRequest(store.get(id) as IDBRequest<RecordingRecord | undefined>);
      return result ?? null;
    }),
    deleteRecording: async (id) => {
      await withStore(RECORDINGS_STORE, 'readwrite', async (store) => {
        await idbRequest(store.delete(id));
      });
    },
    putWorkspaceBundle: async (bundle) => {
      await withStore(WORKSPACE_STORE, 'readwrite', async (store) => {
        await idbRequest(store.put({ ...bundle, id: 'workspace-v1' }));
      });
    },
    getWorkspaceBundle: async () => withStore(WORKSPACE_STORE, 'readonly', async (store) => {
      const result = await idbRequest(store.get('workspace-v1') as IDBRequest<(WorkspaceStateBundle & { id: string }) | undefined>);
      if (!result) {
        return null;
      }
      const { id, ...rest } = result;
      void id;
      return rest;
    })
  };
};

export const createBrowserRecordingStore = (): RecordingStore => {
  if (typeof indexedDB !== 'undefined') {
    return createIndexedDbStore();
  }
  return createMemoryRecordingStore();
};

export const createRecorderSession = (input?: {
  chunkDurationMs?: number;
  replayWindowMs?: number;
  scheduledStartIso?: string;
}): RecorderSession => ({
  id: makeId('rec'),
  startedAtIso: new Date().toISOString(),
  chunkDurationMs: Math.max(500, Math.round(input?.chunkDurationMs ?? 5_000)),
  scheduledStartIso: input?.scheduledStartIso,
  chunks: [],
  ringBufferChunks: [],
  replayWindowMs: Math.max(2_000, Math.round(input?.replayWindowMs ?? 15_000))
});

export const appendRecorderChunk = (
  session: RecorderSession,
  iqDataCi8: Uint8Array,
  audioDataF32: Float32Array,
  nowIso = new Date().toISOString()
): RecorderSession => {
  const nextChunk: RecordingChunk = {
    chunkIndex: session.chunks.length,
    recordedAtIso: nowIso,
    iqDataCi8: cloneBytes(iqDataCi8),
    audioDataF32: cloneFloat(audioDataF32)
  };

  const nextChunks = [...session.chunks, nextChunk];
  const maxRingChunks = Math.max(1, Math.ceil(session.replayWindowMs / session.chunkDurationMs));
  const nextRing = [...session.ringBufferChunks, nextChunk].slice(-maxRingChunks);

  return {
    ...session,
    chunks: nextChunks,
    ringBufferChunks: nextRing
  };
};

export const createTrustStamp = (input: {
  sessionGrade: SessionTrustGrade;
  calibrationState: TrustStamp['calibrationState'];
  droppedSamples: number;
  audioUnderruns: number;
  rfChainAssumptions: string[];
  stampedAtIso?: string;
}): TrustStamp => ({
  schemaVersion: 1,
  sessionGrade: input.sessionGrade,
  calibrationState: input.calibrationState,
  droppedSamples: Math.max(0, Math.round(input.droppedSamples)),
  audioUnderruns: Math.max(0, Math.round(input.audioUnderruns)),
  rfChainAssumptions: [...input.rfChainAssumptions],
  stampedAtIso: input.stampedAtIso ?? new Date().toISOString()
});

export const buildSigmfMetadataDraft = (input: {
  description: string;
  sampleRateHz: number;
  centerFrequencyHz: number;
  displayFrequencyHz: number;
  ppmCorrection: number;
  loOffsetHz: number;
  ifOffsetHz: number;
  gainStages: Record<string, number>;
  rfChainSnapshot: string;
  replay: ReplayReproMetadata;
  trustStamp: TrustStamp;
  annotations?: StructuredAnnotation[];
}): SigmfEditableMetadata => {
  const annotations = (input.annotations ?? []).slice(0, MAX_DEFAULT_ANNOTATIONS);

  return {
    global: {
      'core:datatype': 'ci8',
      'core:sample_rate': input.sampleRateHz,
      'core:description': input.description,
      'core:extensions': {
        'rad:recording_schema_version': 1,
        'rad:trust_stamp': input.trustStamp,
        'rad:replay': input.replay,
        'rad:rf_scene': {
          pipelineGraphVersion: 'rad-io-pipeline.v1',
          analyzerStateVersion: 'rad-io-analyzer.v1'
        }
      }
    },
    captures: [
      {
        'core:sample_start': 0,
        'core:frequency': input.centerFrequencyHz,
        'core:datetime': new Date().toISOString(),
        'rad:display_frequency_hz': input.displayFrequencyHz,
        'rad:ppm_correction': input.ppmCorrection,
        'rad:lo_offset_hz': input.loOffsetHz,
        'rad:if_offset_hz': input.ifOffsetHz,
        'rad:gain_stages': { ...input.gainStages },
        'rad:rf_chain_snapshot': input.rfChainSnapshot
      }
    ],
    annotations: annotations.map((annotation) => ({
      'core:sample_start': Math.max(0, Math.round(annotation.startMs)),
      'core:sample_count': Math.max(0, Math.round(annotation.endMs - annotation.startMs)),
      'core:label': annotation.tags[0] ?? 'annotation',
      'rad:tags': [...annotation.tags],
      'rad:note': annotation.note,
      'rad:frequency_hz': annotation.centerFrequencyHz,
      'rad:bandwidth_hz': annotation.bandwidthHz
    }))
  };
};

export const validateInteropRequiredMetadataChecklist = (metadata: SigmfEditableMetadata): { ok: boolean; missing: string[] } => {
  const missing: string[] = [];

  if (!isFiniteNumber(metadata.global['core:sample_rate']) || metadata.global['core:sample_rate'] <= 0) {
    missing.push('core:sample_rate');
  }

  const capture = metadata.captures[0];
  if (!capture) {
    missing.push('captures[0]');
  } else {
    if (!isFiniteNumber(capture['core:frequency']) || capture['core:frequency'] <= 0) {
      missing.push('captures[0].core:frequency');
    }
    if (!isFiniteNumber(capture['rad:display_frequency_hz'])) {
      missing.push('captures[0].rad:display_frequency_hz');
    }
    if (!isFiniteNumber(capture['rad:ppm_correction'])) {
      missing.push('captures[0].rad:ppm_correction');
    }
    if (!isFiniteNumber(capture['rad:lo_offset_hz'])) {
      missing.push('captures[0].rad:lo_offset_hz');
    }
    if (!isFiniteNumber(capture['rad:if_offset_hz'])) {
      missing.push('captures[0].rad:if_offset_hz');
    }
    if (typeof capture['rad:rf_chain_snapshot'] !== 'string' || capture['rad:rf_chain_snapshot'].trim().length === 0) {
      missing.push('captures[0].rad:rf_chain_snapshot');
    }
    if (typeof capture['rad:gain_stages'] !== 'object' || capture['rad:gain_stages'] === null) {
      missing.push('captures[0].rad:gain_stages');
    }
  }

  const extensions = metadata.global['core:extensions'];
  if (!extensions || typeof extensions !== 'object') {
    missing.push('global.core:extensions');
  } else {
    const typedExt = extensions as SigmfEditableMetadata['global']['core:extensions'];
    if (!typedExt['rad:trust_stamp']) {
      missing.push('global.core:extensions.rad:trust_stamp');
    }
    if (!typedExt['rad:replay']) {
      missing.push('global.core:extensions.rad:replay');
    }
    if (!typedExt['rad:rf_scene']) {
      missing.push('global.core:extensions.rad:rf_scene');
    }
  }

  return {
    ok: missing.length === 0,
    missing
  };
};

export const updateSigmfMetadata = (metadata: SigmfEditableMetadata, patch: Partial<SigmfEditableMetadata>): SigmfEditableMetadata => {
  return {
    ...metadata,
    ...patch,
    global: {
      ...metadata.global,
      ...patch.global,
      'core:extensions': {
        ...metadata.global['core:extensions'],
        ...(patch.global?.['core:extensions'] ?? {})
      }
    },
    captures: patch.captures ?? metadata.captures,
    annotations: patch.annotations ?? metadata.annotations
  };
};

export const createRecordingFromSession = (input: {
  session: RecorderSession;
  metadata: SigmfEditableMetadata;
  manifest: ReplayReproMetadata;
  trustStamp: TrustStamp;
  bookmarks: RecordingRecord['bookmarks'];
  devicePreset: RecordingRecord['devicePreset'];
  expiresAtIso?: string;
}): RecordingRecord => {
  const nowIso = new Date().toISOString();
  return {
    id: input.session.id,
    createdAtIso: input.session.startedAtIso,
    updatedAtIso: nowIso,
    expiresAtIso: input.expiresAtIso,
    metadata: input.metadata,
    manifest: input.manifest,
    trustStamp: input.trustStamp,
    bookmarks: [...input.bookmarks],
    devicePreset: input.devicePreset,
    chunks: input.session.chunks.map((chunk) => ({
      ...chunk,
      iqDataCi8: cloneBytes(chunk.iqDataCi8),
      audioDataF32: cloneFloat(chunk.audioDataF32)
    })),
    chunkDurationMs: input.session.chunkDurationMs,
    scheduledStartIso: input.session.scheduledStartIso
  };
};

export const quickTapExportFromRingBuffer = (session: RecorderSession, metadata: SigmfEditableMetadata): {
  postDdcIq: Uint8Array;
  postDemodAudio: Float32Array;
  metadataJson: string;
} => {
  const iq = concatUint8(session.ringBufferChunks.map((chunk) => chunk.iqDataCi8));
  const audio = concatFloat32(session.ringBufferChunks.map((chunk) => chunk.audioDataF32));
  return {
    postDdcIq: iq,
    postDemodAudio: audio,
    metadataJson: JSON.stringify(metadata, null, 2)
  };
};

export const deterministicReplay = (record: RecordingRecord): {
  replayedIq: Uint8Array;
  replayedAudio: Float32Array;
  digest: string;
} => {
  const iq = concatUint8(record.chunks.map((chunk) => chunk.iqDataCi8));
  const audio = concatFloat32(record.chunks.map((chunk) => chunk.audioDataF32));

  let hash = 2166136261;
  for (let i = 0; i < iq.length; i += 1) {
    hash ^= iq[i];
    hash = Math.imul(hash, 16777619);
  }

  return {
    replayedIq: iq,
    replayedAudio: audio,
    digest: `0x${(hash >>> 0).toString(16).padStart(8, '0')}`
  };
};

export const renderOfflineDeterministicDemod = (record: RecordingRecord): Float32Array => {
  const iq = concatUint8(record.chunks.map((chunk) => chunk.iqDataCi8));
  return ci8IToFloatMono(iq);
};

const convertCi8ToCs16Le = (input: Uint8Array): Uint8Array => {
  const out = new Uint8Array(input.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const value = (input[i] - 128) / 128;
    const pcm = value < 0 ? Math.round(value * 32768) : Math.round(value * 32767);
    view.setInt16(i * 2, pcm, true);
  }
  return out;
};

const convertCi8ToCf32Le = (input: Uint8Array): Uint8Array => {
  const out = new Uint8Array(input.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < input.length; i += 1) {
    view.setFloat32(i * 4, (input[i] - 128) / 128, true);
  }
  return out;
};

export const createIqInterchangeExport = (record: RecordingRecord, profile: InterchangeIqProfile): IqInterchangeExport => {
  const iqCi8 = concatUint8(record.chunks.map((chunk) => chunk.iqDataCi8));
  let bytes: Uint8Array;

  if (profile === 'cu8') {
    bytes = iqCi8;
  } else if (profile === 'cs16_le') {
    bytes = convertCi8ToCs16Le(iqCi8);
  } else {
    bytes = convertCi8ToCf32Le(iqCi8);
  }

  return {
    filename: `${record.id}.${profile}.iq`,
    bytes,
    profile,
    metadataSidecarJson: JSON.stringify({
      schemaVersion: 1,
      profile,
      centerFrequencyHz: record.metadata.captures[0]?.['core:frequency'] ?? 0,
      sampleRateHz: record.metadata.global['core:sample_rate'],
      trustStamp: record.trustStamp,
      replay: record.manifest
    }, null, 2)
  };
};

export const importIqInterchange = (input: {
  iqBytes: Uint8Array;
  sidecarJson: string;
  expectedProfile?: InterchangeIqProfile;
}): {
  profile: InterchangeIqProfile;
  iqCi8: Uint8Array;
  sidecar: Record<string, unknown>;
} => {
  const sidecar = JSON.parse(input.sidecarJson) as Record<string, unknown>;
  const profile = (sidecar.profile as InterchangeIqProfile | undefined) ?? input.expectedProfile ?? 'cu8';

  if (profile !== 'cu8' && profile !== 'cs16_le' && profile !== 'cf32_le') {
    throw new Error('Unsupported IQ profile in sidecar.');
  }

  if (input.expectedProfile && input.expectedProfile !== profile) {
    throw new Error('IQ profile mismatch between sidecar and expected profile.');
  }

  let iqCi8: Uint8Array;
  if (profile === 'cu8') {
    iqCi8 = cloneBytes(input.iqBytes);
  } else if (profile === 'cs16_le') {
    const view = new DataView(input.iqBytes.buffer, input.iqBytes.byteOffset, input.iqBytes.byteLength);
    const out = new Uint8Array(Math.floor(input.iqBytes.byteLength / 2));
    for (let i = 0; i < out.length; i += 1) {
      const value = view.getInt16(i * 2, true) / 32768;
      out[i] = clamp(Math.round((value + 1) * 127.5), 0, 255);
    }
    iqCi8 = out;
  } else {
    const view = new DataView(input.iqBytes.buffer, input.iqBytes.byteOffset, input.iqBytes.byteLength);
    const out = new Uint8Array(Math.floor(input.iqBytes.byteLength / 4));
    for (let i = 0; i < out.length; i += 1) {
      const value = view.getFloat32(i * 4, true);
      out[i] = clamp(Math.round((value + 1) * 127.5), 0, 255);
    }
    iqCi8 = out;
  }

  return {
    profile,
    iqCi8,
    sidecar
  };
};

export const createAudioExport = (input: {
  filenameBase: string;
  samples: Float32Array;
  sampleRateHz: number;
  format: AudioExportFormat;
  metadata: Record<string, unknown>;
}): AudioExport => {
  const metadataJson = JSON.stringify(input.metadata, null, 2);
  if (input.format === 'wav') {
    return {
      filename: `${input.filenameBase}.wav`,
      mimeType: 'audio/wav',
      bytes: renderMonoWavAudio(input.samples, input.sampleRateHz),
      metadataJson
    };
  }

  return {
    filename: `${input.filenameBase}.flac`,
    mimeType: 'audio/flac',
    bytes: createFlacDeterministicStub(input.samples, metadataJson),
    metadataJson
  };
};

export const createReproBundle = (input: {
  record: RecordingRecord;
  iqProfile: InterchangeIqProfile;
  audioFormat: AudioExportFormat;
}): ReproBundle => {
  const replay = deterministicReplay(input.record);
  const iqExport = createIqInterchangeExport(input.record, input.iqProfile);
  const audioExport = createAudioExport({
    filenameBase: input.record.id,
    samples: replay.replayedAudio,
    sampleRateHz: input.record.manifest.sampleRateHz,
    format: input.audioFormat,
    metadata: {
      trustStamp: input.record.trustStamp,
      replay: input.record.manifest,
      mode: input.record.manifest.demodMode
    }
  });

  const manifest = {
    schemaVersion: 1,
    recordingId: input.record.id,
    createdAtIso: new Date().toISOString(),
    trustStamp: input.record.trustStamp,
    replay: input.record.manifest,
    files: {
      iq: iqExport.filename,
      audio: audioExport.filename,
      sigmfMeta: `${input.record.id}.sigmf-meta.json`,
      replayEntrypoint: `${input.record.id}.replay-entrypoint.json`
    }
  };

  return {
    manifestJson: JSON.stringify(manifest, null, 2),
    replayEntrypointJson: JSON.stringify({
      schemaVersion: 1,
      recordingId: input.record.id,
      replayDigest: replay.digest,
      launchHint: 'Load this recording in File Source with bundled metadata to replay deterministically.'
    }, null, 2),
    sceneJson: JSON.stringify({
      schemaVersion: 1,
      pipelineGraphVersion: input.record.metadata.global['core:extensions']['rad:rf_scene'].pipelineGraphVersion,
      analyzerStateVersion: input.record.metadata.global['core:extensions']['rad:rf_scene'].analyzerStateVersion,
      bookmarks: input.record.bookmarks,
      annotations: input.record.metadata.annotations
    }, null, 2),
    sigmfMetaJson: JSON.stringify(input.record.metadata, null, 2),
    iqExport,
    audioExport
  };
};

export const estimateRecordingBytes = (record: RecordingRecord): number => {
  let total = 0;
  for (const chunk of record.chunks) {
    total += chunk.iqDataCi8.byteLength;
    total += chunk.audioDataF32.byteLength;
  }
  total += JSON.stringify(record.metadata).length;
  total += JSON.stringify(record.manifest).length;
  total += JSON.stringify(record.trustStamp).length;
  total += JSON.stringify(record.bookmarks).length;
  return total;
};

export const enforceRetentionPolicy = async (input: {
  store: RecordingStore;
  maxRecordings: number;
  maxBytes: number;
  nowIso?: string;
}): Promise<{ deletedIds: string[]; deletedForExpiry: string[] }> => {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const records = await input.store.listRecordings();
  const deletedIds: string[] = [];
  const deletedForExpiry: string[] = [];

  for (const record of records) {
    if (record.expiresAtIso && record.expiresAtIso <= nowIso) {
      await input.store.deleteRecording(record.id);
      deletedIds.push(record.id);
      deletedForExpiry.push(record.id);
    }
  }

  const remaining = (await input.store.listRecordings()).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  let totalBytes = remaining.reduce((sum, record) => sum + estimateRecordingBytes(record), 0);

  for (let i = input.maxRecordings; i < remaining.length; i += 1) {
    const target = remaining[i];
    await input.store.deleteRecording(target.id);
    deletedIds.push(target.id);
    totalBytes -= estimateRecordingBytes(target);
  }

  if (totalBytes > input.maxBytes) {
    const byOldest = (await input.store.listRecordings()).sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
    for (const record of byOldest) {
      if (totalBytes <= input.maxBytes) {
        break;
      }
      await input.store.deleteRecording(record.id);
      deletedIds.push(record.id);
      totalBytes -= estimateRecordingBytes(record);
    }
  }

  return {
    deletedIds,
    deletedForExpiry
  };
};

export const snapshotStorageQuota = async (): Promise<StorageQuotaSnapshot | null> => {
  if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') {
    return null;
  }

  const estimate = await navigator.storage.estimate();
  const quotaBytes = estimate.quota ?? 0;
  const usageBytes = estimate.usage ?? 0;
  const availableBytes = Math.max(0, quotaBytes - usageBytes);

  return {
    quotaBytes,
    usageBytes,
    availableBytes,
    percentUsed: quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0
  };
};

export const createWorkspaceStateBundle = (input: Omit<WorkspaceStateBundle, 'schemaVersion' | 'exportedAtIso'>): WorkspaceStateBundle => ({
  schemaVersion: 1,
  exportedAtIso: new Date().toISOString(),
  ...input
});

export const mergeAnnotations = (existing: StructuredAnnotation[], incoming: StructuredAnnotation[]): StructuredAnnotation[] => {
  const byId = new Map<string, StructuredAnnotation>();
  for (const annotation of [...existing, ...incoming]) {
    byId.set(annotation.id, annotation);
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
};

export const createBookmark = (label: string, frequencyHz: number): RecordingRecord['bookmarks'][number] => ({
  id: makeId('bookmark'),
  label: label.trim().slice(0, 64) || 'Bookmark',
  frequencyHz: Math.round(frequencyHz),
  createdAtIso: new Date().toISOString()
});

export const createStructuredAnnotation = (input: {
  startMs: number;
  endMs: number;
  centerFrequencyHz: number;
  bandwidthHz: number;
  tags: string[];
  note: string;
}): StructuredAnnotation => ({
  id: makeId('annotation'),
  createdAtIso: new Date().toISOString(),
  startMs: Math.max(0, Math.round(input.startMs)),
  endMs: Math.max(Math.round(input.startMs), Math.round(input.endMs)),
  centerFrequencyHz: Math.round(input.centerFrequencyHz),
  bandwidthHz: Math.max(0, Math.round(input.bandwidthHz)),
  tags: input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0).slice(0, 16),
  note: input.note.trim().slice(0, 512)
});

