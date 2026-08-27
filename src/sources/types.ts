import type {
  RdsDecodeTarget,
  RdsReception,
  SampleMetadata,
} from '../workers/protocol'

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
  start(sink: SampleSink, rdsSink?: RdsSink): Promise<void>
  setRdsTargets?(targets: readonly RdsDecodeTarget[]): void
  stop(): Promise<void>
}