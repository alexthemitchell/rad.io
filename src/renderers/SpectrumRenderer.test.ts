import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL_VERSION, type AnalysisFrameEvent } from '../workers/protocol'
import { SpectrumRenderer } from './SpectrumRenderer'

function frame(overrides: Partial<AnalysisFrameEvent> = {}): AnalysisFrameEvent {
  return {
    type: 'analysis-frame',
    protocolVersion: PROTOCOL_VERSION,
    sequence: 1,
    waveform: new Float32Array([0, 0]),
    spectrumDb: new Float32Array([-90, -60, -30, -60]),
    noiseFloorDbfs: -90,
    detections: [],
    trackedSignals: [],
    rdsTargets: [],
    sampleRateHz: 1_000_000,
    centerFrequencyHz: 100_000_000,
    peakFrequencyHz: 0,
    peakPowerDbfs: -30,
    elapsedSamples: 0n,
    processingTimeMs: 1,
    sourceSequence: 1,
    timestampUs: 0n,
    formatVersion: 1,
    ...overrides,
  }
}

function createStubContext(): CanvasRenderingContext2D {
  const noop = () => undefined
  const context = {
    setTransform: noop,
    fillRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    stroke: noop,
    fill: noop,
    rect: noop,
    clip: noop,
    fillText: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
  }
  return context as unknown as CanvasRenderingContext2D
}

describe('SpectrumRenderer hitTest', () => {
  let renderer: SpectrumRenderer

  beforeEach(() => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(createStubContext())
    renderer = new SpectrumRenderer(canvas)
    // width=500, height=300 -> plot area is x:[50,482], y:[18,270]
    renderer.resize(500, 300, 1)
  })

  it('returns null before any frame has been drawn', () => {
    expect(renderer.hitTest(266, 100)).toBeNull()
  })

  it('returns null for positions outside the plotted axes', () => {
    renderer.draw(frame())
    expect(renderer.hitTest(10, 100)).toBeNull()
    expect(renderer.hitTest(266, 5)).toBeNull()
  })

  it('maps a plot position to the absolute frequency and power at that offset', () => {
    renderer.draw(frame())
    const atCenter = renderer.hitTest(266, 100)
    expect(atCenter?.frequencyHz).toBeCloseTo(100_000_000, -1)
    expect(atCenter?.powerDb).toBe(-45)

    const atLeftEdge = renderer.hitTest(50, 100)
    expect(atLeftEdge?.frequencyHz).toBeCloseTo(99_500_000, -1)
    expect(atLeftEdge?.powerDb).toBe(-90)
  })

  it('returns null once the frame is reset', () => {
    renderer.draw(frame())
    renderer.reset()
    expect(renderer.hitTest(266, 100)).toBeNull()
  })
})
