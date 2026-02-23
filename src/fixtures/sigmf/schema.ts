export type FixtureCalibrationStatus = 'uncalibrated' | 'factory' | 'user';

export type SigmfFixtureMetadata = {
  fixtureSchemaVersion: number;
  recordingSchemaVersion: number;
  fixtureId: string;
  title: string;
  sampleRateHz: number;
  centerFrequencyHz: number;
  calibrationStatus: FixtureCalibrationStatus;
  dataType: 'ci8';
  description?: string;
};

const isFinitePositiveNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const isCalibrationStatus = (value: unknown): value is FixtureCalibrationStatus => {
  return value === 'uncalibrated' || value === 'factory' || value === 'user';
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

  return {
    fixtureSchemaVersion: candidate.fixtureSchemaVersion,
    recordingSchemaVersion: candidate.recordingSchemaVersion,
    fixtureId: candidate.fixtureId,
    title: candidate.title,
    sampleRateHz: candidate.sampleRateHz,
    centerFrequencyHz: candidate.centerFrequencyHz,
    calibrationStatus: candidate.calibrationStatus,
    dataType: candidate.dataType,
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
