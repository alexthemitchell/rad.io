import type { SampleMetadata } from '../workers/protocol'

export type SampleChunk = Omit<SampleMetadata, 'sourceSequence'> & {
  iq: Float32Array
  sequence: number
}

export type SampleRelease = {
  buffer: ArrayBuffer
  dropped: boolean
}

export type SampleSink = (chunk: SampleChunk) => Promise<SampleRelease>

export interface AnalyzerSource {
  readonly id: string
  start(sink: SampleSink): Promise<void>
  stop(): Promise<void>
}