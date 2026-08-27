import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisFrameEvent } from '../workers/protocol'
import { FrameHub } from './FrameHub'

function frame(sequence: number): AnalysisFrameEvent {
  return {
    type: 'analysis-frame',
    protocolVersion: 1,
    sequence,
    waveform: new Float32Array([1, 0]),
    spectrumDb: new Float32Array([-120, -12]),
    sampleRateHz: 1_000_000,
    centerFrequencyHz: 0,
    peakFrequencyHz: 100_000,
    peakPowerDbfs: -12,
    elapsedSamples: BigInt(sequence * 2048),
    processingTimeMs: 1,
    sourceSequence: sequence,
    timestampUs: BigInt(sequence * 2048),
    formatVersion: 1,
  }
}

describe('FrameHub', () => {
  let scheduled: FrameRequestCallback | undefined

  beforeEach(() => {
    scheduled = undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      scheduled = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('delivers the newest frame on animation frame and acknowledges replaced work', () => {
    const hub = new FrameHub()
    const listener = vi.fn()
    const firstAcknowledged = vi.fn()
    const secondAcknowledged = vi.fn()
    hub.subscribe(listener)

    hub.publish(frame(1), firstAcknowledged)
    hub.publish(frame(2), secondAcknowledged)

    expect(firstAcknowledged).toHaveBeenCalledOnce()
    expect(listener).not.toHaveBeenCalled()
    scheduled?.(0)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ sequence: 2 }))
    expect(secondAcknowledged).toHaveBeenCalledOnce()
    expect(hub.latest?.sequence).toBe(2)
  })

  it('clears a queued frame without delivery and releases worker backpressure', () => {
    const hub = new FrameHub()
    const listener = vi.fn()
    const acknowledged = vi.fn()
    hub.subscribe(listener)
    hub.publish(frame(1), acknowledged)

    hub.clear()
    scheduled?.(0)

    expect(listener).not.toHaveBeenCalled()
    expect(acknowledged).toHaveBeenCalledOnce()
    expect(hub.latest).toBeUndefined()
  })

  it('releases worker backpressure when a renderer throws', () => {
    const hub = new FrameHub()
    const acknowledged = vi.fn()
    hub.subscribe(() => {
      throw new Error('render failed')
    })
    hub.publish(frame(1), acknowledged)

    expect(() => scheduled?.(0)).toThrow('render failed')
    expect(acknowledged).toHaveBeenCalledOnce()
  })
})