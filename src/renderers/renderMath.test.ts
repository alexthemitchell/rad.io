import { describe, expect, it } from 'vitest'
import {
  formatFrequency,
  formatRfFrequency,
  frequencyOffsetToX,
  waveformChannelAmplitude,
  xToFrequencyOffset,
} from './canvas'
import { spectrumIndex, WATERFALL_LUT } from './colorMap'

describe('render math', () => {
  it('maps the visible dBFS range monotonically into the color table', () => {
    expect(spectrumIndex(-120)).toBe(0)
    expect(spectrumIndex(-65)).toBeGreaterThan(spectrumIndex(-100))
    expect(spectrumIndex(-10)).toBe(255)
    expect(WATERFALL_LUT).toHaveLength(1024)
  })

  it('formats signed analyzer frequencies at useful units', () => {
    expect(formatFrequency(100_000, true)).toBe('+100.0 kHz')
    expect(formatFrequency(-125_000, true)).toBe('-125.0 kHz')
    expect(formatFrequency(0, true)).toBe('0 Hz')
  })

  it('formats absolute RF frequencies with channel-level precision', () => {
    expect(formatRfFrequency(100_100_000)).toBe('100.1000 MHz')
    expect(formatRfFrequency(1_296_100_000)).toBe('1.296100 GHz')
  })

  it('maps and clips baseband offsets into the spectrum plot', () => {
    expect(frequencyOffsetToX(-500_000, 1_000_000, 50, 400)).toBe(50)
    expect(frequencyOffsetToX(0, 1_000_000, 50, 400)).toBe(250)
    expect(frequencyOffsetToX(600_000, 1_000_000, 50, 400)).toBe(450)
  })

  it('inverts plot x-coordinates back into clipped baseband offsets', () => {
    expect(xToFrequencyOffset(50, 1_000_000, 50, 400)).toBe(-500_000)
    expect(xToFrequencyOffset(250, 1_000_000, 50, 400)).toBe(0)
    expect(xToFrequencyOffset(450, 1_000_000, 50, 400)).toBe(500_000)
    expect(xToFrequencyOffset(10, 1_000_000, 50, 400)).toBe(-500_000)
    expect(xToFrequencyOffset(1000, 1_000_000, 50, 400)).toBe(500_000)
    expect(xToFrequencyOffset(frequencyOffsetToX(120_000, 1_000_000, 50, 400), 1_000_000, 50, 400)).toBeCloseTo(
      120_000,
      0,
    )
  })

  it('keeps both waveform channels inside their quarter-height lanes', () => {
    const height = 100
    const amplitude = waveformChannelAmplitude(height)

    expect(amplitude).toBe(18)
    expect(height / 4 - amplitude).toBeGreaterThanOrEqual(0)
    expect((height * 3) / 4 + amplitude).toBeLessThanOrEqual(height)
  })
})