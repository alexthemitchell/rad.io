import { describe, expect, it } from 'vitest'
import type { SpectralDetection } from '../workers/protocol'
import { SignalTracker, type SignalTrackerFrame } from './SignalTracker'

const DETECTION: SpectralDetection = {
  peakFrequencyHz: 100_000,
  lowerFrequencyHz: 95_000,
  upperFrequencyHz: 105_000,
  bandwidthHz: 10_000,
  peakPowerDbfs: -30,
  snrDb: 30,
  edgeClipped: false,
}

function frame(
  timestampUs: bigint,
  centerFrequencyHz = 100_000_000,
): SignalTrackerFrame {
  return {
    centerFrequencyHz,
    sampleRateHz: 1_000_000,
    binWidthHz: 500,
    timestampUs,
  }
}

describe('SignalTracker', () => {
  it('confirms a stable signal after three nearby observations', () => {
    const tracker = new SignalTracker()

    expect(tracker.update([DETECTION], frame(0n))).toEqual([])
    expect(
      tracker.update(
        [{ ...DETECTION, peakFrequencyHz: 100_400 }],
        frame(1_000n),
      ),
    ).toEqual([])
    const signals = tracker.update(
      [{ ...DETECTION, peakFrequencyHz: 99_800 }],
      frame(2_000n),
    )

    expect(signals).toHaveLength(1)
    expect(signals[0].id).toBe('signal-1')
    expect(signals[0].hitCount).toBe(3)
    expect(signals[0].state).toBe('active')
    expect(signals[0].durationUs).toBe(2_000n)
  })

  it('tracks an absolute signal across center-frequency changes', () => {
    const tracker = new SignalTracker()
    tracker.update([DETECTION], frame(0n, 100_000_000))
    tracker.update(
      [{ ...DETECTION, peakFrequencyHz: 50_000, lowerFrequencyHz: 45_000, upperFrequencyHz: 55_000 }],
      frame(1_000n, 100_050_000),
    )
    const signals = tracker.update(
      [{ ...DETECTION, peakFrequencyHz: 0, lowerFrequencyHz: -5_000, upperFrequencyHz: 5_000 }],
      frame(2_000n, 100_100_000),
    )

    expect(signals).toHaveLength(1)
    expect(signals[0].id).toBe('signal-1')
    expect(signals[0].absoluteFrequencyHz).toBeCloseTo(100_100_000, -2)
  })

  it('reports confirmed missing signals as recent and then expires them', () => {
    const tracker = new SignalTracker()
    tracker.update([DETECTION], frame(0n))
    tracker.update([DETECTION], frame(1_000n))
    tracker.update([DETECTION], frame(2_000n))

    expect(tracker.update([], frame(3_000n))[0].state).toBe('recent')
    for (let index = 0; index < 14; index += 1) {
      tracker.update([], frame(BigInt(4_000 + index * 1_000)))
    }
    expect(tracker.update([], frame(20_000n))).toEqual([])
  })

  it('keeps baseband-only tracks explicitly frequency-relative', () => {
    const tracker = new SignalTracker()
    tracker.update([DETECTION], frame(0n, 0))
    tracker.update([DETECTION], frame(1_000n, 0))
    const signals = tracker.update([DETECTION], frame(2_000n, 0))

    expect(signals[0].absoluteFrequencyHz).toBeNull()
    expect(signals[0].peakOffsetHz).toBe(100_000)
  })

  it('reset clears tracks and restarts stable identifiers', () => {
    const tracker = new SignalTracker()
    tracker.update([DETECTION], frame(0n))
    tracker.reset()
    tracker.update([DETECTION], frame(1_000n))
    tracker.update([DETECTION], frame(2_000n))
    const signals = tracker.update([DETECTION], frame(3_000n))

    expect(signals[0].id).toBe('signal-1')
    expect(signals[0].firstSeenUs).toBe(1_000n)
  })
})