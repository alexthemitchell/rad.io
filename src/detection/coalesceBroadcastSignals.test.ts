import { describe, expect, it } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import { coalesceBroadcastSignals } from './coalesceBroadcastSignals'

function signal(
  id: string,
  peakOffsetHz: number,
  change: Partial<TrackedSignal> = {},
): TrackedSignal {
  const centerFrequencyHz = 100_000_000
  return {
    id,
    peakOffsetHz,
    lowerOffsetHz: peakOffsetHz - 5_000,
    upperOffsetHz: peakOffsetHz + 5_000,
    absoluteFrequencyHz: centerFrequencyHz + peakOffsetHz,
    lowerFrequencyHz: centerFrequencyHz + peakOffsetHz - 5_000,
    upperFrequencyHz: centerFrequencyHz + peakOffsetHz + 5_000,
    bandwidthHz: 10_000,
    peakPowerDbfs: -30,
    snrDb: 30,
    edgeClipped: false,
    firstSeenUs: 0n,
    lastSeenUs: 1_000_000n,
    durationUs: 1_000_000n,
    hitCount: 10,
    state: 'active',
    classification: {
      profileId: 'fcc-us',
      spectralShape: 'narrowband',
      primary: {
        allocationId: 'fm-100100000',
        channelCenterHz: 100_100_000,
        label: 'FM broadcast channel 261 (100.1 MHz)',
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

describe('coalesceBroadcastSignals', () => {
  it('merges active and recent fragments assigned to one FM channel', () => {
    const signals = coalesceBroadcastSignals([
      signal('signal-1', 80_000, {
        firstSeenUs: 100n,
        lastSeenUs: 900n,
        state: 'recent',
      }),
      signal('signal-2', 100_000, {
        firstSeenUs: 200n,
        lastSeenUs: 1_000n,
        snrDb: 40,
      }),
      signal('signal-3', 120_000, {
        firstSeenUs: 300n,
        lastSeenUs: 1_000n,
        snrDb: 20,
      }),
    ])

    expect(signals).toHaveLength(1)
    expect(signals[0].id).toBe('signal-1')
    expect(signals[0].state).toBe('active')
    expect(signals[0].peakOffsetHz).toBe(100_000)
    expect(signals[0].lowerOffsetHz).toBe(95_000)
    expect(signals[0].upperOffsetHz).toBe(125_000)
    expect(signals[0].bandwidthHz).toBe(30_000)
    expect(signals[0].firstSeenUs).toBe(100n)
    expect(signals[0].lastSeenUs).toBe(1_000n)
  })

  it('keeps separate FM channels and unknown signals independent', () => {
    const otherChannel = signal('signal-2', 300_000)
    otherChannel.classification.primary = {
      ...otherChannel.classification.primary,
      allocationId: 'fm-100300000',
      channelCenterHz: 100_300_000,
      label: 'FM broadcast channel 262 (100.3 MHz)',
    }
    const unknown = signal('signal-3', 110_000)
    unknown.classification.primary = {
      ...unknown.classification.primary,
      allocationId: null,
      channelCenterHz: null,
      label: 'Unknown service',
      category: 'unknown',
    }

    const signals = coalesceBroadcastSignals([
      signal('signal-1', 100_000),
      otherChannel,
      unknown,
    ])

    expect(signals.map((candidate) => candidate.id)).toEqual([
      'signal-1',
      'signal-2',
      'signal-3',
    ])
  })
})