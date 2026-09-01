import type {
  VfoConfig,
  VfoDspConfig,
  VfoMixerConfig,
  VfoMode,
  VfoSourceWindow,
} from './types'
import { MAX_VFOS } from './types'
import type { SourceSessionId } from '../sources/types'

const MAX_FREQUENCY_HZ = 6_000_000_000
const MIN_SQUELCH_DBFS = -120
const MAX_SQUELCH_DBFS = 0
const MIN_GAIN_DB = -60
const MAX_GAIN_DB = 12

export type VfoModeDefaults = Pick<
  VfoConfig,
  'bandwidthHz' | 'squelchDbfs' | 'gainDb'
>

export const VFO_MODE_DEFAULTS: Readonly<Record<VfoMode, VfoModeDefaults>> = {
  wbfm: { bandwidthHz: 200_000, squelchDbfs: -85, gainDb: -6 },
  am: { bandwidthHz: 10_000, squelchDbfs: -90, gainDb: -6 },
  nbfm: { bandwidthHz: 12_500, squelchDbfs: -90, gainDb: -6 },
}

const BANDWIDTH_LIMITS_HZ: Readonly<Record<VfoMode, readonly [number, number]>> = {
  wbfm: [100_000, 300_000],
  am: [2_000, 20_000],
  nbfm: [5_000, 25_000],
}

export type VfoState = {
  vfos: VfoConfig[]
  nextId: number
}

export type AddVfoInput = {
  sourceSessionId: SourceSessionId
  frequencyHz: number
  mode: VfoMode
  label?: string
}

export type VfoAction =
  | { type: 'add'; input: AddVfoInput }
  | {
      type: 'update-dsp'
      id: string
      change: Partial<Pick<VfoDspConfig, 'frequencyHz' | 'mode' | 'bandwidthHz' | 'squelchDbfs'>>
    }
  | {
      type: 'update-mixer'
      id: string
      change: Partial<VfoMixerConfig & Pick<VfoConfig, 'label'>>
    }
  | { type: 'remove'; id: string }
  | { type: 'remove-source'; sourceSessionId: SourceSessionId }

export function createVfoState(): VfoState {
  return { vfos: [], nextId: 1 }
}

export function reduceVfoState(state: VfoState, action: VfoAction): VfoState {
  switch (action.type) {
    case 'add': {
      if (state.vfos.length >= MAX_VFOS) {
        throw new Error(`At most ${MAX_VFOS} VFOs can be active.`)
      }
      const defaults = VFO_MODE_DEFAULTS[action.input.mode]
      const vfo = validateVfo({
        id: `vfo-${state.nextId}`,
        sourceSessionId: action.input.sourceSessionId,
        label: action.input.label?.trim() || `VFO ${state.nextId}`,
        frequencyHz: action.input.frequencyHz,
        mode: action.input.mode,
        bandwidthHz: defaults.bandwidthHz,
        squelchDbfs: defaults.squelchDbfs,
        gainDb: defaults.gainDb,
        muted: false,
        solo: false,
        revision: 1,
      })
      return {
        vfos: [...state.vfos, vfo],
        nextId: state.nextId + 1,
      }
    }
    case 'update-dsp':
      return updateVfo(state, action.id, (current) => {
        const modeChanged = action.change.mode !== undefined && action.change.mode !== current.mode
        const defaults = modeChanged ? VFO_MODE_DEFAULTS[action.change.mode!] : undefined
        const next = validateVfo({
          ...current,
          ...action.change,
          bandwidthHz: action.change.bandwidthHz ?? defaults?.bandwidthHz ?? current.bandwidthHz,
          squelchDbfs: action.change.squelchDbfs ?? defaults?.squelchDbfs ?? current.squelchDbfs,
        })
        if (sameDspConfig(current, next)) return current
        return { ...next, revision: current.revision + 1 }
      })
    case 'update-mixer':
      return updateVfo(state, action.id, (current) =>
        validateVfo({ ...current, ...action.change }),
      )
    case 'remove':
      if (!state.vfos.some((vfo) => vfo.id === action.id)) return state
      return { ...state, vfos: state.vfos.filter((vfo) => vfo.id !== action.id) }
    case 'remove-source':
      if (!state.vfos.some((vfo) => vfo.sourceSessionId === action.sourceSessionId)) return state
      return {
        ...state,
        vfos: state.vfos.filter((vfo) => vfo.sourceSessionId !== action.sourceSessionId),
      }
  }
}

export function isVfoInPassband(
  vfo: Pick<VfoConfig, 'frequencyHz' | 'bandwidthHz'>,
  source: VfoSourceWindow,
): boolean {
  if (
    !Number.isFinite(source.centerFrequencyHz) ||
    !Number.isFinite(source.sampleRateHz) ||
    source.sampleRateHz <= 0
  ) {
    return false
  }
  const transitionHz = Math.max(1_000, vfo.bandwidthHz * 0.1)
  const halfOccupiedHz = vfo.bandwidthHz / 2 + transitionHz
  const halfCaptureHz = source.sampleRateHz / 2
  return (
    vfo.frequencyHz - halfOccupiedHz > source.centerFrequencyHz - halfCaptureHz &&
    vfo.frequencyHz + halfOccupiedHz < source.centerFrequencyHz + halfCaptureHz
  )
}

function updateVfo(
  state: VfoState,
  id: string,
  update: (current: VfoConfig) => VfoConfig,
): VfoState {
  const index = state.vfos.findIndex((vfo) => vfo.id === id)
  if (index < 0) throw new Error(`Unknown VFO ${id}.`)
  const current = state.vfos[index]
  const next = update(current)
  if (next === current) return state
  const vfos = [...state.vfos]
  vfos[index] = next
  return { ...state, vfos }
}

function validateVfo(vfo: VfoConfig): VfoConfig {
  if (!vfo.sourceSessionId.trim()) throw new Error('VFO source session is required.')
  if (
    !Number.isSafeInteger(vfo.frequencyHz) ||
    vfo.frequencyHz < 0 ||
    vfo.frequencyHz > MAX_FREQUENCY_HZ
  ) {
    throw new Error('VFO frequency must be an integer from 0 Hz to 6 GHz.')
  }
  const [minimumBandwidthHz, maximumBandwidthHz] = BANDWIDTH_LIMITS_HZ[vfo.mode]
  if (
    !Number.isFinite(vfo.bandwidthHz) ||
    vfo.bandwidthHz < minimumBandwidthHz ||
    vfo.bandwidthHz > maximumBandwidthHz
  ) {
    throw new Error(
      `${vfo.mode.toUpperCase()} bandwidth must be from ${minimumBandwidthHz} Hz to ${maximumBandwidthHz} Hz.`,
    )
  }
  if (
    !Number.isFinite(vfo.squelchDbfs) ||
    vfo.squelchDbfs < MIN_SQUELCH_DBFS ||
    vfo.squelchDbfs > MAX_SQUELCH_DBFS
  ) {
    throw new Error('VFO squelch must be from -120 dBFS to 0 dBFS.')
  }
  if (
    !Number.isFinite(vfo.gainDb) ||
    vfo.gainDb < MIN_GAIN_DB ||
    vfo.gainDb > MAX_GAIN_DB
  ) {
    throw new Error('VFO gain must be from -60 dB to 12 dB.')
  }
  return vfo
}

function sameDspConfig(left: VfoDspConfig, right: VfoDspConfig): boolean {
  return (
    left.frequencyHz === right.frequencyHz &&
    left.mode === right.mode &&
    left.bandwidthHz === right.bandwidthHz &&
    left.squelchDbfs === right.squelchDbfs
  )
}