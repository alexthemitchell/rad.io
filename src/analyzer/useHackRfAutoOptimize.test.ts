import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TrackedSignal } from '../workers/protocol'
import { DEFAULT_HACKRF_CONFIG } from '../sources/hackrfProtocol'
import type { HackRFSource } from '../sources/HackRFSource'
import { useHackRfAutoOptimize } from './useHackRfAutoOptimize'

const SIGNAL: TrackedSignal = {
  id: 'signal-1',
  peakOffsetHz: 0,
  lowerOffsetHz: -100_000,
  upperOffsetHz: 100_000,
  absoluteFrequencyHz: 100_100_000,
  lowerFrequencyHz: 100_000_000,
  upperFrequencyHz: 100_200_000,
  bandwidthHz: 200_000,
  peakPowerDbfs: -14,
  snrDb: 24,
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

const CENTERED_CONFIG = { ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_100_000 }
const SIGNALS = [SIGNAL]

describe('useHackRfAutoOptimize', () => {
  it('reconciles an in-flight command after automation is disabled', async () => {
    let resolveCommand: (config: typeof DEFAULT_HACKRF_CONFIG) => void = () => undefined
    const commandResult = new Promise<typeof DEFAULT_HACKRF_CONFIG>((resolve) => {
      resolveCommand = resolve
    })
    const applyRuntimeCommand = vi.fn(() => commandResult)
    const source = { applyRuntimeCommand } as unknown as HackRFSource
    const onApplied = vi.fn()
    const onFailure = vi.fn()
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useHackRfAutoOptimize({
        enabled,
        running: true,
        source,
        config: CENTERED_CONFIG,
        signals: SIGNALS,
        selectedTargetFrequencyHz: 100_100_000,
        peakPowerDbfs: -14,
        onApplied,
        onFailure,
      }),
      { initialProps: { enabled: true } },
    )

    await waitFor(() => expect(applyRuntimeCommand).toHaveBeenCalledOnce())
    rerender({ enabled: false })
    await act(async () => {
      resolveCommand({ ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 99_850_000 })
      await commandResult
    })

    await waitFor(() => expect(onApplied).toHaveBeenCalledOnce())
    expect(onFailure).not.toHaveBeenCalled()
    expect(result.current.status).toBe('off')
    expect(applyRuntimeCommand).toHaveBeenCalledOnce()
  })
})