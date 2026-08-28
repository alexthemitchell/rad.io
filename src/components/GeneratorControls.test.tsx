import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  AM_GENERATOR_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
  FM_RDS_GENERATOR_CONFIG,
  NBFM_GENERATOR_CONFIG,
} from '../workers/protocol'
import { GeneratorControls } from './GeneratorControls'

describe('GeneratorControls', () => {
  it('exposes labeled controls and emits an updated tone offset', () => {
    const onChange = vi.fn()
    render(
      <GeneratorControls
        config={DEFAULT_GENERATOR_CONFIG}
        ready
        running={false}
        onChange={onChange}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Start generation' })).toBeEnabled()
    expect(screen.getByRole('slider', { name: 'Tone level' })).toHaveValue('-12')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tone offset' }), {
      target: { value: '-125' },
    })

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_GENERATOR_CONFIG,
      toneFrequencyHz: -125_000,
    })

    fireEvent.change(screen.getByRole('spinbutton', { name: 'RF center' }), {
      target: { value: '100.1' },
    })
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_GENERATOR_CONFIG,
      centerFrequencyHz: 100_100_000,
    })
  })

  it('clamps manually entered frequencies inside Nyquist', () => {
    const onChange = vi.fn()
    render(
      <GeneratorControls
        config={DEFAULT_GENERATOR_CONFIG}
        ready
        running={false}
        onChange={onChange}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tone offset' }), {
      target: { value: '9999' },
    })

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_GENERATOR_CONFIG,
      toneFrequencyHz: 499_000,
    })
  })

  it('selects the fixed FM+RDS preset and restores prior tone settings', () => {
    const onChange = vi.fn()
    const toneConfig = {
      ...DEFAULT_GENERATOR_CONFIG,
      toneFrequencyHz: -125_000,
    }
    const { rerender } = render(
      <GeneratorControls
        config={toneConfig}
        ready
        running={false}
        onChange={onChange}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'FM + RDS' }))
    expect(onChange).toHaveBeenLastCalledWith(FM_RDS_GENERATOR_CONFIG)

    rerender(
      <GeneratorControls
        config={FM_RDS_GENERATOR_CONFIG}
        ready
        running={false}
        onChange={onChange}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getByText('RAD.IO')).toBeVisible()
    expect(screen.getByText('100.1 MHz')).toBeVisible()
    expect(screen.getByText('3CE7 / Information')).toBeVisible()
    expect(screen.queryByRole('spinbutton', { name: 'Tone offset' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tone' }))
    expect(onChange).toHaveBeenLastCalledWith(toneConfig)
  })

  it('selects deterministic AM and NBFM audio presets', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <GeneratorControls
        config={DEFAULT_GENERATOR_CONFIG}
        ready
        running={false}
        onChange={onChange}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'AM' }))
    expect(onChange).toHaveBeenLastCalledWith(AM_GENERATOR_CONFIG)
    rerender(
      <GeneratorControls
        config={AM_GENERATOR_CONFIG}
        ready
        running={false}
        onChange={onChange}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getByText('50% AM')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'NBFM' }))
    expect(onChange).toHaveBeenLastCalledWith(NBFM_GENERATOR_CONFIG)
  })

  it('enables reset only when ready and invokes it once', () => {
    const onReset = vi.fn()
    const props = {
      config: DEFAULT_GENERATOR_CONFIG,
      running: false,
      onChange: vi.fn(),
      onToggle: vi.fn(),
      onReset,
    }
    const { rerender } = render(<GeneratorControls {...props} ready={false} />)
    const reset = screen.getByRole('button', { name: 'Reset generator' })
    expect(reset).toBeDisabled()
    fireEvent.click(reset)
    expect(onReset).not.toHaveBeenCalled()

    rerender(<GeneratorControls {...props} ready />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset generator' }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})