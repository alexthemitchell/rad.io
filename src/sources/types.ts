import type {
  RdsDecodeTarget,
  RdsReception,
  SampleMetadata,
} from '../workers/protocol'
import type { VfoDspConfig } from '../vfo/types'

export type SourceSessionId = string
export type HardwareSourceKind = 'hackrf' | 'rtl-sdr'

export type SampleChunk = Omit<SampleMetadata, 'sourceSequence'> & {
  iq: Float32Array
  sequence: number
}

export type SampleRelease = {
  buffer: ArrayBuffer
  dropped: boolean
}

export type SampleSink = (chunk: SampleChunk) => Promise<SampleRelease>
export type RdsSink = (receptions: readonly RdsReception[]) => void

export interface AnalyzerSource {
  readonly id: string
  readonly label: string
  start(sink: SampleSink, rdsSink?: RdsSink): Promise<void>
  setRdsTargets?(targets: readonly RdsDecodeTarget[]): void
  setVfos?(outputSampleRateHz: number, vfos: readonly VfoDspConfig[]): void
  attachVfoAudioPort?(port: MessagePort): void
  stop(): Promise<void>
}