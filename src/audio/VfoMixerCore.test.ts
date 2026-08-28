import { describe, expect, it } from 'vitest'
import type { VfoAudioBlock, VfoMixerControl } from '../vfo/types'
import { VfoMixerCore } from './VfoMixerCore'

const controls: VfoMixerControl[] = [
  { id: 'vfo-1', revision: 1, gainDb: 0, muted: false, solo: false, active: true },
  { id: 'vfo-2', revision: 1, gainDb: 0, muted: false, solo: false, active: true },
]

function block(
  vfoId: string,
  samples: number[],
  change: Partial<VfoAudioBlock> = {},
): VfoAudioBlock {
  return {
    vfoId,
    revision: 1,
    sourceTimestampUs: 0n,
    sampleRateHz: 1_000,
    channelCount: 1,
    signalLevelDbfs: -20,
    squelched: false,
    samples: new Float32Array(samples),
    ...change,
  }
}

describe('VfoMixerCore', () => {
  it('mixes enabled VFOs and honors mute and solo', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure(controls, 0, false)
    mixer.push(block('vfo-1', [0.2, 0.2]))
    mixer.push(block('vfo-2', [0.3, 0.3]))
    const left = new Float32Array(2)
    const right = new Float32Array(2)
    mixer.render(left, right)
    expect([...left]).toEqual([0.5, 0.5])
    expect([...right]).toEqual([0.5, 0.5])

    mixer.configure([
      { ...controls[0], solo: true },
      controls[1],
    ], 0, false)
    mixer.push(block('vfo-1', [0.2, 0.2]))
    mixer.push(block('vfo-2', [0.3, 0.3]))
    mixer.render(left, right)
    expect([...left]).toEqual([
      expect.closeTo(0.2, 6),
      expect.closeTo(0.2, 6),
    ])
  })

  it('drops stale revisions and flushes a queue when configuration advances', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure([controls[0]], 0, false)
    mixer.push(block('vfo-1', [0.2, 0.2], { revision: 2 }))
    expect(mixer.diagnostics().staleBlocks).toBe(1)

    mixer.push(block('vfo-1', [0.2, 0.2]))
    mixer.configure([{ ...controls[0], revision: 2 }], 0, false)
    expect(mixer.diagnostics().queuedFrames['vfo-1']).toBeUndefined()
  })

  it('discards muted queues so unmute cannot replay stale audio', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure([{ ...controls[0], muted: true }], 0, false)
    mixer.push(block('vfo-1', [0.2, 0.2]))
    mixer.render(new Float32Array(2), new Float32Array(2))
    expect(mixer.diagnostics().queuedFrames['vfo-1']).toBe(0)
  })

  it('bounds queue latency by dropping oldest frames', () => {
    const mixer = new VfoMixerCore({
      sampleRateHz: 1_000,
      prebufferMs: 0,
      maximumQueueMs: 4,
    })
    mixer.configure([controls[0]], 0, false)
    mixer.push(block('vfo-1', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))
    expect(mixer.diagnostics()).toMatchObject({
      queuedFrames: { 'vfo-1': 4 },
      overruns: { 'vfo-1': 1 },
    })
    const left = new Float32Array(4)
    mixer.render(left, new Float32Array(4))
    expect([...left]).toEqual([
      expect.closeTo(0.3, 6),
      expect.closeTo(0.4, 6),
      expect.closeTo(0.5, 6),
      expect.closeTo(0.6, 6),
    ])
  })

  it('resumes on the next complete block after a brief underrun', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 100 })
    mixer.configure([controls[0]], 0, false)
    mixer.push(block('vfo-1', Array.from({ length: 100 }, () => 0.25)))
    mixer.render(new Float32Array(100), new Float32Array(100))

    mixer.render(new Float32Array(2), new Float32Array(2))
    expect(mixer.diagnostics().underruns['vfo-1']).toBe(1)

    mixer.push(block('vfo-1', [0.25, 0.25]))
    const left = new Float32Array(2)
    mixer.render(left, new Float32Array(2))
    expect([...left]).toEqual([
      expect.closeTo(0.25, 6),
      expect.closeTo(0.25, 6),
    ])
  })

  it('preserves stereo channels and applies a ceiling limiter', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure([controls[0]], 0, false)
    mixer.push(block('vfo-1', [2, -2, 2, -2], { channelCount: 2 }))
    const left = new Float32Array(2)
    const right = new Float32Array(2)
    mixer.render(left, right)
    expect(left[0]).toBeGreaterThan(0)
    expect(right[0]).toBeLessThan(0)
    expect(Math.max(...left.map(Math.abs), ...right.map(Math.abs))).toBeLessThanOrEqual(1)
    expect(mixer.diagnostics().limiterReductionDb).toBeLessThan(0)
  })
})