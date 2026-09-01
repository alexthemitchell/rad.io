import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SourceSessionSnapshot } from '../analyzer/SourceSession'
import { DEFAULT_HACKRF_CONFIG } from '../sources/hackrfProtocol'
import { DEFAULT_DETECTION_CONFIG } from '../workers/protocol'
import { SourceSessionsPanel } from './SourceSessionsPanel'

const SESSION: SourceSessionSnapshot = {
  id: 'hackrf-1',
  kind: 'hackrf',
  label: 'HackRF One',
  serialNumber: 'abcdef123456',
  deviceConnected: true,
  config: DEFAULT_HACKRF_CONFIG,
  detectionConfig: DEFAULT_DETECTION_CONFIG,
  analyzer: {
    state: 'running',
    detail: 'live',
    sequence: 10,
    peakFrequencyHz: 100_000,
    peakPowerDbfs: -20,
    centerFrequencyHz: 100_000_000,
    noiseFloorDbfs: -90,
    trackedSignals: [],
    processingTimeMs: 1,
  },
  runtimePending: false,
  runtimeError: null,
  discontinuityRevision: 0,
  autoOptimize: {
    enabled: false,
    status: 'off',
    targetFrequencyHz: null,
    detail: 'Automatic optimization is off.',
  },
}

describe('SourceSessionsPanel', () => {
  it('selects sessions without invoking source lifecycle actions', () => {
    const onSelect = vi.fn()
    render(
      <SourceSessionsPanel
        sessions={[SESSION]}
        selectedSessionId={null}
        addDisabled={false}
        addError={null}
        authorizedDevices={[]}
        onSelect={onSelect}
        onAdd={vi.fn()}
        onAddAuthorized={vi.fn()}
        onPairNew={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /HackRF One/ }))
    expect(onSelect).toHaveBeenCalledWith('hackrf-1')
    expect(screen.getByText(/running · 123456/)).toBeVisible()
  })

  it('adds and removes devices through explicit commands', () => {
    const onAdd = vi.fn()
    const onRemove = vi.fn()
    render(
      <SourceSessionsPanel
        sessions={[SESSION]}
        selectedSessionId="hackrf-1"
        addDisabled={false}
        addError={null}
        authorizedDevices={[]}
        onSelect={vi.fn()}
        onAdd={onAdd}
        onAddAuthorized={vi.fn()}
        onPairNew={vi.fn()}
        onRemove={onRemove}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add device' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove HackRF One' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith('hackrf-1')
  })

  it('offers authorized devices without invoking the native pairing command', () => {
    const onAddAuthorized = vi.fn()
    const onPairNew = vi.fn()
    const device = {
      kind: 'hackrf' as const,
      label: 'HackRF One',
      device: {} as never,
      serialNumber: 'abc123',
    }
    render(
      <SourceSessionsPanel
        sessions={[]}
        selectedSessionId={null}
        addDisabled={false}
        addError={null}
        authorizedDevices={[device]}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onAddAuthorized={onAddAuthorized}
        onPairNew={onPairNew}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /HackRF One/ }))
    expect(onAddAuthorized).toHaveBeenCalledWith(device)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pair new device' }))
    expect(onPairNew).toHaveBeenCalledOnce()
  })
})