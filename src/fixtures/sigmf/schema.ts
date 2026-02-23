export type FixtureCalibrationStatus = 'uncalibrated' | 'factory' | 'user';

export type SigmfReferenceClockMetadata = {
  source: 'unknown' | 'tcxo' | 'gpsdo' | 'rubidium';
  nominalFrequencyHz: number;
  measuredPpm?: number;
};

export type SigmfWallClockMetadata = {
  capturedAtUtc: string;
  unixEpochMs?: number;
};

export type SigmfReferenceDisciplineSource = 'none' | '10mhz' | '1pps' | 'gpsdo';

export type SigmfTimeAlignmentMetadata = {
  wallClockAligned?: boolean;
  alignmentUncertaintyMs?: number;
  referenceDiscipline?: {
    source: SigmfReferenceDisciplineSource;
    locked: boolean;
    measuredPpm?: number;
  };
};

export type SigmfFixtureMetadata = {
  fixtureSchemaVersion: number;
  recordingSchemaVersion: number;
  fixtureId: string;
  title: string;
  sampleRateHz: number;
  centerFrequencyHz: number;
  calibrationStatus: FixtureCalibrationStatus;
  dataType: 'ci8';
  calibratedLevelOffsetDb?: number;
  calibratedFrequencyOffsetHz?: number;
  referenceClock?: SigmfReferenceClockMetadata;
  wallClock?: SigmfWallClockMetadata;
  timeAlignment?: SigmfTimeAlignmentMetadata;
  description?: string;
};

const isFinitePositiveNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isCalibrationStatus = (value: unknown): value is FixtureCalibrationStatus => {
  return value === 'uncalibrated' || value === 'factory' || value === 'user';
};

const isReferenceClockSource = (value: unknown): value is SigmfReferenceClockMetadata['source'] => {
  return value === 'unknown' || value === 'tcxo' || value === 'gpsdo' || value === 'rubidium';
};

const parseReferenceClock = (value: unknown): SigmfReferenceClockMetadata | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    throw new Error('SigMF fixture metadata referenceClock must be an object when provided.');
  }

  const candidate = value as Partial<SigmfReferenceClockMetadata>;

  if (!isReferenceClockSource(candidate.source)) {
    throw new Error('SigMF fixture metadata referenceClock.source is invalid.');
  }

  if (!isFinitePositiveNumber(candidate.nominalFrequencyHz)) {
    throw new Error('SigMF fixture metadata referenceClock.nominalFrequencyHz must be > 0.');
  }

  if (candidate.measuredPpm !== undefined && !isFiniteNumber(candidate.measuredPpm)) {
    throw new Error('SigMF fixture metadata referenceClock.measuredPpm must be finite when provided.');
  }

  return {
    source: candidate.source,
    nominalFrequencyHz: candidate.nominalFrequencyHz,
    measuredPpm: candidate.measuredPpm
  };
};

const parseWallClock = (value: unknown): SigmfWallClockMetadata | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    throw new Error('SigMF fixture metadata wallClock must be an object when provided.');
  }

  const candidate = value as Partial<SigmfWallClockMetadata>;

  if (typeof candidate.capturedAtUtc !== 'string' || Number.isNaN(Date.parse(candidate.capturedAtUtc))) {
    throw new Error('SigMF fixture metadata wallClock.capturedAtUtc must be a valid UTC timestamp string.');
  }

  if (candidate.unixEpochMs !== undefined && (!isFiniteNumber(candidate.unixEpochMs) || candidate.unixEpochMs < 0)) {
    throw new Error('SigMF fixture metadata wallClock.unixEpochMs must be >= 0 when provided.');
  }

  return {
    capturedAtUtc: candidate.capturedAtUtc,
    unixEpochMs: candidate.unixEpochMs
  };
};

const isReferenceDisciplineSource = (value: unknown): value is SigmfReferenceDisciplineSource => {
  return value === 'none' || value === '10mhz' || value === '1pps' || value === 'gpsdo';
};

const parseTimeAlignment = (value: unknown): SigmfTimeAlignmentMetadata | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    throw new Error('SigMF fixture metadata timeAlignment must be an object when provided.');
  }

  const candidate = value as Partial<SigmfTimeAlignmentMetadata>;

  if (candidate.wallClockAligned !== undefined && typeof candidate.wallClockAligned !== 'boolean') {
    throw new Error('SigMF fixture metadata timeAlignment.wallClockAligned must be boolean when provided.');
  }

  if (
    candidate.alignmentUncertaintyMs !== undefined &&
    (!isFiniteNumber(candidate.alignmentUncertaintyMs) || candidate.alignmentUncertaintyMs < 0)
  ) {
    throw new Error('SigMF fixture metadata timeAlignment.alignmentUncertaintyMs must be >= 0 when provided.');
  }

  let referenceDiscipline: SigmfTimeAlignmentMetadata['referenceDiscipline'];
  if (candidate.referenceDiscipline !== undefined) {
    if (!candidate.referenceDiscipline || typeof candidate.referenceDiscipline !== 'object') {
      throw new Error('SigMF fixture metadata timeAlignment.referenceDiscipline must be an object when provided.');
    }

    const parsedReference = candidate.referenceDiscipline as {
      source?: unknown;
      locked?: unknown;
      measuredPpm?: unknown;
    };

    if (!isReferenceDisciplineSource(parsedReference.source)) {
      throw new Error('SigMF fixture metadata timeAlignment.referenceDiscipline.source is invalid.');
    }

    if (typeof parsedReference.locked !== 'boolean') {
      throw new Error('SigMF fixture metadata timeAlignment.referenceDiscipline.locked must be boolean.');
    }

    if (parsedReference.measuredPpm !== undefined && !isFiniteNumber(parsedReference.measuredPpm)) {
      throw new Error('SigMF fixture metadata timeAlignment.referenceDiscipline.measuredPpm must be finite when provided.');
    }

    referenceDiscipline = {
      source: parsedReference.source,
      locked: parsedReference.locked,
      measuredPpm: parsedReference.measuredPpm
    };
  }

  return {
    wallClockAligned: candidate.wallClockAligned,
    alignmentUncertaintyMs: candidate.alignmentUncertaintyMs,
    referenceDiscipline
  };
};

export const parseSigmfFixtureMetadata = (raw: unknown): SigmfFixtureMetadata => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('SigMF fixture metadata must be an object.');
  }

  const candidate = raw as Partial<SigmfFixtureMetadata>;

  if (!isFinitePositiveNumber(candidate.fixtureSchemaVersion)) {
    throw new Error('SigMF fixture metadata requires a positive fixtureSchemaVersion.');
  }

  if (!isFinitePositiveNumber(candidate.recordingSchemaVersion)) {
    throw new Error('SigMF fixture metadata requires a positive recordingSchemaVersion.');
  }

  if (typeof candidate.fixtureId !== 'string' || candidate.fixtureId.trim().length === 0) {
    throw new Error('SigMF fixture metadata requires fixtureId.');
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim().length === 0) {
    throw new Error('SigMF fixture metadata requires title.');
  }

  if (!isFinitePositiveNumber(candidate.sampleRateHz)) {
    throw new Error('SigMF fixture metadata requires sampleRateHz > 0.');
  }

  if (!isFinitePositiveNumber(candidate.centerFrequencyHz)) {
    throw new Error('SigMF fixture metadata requires centerFrequencyHz > 0.');
  }

  if (!isCalibrationStatus(candidate.calibrationStatus)) {
    throw new Error('SigMF fixture metadata requires calibrationStatus.');
  }

  if (candidate.dataType !== 'ci8') {
    throw new Error('SigMF fixture metadata currently supports only ci8 data.');
  }

  if (candidate.calibratedLevelOffsetDb !== undefined && !isFiniteNumber(candidate.calibratedLevelOffsetDb)) {
    throw new Error('SigMF fixture metadata calibratedLevelOffsetDb must be finite when provided.');
  }

  if (candidate.calibratedFrequencyOffsetHz !== undefined && !isFiniteNumber(candidate.calibratedFrequencyOffsetHz)) {
    throw new Error('SigMF fixture metadata calibratedFrequencyOffsetHz must be finite when provided.');
  }

  const referenceClock = parseReferenceClock(candidate.referenceClock);
  const wallClock = parseWallClock(candidate.wallClock);
  const timeAlignment = parseTimeAlignment(candidate.timeAlignment);

  return {
    fixtureSchemaVersion: candidate.fixtureSchemaVersion,
    recordingSchemaVersion: candidate.recordingSchemaVersion,
    fixtureId: candidate.fixtureId,
    title: candidate.title,
    sampleRateHz: candidate.sampleRateHz,
    centerFrequencyHz: candidate.centerFrequencyHz,
    calibrationStatus: candidate.calibrationStatus,
    dataType: candidate.dataType,
    calibratedLevelOffsetDb: candidate.calibratedLevelOffsetDb,
    calibratedFrequencyOffsetHz: candidate.calibratedFrequencyOffsetHz,
    referenceClock,
    wallClock,
    timeAlignment,
    description: candidate.description
  };
};

export type SigmfFixtureBundle = {
  metadata: SigmfFixtureMetadata;
  iqData: Uint8Array;
};

export const createSigmfFixtureBundle = (metadata: unknown, iqData: Uint8Array): SigmfFixtureBundle => {
  const parsedMetadata = parseSigmfFixtureMetadata(metadata);

  if (!(iqData instanceof Uint8Array) || iqData.byteLength === 0) {
    throw new Error('SigMF fixture data must be a non-empty Uint8Array.');
  }

  if (iqData.byteLength % 2 !== 0) {
    throw new Error('SigMF fixture ci8 data must contain interleaved I/Q bytes.');
  }

  return {
    metadata: parsedMetadata,
    iqData
  };
};
