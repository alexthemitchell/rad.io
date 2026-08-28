import { describe, expect, it } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import {
  signalDisplayFrequencyHz,
  signalDisplayOffsetHz,
  signalDisplayRangeOffsetsHz,
} from './signalDisplay'

function signal(
  absoluteFrequencyHz: number | null,
  peakOffsetHz: number,
  channelCenterHz: number | null,
): TrackedSignal {
  return {
    absoluteFrequencyHz,
    peakOffsetHz,
    lowerOffsetHz: peakOffsetHz - 12_000,
    upperOffsetHz: peakOffsetHz + 18_000,
    classification: {
      primary: {
        channelCenterHz,
        category: channelCenterHz === null ? 'unknown' : 'fm-broadcast',
      },
    },
  } as TrackedSignal
}

describe('signal display frequency', () => {
  it('anchors classified channels while preserving generic RF and baseband peaks', () => {
    const station = signal(100_124_000, 124_000, 100_100_000)
    const genericRf = signal(100_124_000, 124_000, null)
    const baseband = signal(null, 124_000, null)

    expect(signalDisplayFrequencyHz(station)).toBe(100_100_000)
    expect(signalDisplayOffsetHz(station, 100_000_000)).toBe(100_000)
    expect(signalDisplayRangeOffsetsHz(station, 100_000_000)).toEqual([0, 200_000])
    expect(signalDisplayFrequencyHz(genericRf)).toBe(100_124_000)
    expect(signalDisplayOffsetHz(genericRf, 100_000_000)).toBe(124_000)
    expect(signalDisplayRangeOffsetsHz(genericRf, 100_000_000)).toEqual([
      112_000,
      142_000,
    ])
    expect(signalDisplayFrequencyHz(baseband)).toBeNull()
    expect(signalDisplayOffsetHz(baseband, 0)).toBe(124_000)
  })
})