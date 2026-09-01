import { describe, expect, it } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import { RtlSdrAutoOptimizer, type RtlSdrAutoOptimizerInput } from './RtlSdrAutoOptimizer'
import { DEFAULT_RTL_SDR_CONFIG, type RtlSdrConfig } from './rtlSdrProtocol'

function signal(snrDb = 20): TrackedSignal {
  return {
    id: 'signal-1',
    peakOffsetHz: 100_000,
    lowerOffsetHz: 0,
    upperOffsetHz: 200_000,
    absoluteFrequencyHz: 100_100_000,
    lowerFrequencyHz: 100_000_000,
    upperFrequencyHz: 100_200_000,
    bandwidthHz: 200_000,
    peakPowerDbfs: -30,
    snrDb,
    edgeClipped: false,
    firstSeenUs: 0n,
    lastSeenUs: 2_000_000n,
    durationUs: 2_000_000n,
    hitCount: 20,
    state: 'active',
    classification: {
      profileId: 'fcc-us',
      spectralShape: 'medium-band',
      primary: {
        allocationId: 'fm-100100000',
        channelCenterHz: 100_100_000,
        label: 'FM broadcast',
        category: 'fm-broadcast',
        score: 0.9,
        reasons: [],
        caveats: [],
      },
      alternatives: [],
    },
  }
}

function input(overrides: Partial<RtlSdrAutoOptimizerInput> = {}): RtlSdrAutoOptimizerInput {
  return {
    enabled: true,
    running: true,
    nowMs: 1_000,
    config: DEFAULT_RTL_SDR_CONFIG,
    signals: [signal()],
    selectedTargetFrequencyHz: null,
    peakPowerDbfs: -14,
    ...overrides,
  }
}

function observeFour(
  optimizer: RtlSdrAutoOptimizer,
  config: RtlSdrConfig,
  peakPowerDbfs: number,
  snrDb = 20,
  startMs = 1_000,
) {
  let result
  for (let index = 0; index < 4; index += 1) {
    result = optimizer.update(input({
      nowMs: startMs + index * 250,
      config,
      signals: [signal(snrDb)],
      peakPowerDbfs,
    }))
  }
  return result!
}

describe('RtlSdrAutoOptimizer', () => {
  it('takes manual gain ownership at 24 dB before optimizing', () => {
    const optimizer = new RtlSdrAutoOptimizer()
    expect(optimizer.update(input()).command).toEqual({
      type: 'set-tuner-gain',
      tunerGainDb: 24,
    })
  })

  it('retunes a centered target after manual gain is established', () => {
    const optimizer = new RtlSdrAutoOptimizer()
    const config = { ...DEFAULT_RTL_SDR_CONFIG, tunerGainDb: 24, centerFrequencyHz: 100_100_000 }
    expect(optimizer.update(input({ config })).command).toEqual({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_850_000,
    })
  })

  it('probes the next discrete gain and reverts without SNR improvement', () => {
    const optimizer = new RtlSdrAutoOptimizer()
    const config = { ...DEFAULT_RTL_SDR_CONFIG, tunerGainDb: 24, centerFrequencyHz: 99_950_000 }
    const probe = observeFour(optimizer, config, -25, 20)
    expect(probe.command).toEqual({ type: 'set-tuner-gain', tunerGainDb: 29 })

    optimizer.commandApplied(probe.command!, 2_000)
    const reverted = observeFour(optimizer, { ...config, tunerGainDb: 29 }, -17, 20.2, 3_000)
    expect(reverted.command).toEqual({ type: 'set-tuner-gain', tunerGainDb: 24 })
  })

  it('steps gain down on overload and surfaces command errors', () => {
    const optimizer = new RtlSdrAutoOptimizer()
    const config = { ...DEFAULT_RTL_SDR_CONFIG, tunerGainDb: 24, centerFrequencyHz: 99_950_000 }
    expect(observeFour(optimizer, config, -6).command).toEqual({
      type: 'set-tuner-gain',
      tunerGainDb: 21.5,
    })
    optimizer.commandFailed('USB failed.')
    expect(optimizer.update(input({ config })).status).toBe('error')
  })
})