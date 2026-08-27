import { describe, expect, it } from 'vitest'
import { classifySignal, type ClassificationInput } from './classifySignal'

const BASE_INPUT: ClassificationInput = {
  absoluteFrequencyHz: 100_100_000,
  bandwidthHz: 200_000,
  snrDb: 35,
  hitCount: 5,
  edgeClipped: false,
  captureBandwidthHz: 1_000_000,
  binWidthHz: 500,
}

describe('classifySignal', () => {
  it('does not infer an RF service without an absolute center frequency', () => {
    const result = classifySignal(
      { ...BASE_INPUT, absoluteFrequencyHz: null },
      'fcc-us',
    )

    expect(result.primary.category).toBe('unknown')
    expect(result.primary.reasons[0]).toContain('Absolute RF frequency')
  })

  it('can disable allocation matching while retaining spectral shape', () => {
    const result = classifySignal(BASE_INPUT, 'none')

    expect(result.primary.category).toBe('unknown')
    expect(result.spectralShape).toBe('medium-band')
  })

  it.each([
    [60_000, 1_000, 'standard-time-frequency'],
    [1_000_000, 10_000, 'am-broadcast'],
    [100_100_000, 200_000, 'fm-broadcast'],
    [10_000_000, 5_000, 'standard-time-frequency'],
    [146_520_000, 15_000, 'amateur'],
    [121_500_000, 12_500, 'aviation'],
    [593_000_000, 5_500_000, 'television'],
  ] as const)(
    'matches representative US allocation at %s Hz',
    (absoluteFrequencyHz, bandwidthHz, category) => {
      const result = classifySignal(
        { ...BASE_INPUT, absoluteFrequencyHz, bandwidthHz },
        'fcc-us',
      )

      expect(result.primary.category).toBe(category)
      expect(result.primary.score).toBeGreaterThan(0.5)
      expect(result.primary.reasons.length).toBeGreaterThan(1)
    },
  )

  it('returns unknown outside curated allocations', () => {
    const result = classifySignal(
      { ...BASE_INPUT, absoluteFrequencyHz: 40_000_000 },
      'fcc-us',
    )

    expect(result.primary.category).toBe('unknown')
  })

  it('preserves the television allocation gap between channels 4 and 5', () => {
    const gap = classifySignal(
      { ...BASE_INPUT, absoluteFrequencyHz: 73_000_000 },
      'fcc-us',
    )
    const channelFive = classifySignal(
      { ...BASE_INPUT, absoluteFrequencyHz: 79_000_000 },
      'fcc-us',
    )

    expect(gap.primary.category).toBe('unknown')
    expect(channelFive.primary.label).toContain('channel 5')
  })

  it('uses the current FCC 60 m amateur allocation boundaries', () => {
    const belowBand = classifySignal(
      { ...BASE_INPUT, absoluteFrequencyHz: 5_340_000, bandwidthHz: 2_000 },
      'fcc-us',
    )
    const insideBand = classifySignal(
      { ...BASE_INPUT, absoluteFrequencyHz: 5_360_000, bandwidthHz: 2_000 },
      'fcc-us',
    )

    expect(belowBand.primary.category).toBe('unknown')
    expect(insideBand.primary.category).toBe('amateur')
    expect(insideBand.primary.label).toContain('60 m')
  })

  it('caps edge-clipped evidence and explains the partial capture', () => {
    const result = classifySignal(
      {
        ...BASE_INPUT,
        absoluteFrequencyHz: 593_000_000,
        bandwidthHz: 1_000_000,
        edgeClipped: true,
      },
      'fcc-us',
    )

    expect(result.primary.category).toBe('television')
    expect(result.primary.score).toBeLessThanOrEqual(0.72)
    expect(result.primary.caveats.join(' ')).toContain('capture edge')
    expect(result.spectralShape).toBe('partial')
  })
})