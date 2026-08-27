export const PROTOCOL_VERSION = 2 as const

export type GeneratorConfig = {
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