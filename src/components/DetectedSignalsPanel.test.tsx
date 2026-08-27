import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DETECTION_CONFIG,
  type TrackedSignal,
} from '../workers/protocol'
import { DetectedSignalsPanel } from './DetectedSignalsPanel'

const SIGNAL: TrackedSignal = {
  id: 'signal-1',
  peakOffsetHz: 100_000,
  lowerOffsetHz: 10_000,
  upperOffsetHz: 190_000,
  absoluteFrequencyHz: 100_100_000,
  lowerFrequencyHz: 100_010_000,
  upperFrequencyHz: 100_190_000,
  bandwidthHz: 180_000,
  peakPowerDbfs: -30,
  snrDb: 35,
  edgeClipped: false,
  firstSeenUs: 0n,
  lastSeenUs: 2_000_000n,
  durationUs: 2_000_000n,
  hitCount: 7,
  state: 'active',
  classification: {
    profileId: 'fcc-us',
    spectralShape: 'medium-band',
    primary: {
      allocationId: 'fm-100100000',
      label: 'FM broadcast channel 261 (100.1 MHz)',
      category: 'fm-broadcast',
      score: 0.94,
      reasons: ['Frequency is inside the listed channel.'],
      caveats: [],
    },
    alternatives: [],
  },
}

describe('DetectedSignalsPanel', () => {
  it('renders measured metadata and classification evidence', () => {
    render(
      <DetectedSignalsPanel
        config={DEFAULT_DETECTION_CONFIG}
        signals={[SIGNAL]}
        centerFrequencyHz={100_000_000}
        onConfigChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'FM broadcast channel 261 (100.1 MHz), 100.1000 MHz, active, track #1',
      }),
    ).toBeVisible()
    expect(screen.getByRole('cell', { name: 'active' })).toBeVisible()
    expect(screen.getByText('100.1000 MHz')).toBeVisible()
    expect(screen.getByText('35.0 dB')).toBeVisible()
    expect(screen.getByText('94% evidence')).toBeVisible()
    expect(screen.getByText('Frequency is inside the listed channel.')).toBeVisible()
  })

  it('emits detector sensitivity and profile changes', () => {
    const onConfigChange = vi.fn()
    render(
      <DetectedSignalsPanel
        config={DEFAULT_DETECTION_CONFIG}
        signals={[]}
        centerFrequencyHz={0}
        onConfigChange={onConfigChange}
      />,
    )

    fireEvent.change(screen.getByRole('slider', { name: 'Minimum SNR' }), {
      target: { value: '18' },
    })
    expect(onConfigChange).toHaveBeenCalledWith({
      ...DEFAULT_DETECTION_CONFIG,
      minimumSnrDb: 18,
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), {
      target: { value: 'none' },
    })
    expect(onConfigChange).toHaveBeenCalledWith({
      ...DEFAULT_DETECTION_CONFIG,
      bandPlanId: 'none',
    })
    expect(screen.getByText('RF classification unavailable at 0 Hz center.')).toBeVisible()
  })
})