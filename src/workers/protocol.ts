export const PROTOCOL_VERSION = 3 as const

export type GeneratorMode = 'tone' | 'fm-rds'

export type GeneratorConfig = {
  mode: GeneratorMode
  sampleRateHz: number
  centerFrequencyHz: number
  toneFrequencyHz: number
  toneLevelDbfs: number
  noiseEnabled: boolean
  noiseLevelDbfs: number
  fftSize: 1024 | 2048 | 4096
  frameRate: number
  seed: number
}

export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  mode: 'tone',
  sampleRateHz: 1_000_000,
  centerFrequencyHz: 0,
  toneFrequencyHz: 100_000,
  toneLevelDbfs: -12,
  noiseEnabled: true,
  noiseLevelDbfs: -72,
  fftSize: 2048,
  frameRate: 30,
  seed: 0x52414449,
}

export const FM_RDS_GENERATOR_CONFIG: GeneratorConfig = {
  ...DEFAULT_GENERATOR_CONFIG,
  mode: 'fm-rds',
  sampleRateHz: 1_000_000,
  centerFrequencyHz: 100_000_000,
  toneFrequencyHz: 100_000,
  toneLevelDbfs: -12,
  fftSize: 4096,
}

export const FM_RDS_PRESET = {
  name: 'RAD.IO',
  channelFrequencyHz: 100_100_000,
  pi: 0x3ce7,
  pty: 'Information',
  radioText: 'RAD.IO synthetic RBDS test station',
} as const

export type BandPlanId = 'fcc-us' | 'none'

export type DetectionConfig = {
  enabled: boolean
  minimumSnrDb: number
  maxSignals: number
  bandPlanId: BandPlanId
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enabled: true,
  minimumSnrDb: 15,
  maxSignals: 16,
  bandPlanId: 'fcc-us',
}

export type SpectralDetection = {
  peakFrequencyHz: number
  lowerFrequencyHz: number
  upperFrequencyHz: number
  bandwidthHz: number
  peakPowerDbfs: number
  snrDb: number
  edgeClipped: boolean
}

export type SignalServiceCategory =
  | 'am-broadcast'
  | 'fm-broadcast'
  | 'standard-time-frequency'
  | 'amateur'
  | 'aviation'
  | 'television'
  | 'unknown'

export type SpectralShape =
  | 'carrier-like'
  | 'narrowband'
  | 'medium-band'
  | 'wideband'
  | 'partial'

export type ClassificationCandidate = {
  allocationId: string | null
  channelCenterHz: number | null
  label: string
  category: SignalServiceCategory
  score: number
  reasons: string[]
  caveats: string[]
}

export type SignalClassification = {
  profileId: BandPlanId
  spectralShape: SpectralShape
  primary: ClassificationCandidate
  alternatives: ClassificationCandidate[]
}

export type RdsDecoderState =
  | 'searching'
  | 'locked'
  | 'stale'
  | 'capacity-limited'
  | 'unavailable'

export type RdsTimedValue<T> = {
  value: T
  updatedAtUs: bigint
}

export type RdsTextValue = RdsTimedValue<string> & {
  complete: boolean
}

export type RdsDecoderInfo = {
  stereo: boolean
  artificialHead: boolean
  compressed: boolean
  dynamicPty: boolean
}

export type RdsRawGroup = {
  groupType: number
  version: 'A' | 'B'
  blocks: readonly [number, number, number, number]
  correctedBlocks: number
  receivedAtUs: bigint
  applicationId: number | null
}

export type RdsOdaRegistration = {
  applicationGroupType: number
  applicationGroupVersion: 'A' | 'B'
  applicationId: number
  messageBits: number
}

export type RdsTmcEnvelope = {
  variantCode: number
  blockC: number
  blockD: number
  receivedAtUs: bigint
}

export type RdsEonEnvelope = {
  groupType: number
  version: 'A' | 'B'
  variantCode: number
  information: number
  otherNetworkPi: number
  receivedAtUs: bigint
}

export type RdsAlternativeFrequencies = {
  frequenciesHz: number[]
  expectedCount: number | null
  complete: boolean
}

export type RdsStationMetadata = {
  pi: RdsTimedValue<number> | null
  callSign: RdsTimedValue<string> | null
  ps: RdsTextValue | null
  pty: RdsTimedValue<number> | null
  ptyName: RdsTimedValue<string> | null
  ptyn: RdsTextValue | null
  trafficProgram: RdsTimedValue<boolean> | null
  trafficAnnouncement: RdsTimedValue<boolean> | null
  musicSpeech: RdsTimedValue<boolean> | null
  decoderInfo: RdsTimedValue<RdsDecoderInfo> | null
  alternativeFrequencies: RdsTimedValue<RdsAlternativeFrequencies> | null
  extendedCountryCode: RdsTimedValue<number> | null
  programItemNumber: RdsTimedValue<number> | null
  radioText: RdsTextValue | null
  clockTime: RdsTimedValue<{ isoUtc: string; localOffsetMinutes: number }> | null
  odaRegistrations: Array<RdsTimedValue<RdsOdaRegistration>>
  tmcMessages: RdsTmcEnvelope[]
  eonRecords: RdsEonEnvelope[]
  rawGroups: RdsRawGroup[]
  groupsByType: number[]
  lastValidGroupAtUs: bigint | null
}

export type RdsDecoderDiagnostics = {
  synchronized: boolean
  validGroups: number
  correctedBlocks: number
  rejectedGroups: number
  lostSyncCount: number
  lastValidGroupAtUs: bigint | null
}

export type RdsReception = {
  channelCenterHz: number
  state: RdsDecoderState
  reason: string | null
  metadata: RdsStationMetadata | null
  diagnostics: RdsDecoderDiagnostics
}

export type RdsDecodeTarget = {
  channelCenterHz: number
  frequencyOffsetHz: number
}

export type TrackedSignal = {
  id: string
  peakOffsetHz: number
  lowerOffsetHz: number
  upperOffsetHz: number
  absoluteFrequencyHz: number | null
  lowerFrequencyHz: number | null
  upperFrequencyHz: number | null
  bandwidthHz: number
  peakPowerDbfs: number
  snrDb: number
  edgeClipped: boolean
  firstSeenUs: bigint
  lastSeenUs: bigint
  durationUs: bigint
  hitCount: number
  state: 'active' | 'recent'
  classification: SignalClassification
  rds?: RdsReception
}

export type SampleMetadata = {
  sampleRateHz: number
  centerFrequencyHz: number
  sourceSequence: number
  timestampUs: bigint
  formatVersion: 1
}

type VersionedRequest = {
  protocolVersion: typeof PROTOCOL_VERSION
}

export type WorkerRequest =
  | (VersionedRequest & { type: 'init' })
  | (VersionedRequest & {
      type: 'configure'
      requestId: number
      config: GeneratorConfig
    })
  | (VersionedRequest & {
      type: 'configure-detection'
      requestId: number
      config: DetectionConfig
    })
  | (VersionedRequest & { type: 'start-generated' })
  | (VersionedRequest & { type: 'stop' })
  | (VersionedRequest & { type: 'reset' })
  | (VersionedRequest & { type: 'frame-consumed'; sequence: number })
  | (VersionedRequest & {
      type: 'process-samples'
      requestId: number
      iq: Float32Array
      metadata: SampleMetadata
    })

export type WorkerReadyEvent = {
  type: 'ready'
  protocolVersion: typeof PROTOCOL_VERSION
  engineSequence: number
}

export type WorkerConfiguredEvent = {
  type: 'configured'
  protocolVersion: typeof PROTOCOL_VERSION
  requestId: number
  config: GeneratorConfig
}

export type WorkerDetectionConfiguredEvent = {
  type: 'detection-configured'
  protocolVersion: typeof PROTOCOL_VERSION
  requestId: number
  config: DetectionConfig
}

export type WorkerStatusEvent = {
  type: 'status'
  protocolVersion: typeof PROTOCOL_VERSION
  state: 'idle' | 'running'
}

export type AnalysisFrameEvent = {
  type: 'analysis-frame'
  protocolVersion: typeof PROTOCOL_VERSION
  sequence: number
  waveform: Float32Array
  spectrumDb: Float32Array
  noiseFloorDbfs: number
  detections: SpectralDetection[]
  trackedSignals: TrackedSignal[]
  rdsTargets: RdsDecodeTarget[]
  sampleRateHz: number
  centerFrequencyHz: number
  peakFrequencyHz: number
  peakPowerDbfs: number
  elapsedSamples: bigint
  processingTimeMs: number
  sourceSequence: number
  timestampUs: bigint
  formatVersion: 1
}

export type InputReleasedEvent = {
  type: 'input-released'
  protocolVersion: typeof PROTOCOL_VERSION
  requestId: number
  buffer: ArrayBuffer
  dropped: boolean
}

export type WorkerErrorEvent = {
  type: 'error'
  protocolVersion: typeof PROTOCOL_VERSION
  code:
    | 'INIT_FAILED'
    | 'NOT_READY'
    | 'PROCESSING_FAILED'
    | 'PROTOCOL_MISMATCH'
  message: string
  recoverable: boolean
}

export type WorkerEvent =
  | WorkerReadyEvent
  | WorkerConfiguredEvent
  | WorkerDetectionConfiguredEvent
  | WorkerStatusEvent
  | AnalysisFrameEvent
  | InputReleasedEvent
  | WorkerErrorEvent