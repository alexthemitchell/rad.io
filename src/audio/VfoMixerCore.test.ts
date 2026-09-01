import { describe, expect, it } from 'vitest'
import type { VfoAudioBlock, VfoMixerControl } from '../vfo/types'
import { VfoMixerCore } from './VfoMixerCore'

const controls: VfoMixerControl[] = [
  {
    id: 'vfo-1',
    sourceSessionId: 'hackrf-1',
    revision: 1,
    gainDb: 0,
    muted: false,
    solo: false,
    active: true,
  },
  {
    id: 'vfo-2',
    sourceSessionId: 'rtl-sdr-1',
    revision: 1,
    gainDb: 0,
    muted: false,
    solo: false,
    active: true,
  },
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
    stereoLocked: false,
    samples: new Float32Array(samples),
    ...change,
  }
}

describe('VfoMixerCore', () => {
  it('mixes enabled VFOs and honors mute and solo', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure(controls, 0, false)
    mixer.push('hackrf-1', block('vfo-1', [0.2, 0.2]))
    mixer.push('rtl-sdr-1', block('vfo-2', [0.3, 0.3]))
    const left = new Float32Array(2)
    const right = new Float32Array(2)
    mixer.render(left, right)
    expect([...left]).toEqual([0.5, 0.5])
    expect([...right]).toEqual([0.5, 0.5])

    mixer.configure([
      { ...controls[0], solo: true },
      controls[1],
    ], 0, false)
    mixer.push('hackrf-1', block('vfo-1', [0.2, 0.2]))
    mixer.push('rtl-sdr-1', block('vfo-2', [0.3, 0.3]))
    mixer.render(left, right)
    expect([...left]).toEqual([
      expect.closeTo(0.2, 6),
      expect.closeTo(0.2, 6),
    ])
  })

  it('rejects cross-source blocks and flushes only one source', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure(controls, 0, false)
    mixer.push('rtl-sdr-1', block('vfo-1', [0.9, 0.9]))
    mixer.push('hackrf-1', block('vfo-1', [0.2, 0.2]))
    mixer.push('rtl-sdr-1', block('vfo-2', [0.3, 0.3]))

    expect(mixer.diagnostics()).toMatchObject({
      queuedFrames: { 'vfo-1': 2, 'vfo-2': 2 },
      staleBlocks: 1,
      staleBlocksBySource: { 'rtl-sdr-1': 1 },
    })

    mixer.flushSource('hackrf-1')
    expect(mixer.diagnostics().queuedFrames).toEqual({ 'vfo-2': 2 })
  })

  it('drops stale revisions and flushes a queue when configuration advances', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure([controls[0]], 0, false)
    mixer.push('hackrf-1', block('vfo-1', [0.2, 0.2], { revision: 2 }))
    expect(mixer.diagnostics().staleBlocks).toBe(1)

    mixer.push('hackrf-1', block('vfo-1', [0.2, 0.2]))
    mixer.configure([{ ...controls[0], revision: 2 }], 0, false)
    expect(mixer.diagnostics().queuedFrames['vfo-1']).toBeUndefined()
  })

  it('discards muted queues so unmute cannot replay stale audio', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 100 })
    mixer.configure([controls[0]], 0, false)
    mixer.push('hackrf-1', block('vfo-1', Array.from({ length: 100 }, () => 0.2)))
    mixer.render(new Float32Array(100), new Float32Array(100))

    mixer.configure([{ ...controls[0], muted: true }], 0, false)
    mixer.push('hackrf-1', block('vfo-1', [0.2, 0.2]))
    mixer.render(new Float32Array(2), new Float32Array(2))
    expect(mixer.diagnostics().queuedFrames['vfo-1']).toBe(0)

    mixer.configure([controls[0]], 0, false)
    mixer.render(new Float32Array(2), new Float32Array(2))
    expect(mixer.diagnostics().underruns['vfo-1']).toBe(0)
  })

  it('bounds queue latency by dropping oldest frames', () => {
    const mixer = new VfoMixerCore({
      sampleRateHz: 1_000,
      prebufferMs: 0,
      maximumQueueMs: 4,
    })
    mixer.configure([controls[0]], 0, false)
    mixer.push('hackrf-1', block('vfo-1', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))
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
    mixer.push('hackrf-1', block('vfo-1', Array.from({ length: 100 }, () => 0.25)))
    mixer.render(new Float32Array(100), new Float32Array(100))

    mixer.render(new Float32Array(2), new Float32Array(2))
    expect(mixer.diagnostics().underruns['vfo-1']).toBe(1)

    mixer.push('hackrf-1', block('vfo-1', [0.25, 0.25]))
    const left = new Float32Array(2)
    mixer.render(left, new Float32Array(2))
    expect([...left]).toEqual([
      expect.closeTo(0.25, 6),
      expect.closeTo(0.25, 6),
    ])
  })

  it.each([0.9975, 1.0025])(
    'rate-matches an independent source clock at %s of the output clock',
    (sourceClockRatio) => {
      const mixer = new VfoMixerCore({
        sampleRateHz: 1_000,
        prebufferMs: 100,
        maximumQueueMs: 250,
      })
      mixer.configure([controls[0]], 0, false)
      mixer.push('hackrf-1', block('vfo-1', Array.from({ length: 100 }, () => 0.25)))

      let producerFrames = 0
      const left = new Float32Array(10)
      const right = new Float32Array(10)
      for (let render = 0; render < 12_000; render += 1) {
        producerFrames += left.length * sourceClockRatio
        const completeFrames = Math.floor(producerFrames)
        producerFrames -= completeFrames
        mixer.push(
          'hackrf-1',
          block('vfo-1', Array.from({ length: completeFrames }, () => 0.25)),
        )
        mixer.render(left, right)
      }

      expect(mixer.diagnostics()).toMatchObject({
        underruns: { 'vfo-1': 0 },
        overruns: { 'vfo-1': 0 },
      })
    },
  )

  it('rate-matches two source clocks drifting in opposite directions', () => {
    const mixer = new VfoMixerCore({
      sampleRateHz: 1_000,
      prebufferMs: 100,
      maximumQueueMs: 250,
    })
    mixer.configure(controls, 0, false)
    for (const control of controls) {
      mixer.push(
        control.sourceSessionId,
        block(control.id, Array.from({ length: 100 }, () => 0.125)),
      )
    }

    const producerFrames = [0, 0]
    const sourceClockRatios = [0.9975, 1.0025]
    const left = new Float32Array(10)
    const right = new Float32Array(10)
    for (let render = 0; render < 12_000; render += 1) {
      for (let index = 0; index < controls.length; index += 1) {
        producerFrames[index] += left.length * sourceClockRatios[index]
        const completeFrames = Math.floor(producerFrames[index])
        producerFrames[index] -= completeFrames
        const control = controls[index]
        mixer.push(
          control.sourceSessionId,
          block(control.id, Array.from({ length: completeFrames }, () => 0.125)),
        )
      }
      mixer.render(left, right)
    }

    expect(mixer.diagnostics()).toMatchObject({
      underruns: { 'vfo-1': 0, 'vfo-2': 0 },
      overruns: { 'vfo-1': 0, 'vfo-2': 0 },
    })
  })

  it('preserves stereo channels and applies a ceiling limiter', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure([controls[0]], 0, false)
    mixer.push('hackrf-1', block('vfo-1', [2, -2, 2, -2], { channelCount: 2 }))
    const left = new Float32Array(2)
    const right = new Float32Array(2)
    mixer.render(left, right)
    expect(left[0]).toBeGreaterThan(0)
    expect(right[0]).toBeLessThan(0)
    expect(Math.max(...left.map(Math.abs), ...right.map(Math.abs))).toBeLessThanOrEqual(1)
    expect(mixer.diagnostics().limiterReductionDb).toBeLessThan(0)
  })

  it('reports lock only from accepted current-revision blocks', () => {
    const mixer = new VfoMixerCore({ sampleRateHz: 1_000, prebufferMs: 0 })
    mixer.configure([controls[0]], 0, false)
    mixer.push('hackrf-1', block('vfo-1', [0.2], { stereoLocked: true }))
    expect(mixer.diagnostics().stereoLocked['vfo-1']).toBe(true)

    mixer.push('hackrf-1', block('vfo-1', [0.2], { revision: 2, stereoLocked: false }))
    expect(mixer.diagnostics().stereoLocked['vfo-1']).toBe(true)

    mixer.configure([{ ...controls[0], revision: 2 }], 0, false)
    expect(mixer.diagnostics().stereoLocked['vfo-1']).toBeUndefined()
  })
})