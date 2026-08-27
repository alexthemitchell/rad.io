import { describe, expect, it } from 'vitest'
import { formatFrequency, waveformChannelAmplitude } from './canvas'
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

  it('keeps both waveform channels inside their quarter-height lanes', () => {
    const height = 100
    const amplitude = waveformChannelAmplitude(height)

    expect(amplitude).toBe(18)
    expect(height / 4 - amplitude).toBeGreaterThanOrEqual(0)
    expect((height * 3) / 4 + amplitude).toBeLessThanOrEqual(height)
  })
})