import { describe, expect, it } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import { RdsTargetSelector } from './RdsTargetSelector'

const FRAME = {
  centerFrequencyHz: 100_000_000,
  sampleRateHz: 2_000_000,
}

function signal(
  id: string,
  channelCenterHz: number,
  snrDb: number,
  change: Partial<TrackedSignal> = {},
): TrackedSignal {
  return {
    id,
    peakOffsetHz: channelCenterHz - FRAME.centerFrequencyHz,
    lowerOffsetHz: channelCenterHz - FRAME.centerFrequencyHz - 100_000,
    upperOffsetHz: channelCenterHz - FRAME.centerFrequencyHz + 100_000,
    absoluteFrequencyHz: channelCenterHz,
    lowerFrequencyHz: channelCenterHz - 100_000,
    upperFrequencyHz: channelCenterHz + 100_000,
    bandwidthHz: 200_000,
    peakPowerDbfs: -30,
    snrDb,
    edgeClipped: false,
    firstSeenUs: 0n,
    lastSeenUs: 1_000_000n,
    durationUs: 1_000_000n,
    hitCount: 10,
    state: 'active',
    classification: {
      profileId: 'fcc-us',
      spectralShape: 'medium-band',
      primary: {
        allocationId: `fm-${channelCenterHz}`,
        channelCenterHz,
        label: `FM ${channelCenterHz}`,
        category: 'fm-broadcast',
        score: 0.9,
        reasons: [],
        caveats: [],
      },
      alternatives: [],
    },
    ...change,
  }
}

describe('RdsTargetSelector', () => {
  it('selects the four strongest eligible FM channels', () => {
    const selector = new RdsTargetSelector()
    const signals = [
      signal('signal-1', 99_500_000, 20),
      signal('signal-2', 99_700_000, 30),
      signal('signal-3', 99_900_000, 40),
      signal('signal-4', 100_100_000, 50),
      signal('signal-5', 100_300_000, 60),
    ]

    const selection = selector.update(signals, FRAME)

    expect(selection.selectedSignalIds).toEqual([
      'signal-5',
      'signal-4',
      'signal-3',
      'signal-2',
    ])
    expect(selection.capacityLimitedSignalIds).toEqual(['signal-1'])
    expect(selection.targets.map((target) => target.channelCenterHz)).toEqual([
      100_300_000,
      100_100_000,
      99_900_000,
      99_700_000,
    ])
  })

  it('keeps active targets sticky until a channel becomes unavailable', () => {
    const selector = new RdsTargetSelector(2)
    const first = [
      signal('signal-1', 99_900_000, 30),
      signal('signal-2', 100_100_000, 20),
    ]
    selector.update(first, FRAME)

    const withStrongerArrival = selector.update(
      [...first, signal('signal-3', 100_300_000, 60)],
      FRAME,
    )
    expect(withStrongerArrival.selectedSignalIds).toEqual([
      'signal-1',
      'signal-2',
    ])

    const afterMiss = selector.update(
      [
        first[0],
        signal('signal-2', 100_100_000, 20, { state: 'recent' }),
        signal('signal-3', 100_300_000, 60),
      ],
      FRAME,
    )
    expect(afterMiss.selectedSignalIds).toEqual(['signal-1', 'signal-3'])
  })

  it.each([
    [2_000_000, 4],
    [5_000_000, 4],
    [10_000_000, 2],
    [20_000_000, 1],
  ])('bounds channelization work at %s samples per second', (sampleRateHz, expected) => {
    const selector = new RdsTargetSelector()
    const signals = [
      signal('signal-1', 99_500_000, 50),
      signal('signal-2', 99_700_000, 40),
      signal('signal-3', 99_900_000, 30),
      signal('signal-4', 100_100_000, 20),
    ]

    const selection = selector.update(signals, {
      centerFrequencyHz: 100_000_000,
      sampleRateHz,
    })

    expect(selection.targets).toHaveLength(expected)
    expect(selection.capacityLimitedSignalIds).toHaveLength(4 - expected)
  })

  it('rejects edge-clipped, non-FM, baseband, and edge-adjacent channels', () => {
    const selector = new RdsTargetSelector()
    const unknown = signal('signal-2', 100_100_000, 40)
    unknown.classification.primary.category = 'unknown'

    expect(
      selector.update(
        [
          signal('signal-1', 99_900_000, 40, { edgeClipped: true }),
          unknown,
          signal('signal-3', 100_900_000, 40),
        ],
        FRAME,
      ).targets,
    ).toEqual([])
    expect(
      selector.update([signal('signal-4', 100_100_000, 40)], {
        ...FRAME,
        centerFrequencyHz: 0,
      }).targets,
    ).toEqual([])
  })

  it('clears target stickiness when reset', () => {
    const selector = new RdsTargetSelector(1)
    selector.update([signal('signal-1', 99_900_000, 20)], FRAME)
    selector.reset()

    const selection = selector.update(
      [
        signal('signal-1', 99_900_000, 20),
        signal('signal-2', 100_100_000, 50),
      ],
      FRAME,
    )

    expect(selection.selectedSignalIds).toEqual(['signal-2'])
  })
})