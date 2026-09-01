import { describe, expect, it } from 'vitest'
import { MAX_VFOS } from './types'
import {
  createVfoState,
  isVfoInPassband,
  reduceVfoState,
} from './vfoState'

describe('VFO state', () => {
  it('creates stable, non-reused IDs and enforces the VFO limit', () => {
    let state = createVfoState()
    for (let index = 0; index < MAX_VFOS; index += 1) {
      state = reduceVfoState(state, {
        type: 'add',
        input: {
          sourceSessionId: 'hackrf-1',
          frequencyHz: 100_100_000 + index * 200_000,
          mode: 'wbfm',
        },
      })
    }
    expect(state.vfos.map((vfo) => vfo.id)).toEqual(['vfo-1', 'vfo-2', 'vfo-3', 'vfo-4'])
    expect(() =>
      reduceVfoState(state, {
        type: 'add',
        input: { sourceSessionId: 'hackrf-1', frequencyHz: 101_100_000, mode: 'wbfm' },
      }),
    ).toThrow('At most 4 VFOs')

    state = reduceVfoState(state, { type: 'remove', id: 'vfo-2' })
    state = reduceVfoState(state, {
      type: 'add',
      input: { sourceSessionId: 'hackrf-1', frequencyHz: 101_300_000, mode: 'wbfm' },
    })
    expect(state.vfos.at(-1)?.id).toBe('vfo-5')
  })

  it('increments revisions only for DSP changes and resets mode defaults', () => {
    let state = reduceVfoState(createVfoState(), {
      type: 'add',
      input: {
        sourceSessionId: 'hackrf-1',
        frequencyHz: 100_100_000,
        mode: 'wbfm',
        label: 'News',
      },
    })
    state = reduceVfoState(state, {
      type: 'update-mixer',
      id: 'vfo-1',
      change: { gainDb: -12, muted: true, label: 'Local news' },
    })
    expect(state.vfos[0]).toMatchObject({ revision: 1, gainDb: -12, muted: true })

    state = reduceVfoState(state, {
      type: 'update-dsp',
      id: 'vfo-1',
      change: { mode: 'nbfm' },
    })
    expect(state.vfos[0]).toMatchObject({
      revision: 2,
      mode: 'nbfm',
      bandwidthHz: 12_500,
      squelchDbfs: -90,
    })
  })

  it('requires the channel and filter transition to fit the source passband', () => {
    const state = reduceVfoState(createVfoState(), {
      type: 'add',
      input: { sourceSessionId: 'hackrf-1', frequencyHz: 100_800_000, mode: 'wbfm' },
    })
    const source = { centerFrequencyHz: 100_000_000, sampleRateHz: 2_000_000 }

    expect(isVfoInPassband(state.vfos[0], source)).toBe(true)
    expect(
      isVfoInPassband({ ...state.vfos[0], frequencyHz: 100_900_000 }, source),
    ).toBe(false)
    expect(
      isVfoInPassband({ ...state.vfos[0], frequencyHz: 100_880_000 }, source),
    ).toBe(false)
  })

  it('rejects invalid mode-specific values', () => {
    const state = reduceVfoState(createVfoState(), {
      type: 'add',
      input: { sourceSessionId: 'hackrf-1', frequencyHz: 118_100_000, mode: 'am' },
    })
    expect(() =>
      reduceVfoState(state, {
        type: 'update-dsp',
        id: 'vfo-1',
        change: { bandwidthHz: 100_000 },
      }),
    ).toThrow('AM bandwidth')
  })
})