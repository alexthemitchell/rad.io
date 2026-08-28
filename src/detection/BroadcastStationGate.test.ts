import { describe, expect, it } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import { BroadcastStationGate } from './BroadcastStationGate'

function signal(
  channelCenterHz: number,
  bandwidthHz: number,
  change: Partial<TrackedSignal> = {},
): TrackedSignal {
  return {
    id: `signal-${channelCenterHz}`,
    peakOffsetHz: channelCenterHz - 100_000_000,
    lowerOffsetHz: channelCenterHz - 100_000_000 - bandwidthHz / 2,
    upperOffsetHz: channelCenterHz - 100_000_000 + bandwidthHz / 2,
    absoluteFrequencyHz: channelCenterHz,
    lowerFrequencyHz: channelCenterHz - bandwidthHz / 2,
    upperFrequencyHz: channelCenterHz + bandwidthHz / 2,
    bandwidthHz,
    peakPowerDbfs: -40,
    snrDb: 30,
    edgeClipped: false,
    firstSeenUs: 0n,
    lastSeenUs: 1_000_000n,
    durationUs: 1_000_000n,
    hitCount: 10,
    state: 'active',
    classification: {
      profileId: 'fcc-us',
      spectralShape: bandwidthHz > 25_000 ? 'medium-band' : 'narrowband',
      primary: {
        allocationId: `fm-${channelCenterHz}`,
        channelCenterHz,
        label: `FM ${channelCenterHz}`,
        category: 'fm-broadcast',
        score: 0.7,
        reasons: [],
        caveats: [],
      },
      alternatives: [],
    },
    ...change,
  }
}

describe('BroadcastStationGate', () => {
  it('hides narrow FM-band carriers until the channel shows station-width energy', () => {
    const gate = new BroadcastStationGate()
    const narrow = signal(100_100_000, 2_000)

    expect(gate.filter([narrow])).toEqual([])
    expect(gate.filter([signal(100_100_000, 40_000)])).toHaveLength(1)
    expect(gate.filter([narrow])).toHaveLength(1)
    expect(gate.filter([{ ...narrow, state: 'recent' }])).toHaveLength(1)
  })

  it('forgets qualification after a channel leaves the tracker', () => {
    const gate = new BroadcastStationGate()
    gate.filter([signal(100_100_000, 40_000)])
    gate.filter([])

    expect(gate.filter([signal(100_100_000, 2_000)])).toEqual([])
  })

  it('does not filter non-FM signals', () => {
    const gate = new BroadcastStationGate()
    const unknown = signal(100_100_000, 2_000)
    unknown.classification.primary = {
      ...unknown.classification.primary,
      allocationId: null,
      channelCenterHz: null,
      label: 'Unknown service',
      category: 'unknown',
    }

    expect(gate.filter([unknown])).toEqual([unknown])
  })

  it('reset removes all channel qualifications', () => {
    const gate = new BroadcastStationGate()
    gate.filter([signal(100_100_000, 40_000)])
    gate.reset()

    expect(gate.filter([signal(100_100_000, 2_000)])).toEqual([])
  })
})