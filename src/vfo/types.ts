export const MAX_VFOS = 4

export type VfoMode = 'wbfm' | 'am' | 'nbfm'

export type VfoDspConfig = {
  id: string
  frequencyHz: number
  mode: VfoMode
  bandwidthHz: number
  squelchDbfs: number
  revision: number
}

export type VfoMixerConfig = {
  gainDb: number
  muted: boolean
  solo: boolean
}

export type VfoConfig = VfoDspConfig & VfoMixerConfig & {
  label: string
}

export type VfoAudioBlock = {
  vfoId: string
  revision: number
  sourceTimestampUs: bigint
  sampleRateHz: number
  channelCount: 1 | 2
  signalLevelDbfs: number
  squelched: boolean
  stereoLocked: boolean
  samples: Float32Array
}

export type VfoAudioPortMessage = {
  type: 'vfo-audio'
  blocks: VfoAudioBlock[]
}

export type VfoMixerControl = Pick<
  VfoConfig,
  'id' | 'revision' | 'gainDb' | 'muted' | 'solo'
> & {
  active: boolean
}

export type VfoMixerDiagnostics = {
  queuedFrames: Record<string, number>
  underruns: Record<string, number>
  overruns: Record<string, number>
  stereoLocked: Record<string, boolean>
  staleBlocks: number
  limiterReductionDb: number
}

export type VfoMixerCommand =
  | {
      type: 'configure'
      vfos: VfoMixerControl[]
      masterGainDb: number
      masterMuted: boolean
    }
  | { type: 'attach-audio-port'; port: MessagePort }
  | { type: 'flush' }

export type VfoMixerEvent = {
  type: 'diagnostics'
  diagnostics: VfoMixerDiagnostics
}

export type VfoSourceWindow = {
  centerFrequencyHz: number
  sampleRateHz: number
}