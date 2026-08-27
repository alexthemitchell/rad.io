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
      channelCenterHz: 100_100_000,
      label: 'FM broadcast channel 261 (100.1 MHz)',
      category: 'fm-broadcast',
      score: 0.94,
      reasons: ['Frequency is inside the listed channel.'],
      caveats: [],
    },
    alternatives: [],
  },
}

const RDS_SIGNAL: TrackedSignal = {
  ...SIGNAL,
  rds: {
    channelCenterHz: 100_100_000,
    state: 'locked',
    reason: null,
    metadata: {
      pi: { value: 0x54a1, updatedAtUs: 2_000_000n },
      callSign: null,
      ps: { value: 'RAD.IO', complete: true, updatedAtUs: 2_000_000n },
      pty: { value: 2, updatedAtUs: 2_000_000n },
      ptyName: { value: 'Information', updatedAtUs: 2_000_000n },
      ptyn: { value: 'PUBLIC', complete: true, updatedAtUs: 2_000_000n },
      trafficProgram: { value: true, updatedAtUs: 2_000_000n },
      trafficAnnouncement: { value: false, updatedAtUs: 2_000_000n },
      musicSpeech: { value: false, updatedAtUs: 2_000_000n },
      decoderInfo: {
        value: {
          stereo: true,
          artificialHead: false,
          compressed: false,
          dynamicPty: false,
        },
        updatedAtUs: 2_000_000n,
      },
      alternativeFrequencies: {
        value: {
          frequenciesHz: [99_900_000, 100_100_000],
          expectedCount: 2,
          complete: true,
        },
        updatedAtUs: 2_000_000n,
      },
      extendedCountryCode: { value: 0xa0, updatedAtUs: 2_000_000n },
      programItemNumber: { value: 0x1234, updatedAtUs: 2_000_000n },
      radioText: {
        value: 'RAD.IO synthetic RBDS test station',
        complete: true,
        updatedAtUs: 2_000_000n,
      },
      clockTime: {
        value: { isoUtc: '2026-08-27T16:30:00Z', localOffsetMinutes: -240 },
        updatedAtUs: 2_000_000n,
      },
      odaRegistrations: [],
      tmcMessages: [],
      eonRecords: [],
      rawGroups: [
        {
          groupType: 0,
          version: 'A',
          blocks: [0x54a1, 0x045c, 0xe201, 0x5241],
          correctedBlocks: 0,
          receivedAtUs: 2_000_000n,
          applicationId: null,
        },
      ],
      groupsByType: [8, 0],
      lastValidGroupAtUs: 2_000_000n,
    },
    diagnostics: {
      synchronized: true,
      validGroups: 24,
      correctedBlocks: 1,
      rejectedGroups: 2,
      lostSyncCount: 0,
      lastValidGroupAtUs: 2_000_000n,
    },
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

  it('shows a decoded station name in the row and extended RBDS details', () => {
    render(
      <DetectedSignalsPanel
        config={DEFAULT_DETECTION_CONFIG}
        signals={[RDS_SIGNAL]}
        centerFrequencyHz={100_000_000}
        onConfigChange={vi.fn()}
      />,
    )

    expect(screen.getAllByText('RAD.IO')).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'RBDS station data' })).toHaveTextContent(
      'Synchronized',
    )
    expect(screen.getByText('0x54A1')).toBeVisible()
    expect(screen.getByText('PUBLIC (Information)')).toBeVisible()
    expect(screen.getByText('RAD.IO synthetic RBDS test station')).toBeVisible()
    expect(screen.getByText('99.9000 MHz, 100.1000 MHz')).toBeVisible()
    expect(screen.getByText('24 valid groups')).toBeVisible()
  })
})