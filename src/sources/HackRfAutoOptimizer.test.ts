import { describe, expect, it } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import { DEFAULT_HACKRF_CONFIG, type HackRfConfig } from './hackrfProtocol'
import { HackRfAutoOptimizer, type HackRfAutoOptimizerInput } from './HackRfAutoOptimizer'

function signal(
  id: string,
  frequencyHz: number,
  snrDb: number,
  overrides: Partial<TrackedSignal> = {},
): TrackedSignal {
  return {
    id,
    peakOffsetHz: frequencyHz - 100_000_000,
    lowerOffsetHz: frequencyHz - 100_100_000,
    upperOffsetHz: frequencyHz - 99_900_000,
    absoluteFrequencyHz: frequencyHz,
    lowerFrequencyHz: frequencyHz - 100_000,
    upperFrequencyHz: frequencyHz + 100_000,
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
        allocationId: `fm-${frequencyHz}`,
        channelCenterHz: frequencyHz,
        label: 'FM broadcast',
        category: 'fm-broadcast',
        score: 0.9,
        reasons: [],
        caveats: [],
      },
      alternatives: [],
    },
    ...overrides,
  }
}

function input(
  overrides: Partial<HackRfAutoOptimizerInput> = {},
): HackRfAutoOptimizerInput {
  return {
    enabled: true,
    running: true,
    nowMs: 1_000,
    config: DEFAULT_HACKRF_CONFIG,
    signals: [signal('signal-1', 100_100_000, 20)],
    selectedTargetFrequencyHz: null,
    peakPowerDbfs: -14,
    ...overrides,
  }
}

function observeFour(
  optimizer: HackRfAutoOptimizer,
  config: HackRfConfig,
  peakPowerDbfs: number,
  snrDb = 20,
  startMs = 1_000,
) {
  let result
  for (let index = 0; index < 4; index += 1) {
    result = optimizer.update(input({
      nowMs: startMs + index * 250,
      config,
      signals: [signal('signal-1', 100_100_000, snrDb)],
      peakPowerDbfs,
    }))
  }
  return result!
}

describe('HackRfAutoOptimizer', () => {
  it('waits for HackRF and stable confirmed signals', () => {
    const optimizer = new HackRfAutoOptimizer()
    expect(optimizer.update(input({ running: false })).status).toBe('waiting-for-source')
    expect(
      optimizer.update(input({
        signals: [signal('signal-1', 100_100_000, 20, { hitCount: 5 })],
      })).status,
    ).toBe('waiting-for-signal')
  })

  it('prefers the selected signal over a stronger fallback', () => {
    const optimizer = new HackRfAutoOptimizer()
    const result = optimizer.update(input({
      config: { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_300_000 },
      signals: [
        signal('selected', 100_100_000, 15),
        signal('strongest', 100_500_000, 35),
      ],
      selectedTargetFrequencyHz: 100_100_000,
    }))

    expect(result.targetFrequencyHz).toBe(100_100_000)
  })

  it('retunes a centered target to a preferred low-side IF offset', () => {
    const optimizer = new HackRfAutoOptimizer()
    const result = optimizer.update(input({
      config: { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_100_000 },
    }))

    expect(result.command).toEqual({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_850_000,
    })
    expect(result.status).toBe('retuning')
  })

  it('keeps a safe off-center placement and uses VGA first for excess level', () => {
    const optimizer = new HackRfAutoOptimizer()
    const config = { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 99_950_000 }
    const result = observeFour(optimizer, config, -6)

    expect(result.command).toEqual({ type: 'set-vga-gain', vgaGainDb: 18 })
  })

  it('keeps optimized status while collecting the next measurement window', () => {
    const optimizer = new HackRfAutoOptimizer()
    const config = { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 99_950_000 }
    const optimized = observeFour(optimizer, config, -14, 30)
    const nextObservation = optimizer.update(input({
      nowMs: 2_000,
      config,
      signals: [signal('signal-1', 100_100_000, 29.8)],
      peakPowerDbfs: -14.2,
    }))

    expect(optimized.status).toBe('optimized')
    expect(nextObservation.status).toBe('optimized')
    expect(nextObservation.detail).toBe(optimized.detail)
  })

  it('probes LNA gain for a weak signal and reverts without an SNR improvement', () => {
    const optimizer = new HackRfAutoOptimizer()
    const config = { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 99_950_000 }
    const probe = observeFour(optimizer, config, -25, 20)
    expect(probe.command).toEqual({ type: 'set-lna-gain', lnaGainDb: 24 })

    optimizer.commandApplied(probe.command!, 2_000)
    const probedConfig = { ...config, lnaGainDb: 24 }
    const reverted = observeFour(optimizer, probedConfig, -17, 20.2, 3_000)
    expect(reverted.command).toEqual({ type: 'set-lna-gain', lnaGainDb: 16 })
  })

  it('does not emit duplicate commands while one is in flight', () => {
    const optimizer = new HackRfAutoOptimizer()
    const config = { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_100_000 }
    const first = optimizer.update(input({ config }))
    const second = optimizer.update(input({ config, nowMs: 1_250 }))

    expect(first.command?.type).toBe('set-center-frequency')
    expect(second.command).toBeNull()
    expect(second.status).toBe('retuning')
  })

  it('keeps RF identity across track churn and releases it after two seconds missing', () => {
    const optimizer = new HackRfAutoOptimizer()
    const config = { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 99_950_000 }
    const acquired = optimizer.update(input({
      nowMs: 1_000,
      config,
      signals: [
        signal('original', 100_100_000, 30),
        signal('other', 100_500_000, 20),
      ],
    }))
    expect(acquired.targetFrequencyHz).toBe(100_100_000)

    const churned = optimizer.update(input({
      nowMs: 1_250,
      config,
      signals: [
        signal('replacement', 100_100_000, 12),
        signal('other', 100_500_000, 40),
      ],
    }))
    expect(churned.targetFrequencyHz).toBe(100_100_000)

    const duringGrace = optimizer.update(input({ nowMs: 2_500, config, signals: [] }))
    expect(duringGrace.targetFrequencyHz).toBe(100_100_000)
    const expired = optimizer.update(input({ nowMs: 3_251, config, signals: [] }))
    expect(expired.targetFrequencyHz).toBeNull()
  })

  it('stops immediately when disabled and exposes command failures', () => {
    const optimizer = new HackRfAutoOptimizer()
    optimizer.update(input({ config: { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_100_000 } }))
    optimizer.commandFailed('USB control failed.')
    expect(optimizer.update(input()).status).toBe('error')
    expect(optimizer.update(input({ enabled: false })).status).toBe('off')
  })
})