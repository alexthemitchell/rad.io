import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AudioPlaybackSnapshot } from '../audio/AudioPlaybackController'
import type { VfoConfig } from '../vfo/types'
import { VfoMixerPanel } from './VfoMixerPanel'

const VFO: VfoConfig = {
  id: 'vfo-1',
  sourceSessionId: 'generator',
  label: 'RAD.IO',
  frequencyHz: 100_100_000,
  mode: 'wbfm',
  bandwidthHz: 200_000,
  squelchDbfs: -85,
  revision: 1,
  gainDb: -6,
  muted: false,
  solo: false,
}

const AUDIO: AudioPlaybackSnapshot = {
  state: 'idle',
  sampleRateHz: null,
  detail: 'Audio idle',
  diagnostics: null,
}

const RUNNING_AUDIO: AudioPlaybackSnapshot = {
  state: 'running',
  sampleRateHz: 48_000,
  detail: '48,000 Hz audio output',
  diagnostics: {
    queuedFrames: { 'vfo-1': 960 },
    underruns: {},
    overruns: {},
    stereoLocked: { 'vfo-1': true },
    staleBlocks: 0,
    staleBlocksBySource: {},
    limiterReductionDb: 0,
  },
}

function renderPanel(change: Partial<Parameters<typeof VfoMixerPanel>[0]> = {}) {
  const props = {
    vfos: [VFO],
    sourceWindows: {
      generator: {
        label: 'Generator',
        available: true,
        running: true,
        centerFrequencyHz: 100_000_000,
        sampleRateHz: 1_000_000,
      },
    },
    audio: AUDIO,
    masterGainDb: -6,
    masterMuted: false,
    onAdd: vi.fn(),
    onUpdateDsp: vi.fn(),
    onUpdateMixer: vi.fn(),
    onRemove: vi.fn(),
    onTogglePlayback: vi.fn(),
    onMasterGainChange: vi.fn(),
    onMasterMutedChange: vi.fn(),
    ...change,
  }
  render(<VfoMixerPanel {...props} />)
  return props
}

describe('VfoMixerPanel', () => {
  it('exposes playback and mode-safe DSP controls', () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Start audio playback' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Mode' }), {
      target: { value: 'nbfm' },
    })
    fireEvent.change(screen.getByRole('slider', { name: /Squelch/ }), {
      target: { value: '-92' },
    })

    expect(props.onTogglePlayback).toHaveBeenCalledOnce()
    expect(props.onUpdateDsp).toHaveBeenCalledWith('vfo-1', { mode: 'nbfm' })
    expect(props.onUpdateDsp).toHaveBeenCalledWith('vfo-1', { squelchDbfs: -92 })
  })

  it('emits mixer-only controls and remove commands', () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Mute RAD.IO' }))
    fireEvent.click(screen.getByRole('button', { name: 'Solo RAD.IO' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove RAD.IO' }))

    expect(props.onUpdateMixer).toHaveBeenCalledWith('vfo-1', { muted: true })
    expect(props.onUpdateMixer).toHaveBeenCalledWith('vfo-1', { solo: true })
    expect(props.onRemove).toHaveBeenCalledWith('vfo-1')
  })

  it('shows receivers that do not fit the current source passband', () => {
    renderPanel({
      vfos: [{ ...VFO, frequencyHz: 102_000_000 }],
    })
    expect(screen.getByText('out of band')).toBeVisible()
  })

  it('shows source identity and offline state independently of selection', () => {
    renderPanel({
      vfos: [{ ...VFO, sourceSessionId: 'rtl-sdr-1' }],
      sourceWindows: {
        'rtl-sdr-1': {
          label: 'RTL-SDR',
          available: false,
          running: false,
          centerFrequencyHz: 100_000_000,
          sampleRateHz: 1_000_000,
        },
      },
    })
    expect(screen.getByText('RTL-SDR')).toBeVisible()
    expect(screen.getByText('offline')).toBeVisible()
  })

  it('keeps an available stopped source ready for configuration', () => {
    renderPanel({
      sourceWindows: {
        generator: {
          label: 'Generator',
          available: true,
          running: false,
          centerFrequencyHz: 100_000_000,
          sampleRateHz: 1_000_000,
        },
      },
    })
    expect(screen.getByText('ready')).toBeVisible()
  })

  it('shows current WBFM stereo lock', () => {
    renderPanel({ audio: RUNNING_AUDIO })

    expect(screen.getByRole('status', { name: 'Stereo decoder locked' })).toHaveTextContent('ST')
  })

  it('shows WBFM mono fallback after an unlocked audio block', () => {
    renderPanel({
      audio: {
        ...RUNNING_AUDIO,
        diagnostics: {
          ...RUNNING_AUDIO.diagnostics!,
          stereoLocked: { 'vfo-1': false },
        },
      },
    })

    expect(
      screen.getByRole('status', { name: 'Stereo decoder using mono fallback' }),
    ).toHaveTextContent('MONO')
  })

  it('shows unavailable WBFM status before playback', () => {
    renderPanel()

    expect(
      screen.getByRole('status', { name: 'Stereo decoder unavailable' }),
    ).toHaveTextContent('--')
  })

  it('does not show stereo status for non-WBFM modes', () => {
    renderPanel({
      vfos: [{ ...VFO, mode: 'nbfm', bandwidthHz: 12_500 }],
      audio: RUNNING_AUDIO,
    })

    expect(screen.queryByRole('status', { name: /Stereo decoder/ })).not.toBeInTheDocument()
  })
})