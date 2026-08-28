import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_HACKRF_CONFIG } from '../sources/hackrfProtocol'
import { HackRFControls } from './HackRFControls'
import { SourceControls } from './SourceControls'

describe('SourceControls', () => {
  it('selects the HackRF source with an accessible segmented control', () => {
    const onChange = vi.fn()
    render(<SourceControls mode="generator" disabled={false} onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Generator' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'HackRF' }))
    expect(onChange).toHaveBeenCalledWith('hackrf')
  })

  it('exposes safe HackRF defaults and locks configuration while connecting', () => {
    const onChange = vi.fn()
    const onAutoOptimizeChange = vi.fn()
    const { rerender } = render(
      <HackRFControls
        config={DEFAULT_HACKRF_CONFIG}
        ready
        state="idle"
        onChange={onChange}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onReset={vi.fn()}
        onAutoOptimizeChange={onAutoOptimizeChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Connect HackRF One' })).toBeEnabled()
    expect(screen.getByRole('spinbutton', { name: 'RF center' })).toHaveValue(100)
    expect(screen.getByRole('slider', { name: 'LNA gain' })).toHaveValue('16')
    expect(screen.getByRole('slider', { name: 'VGA gain' })).toHaveValue('20')
    expect(screen.getByRole('checkbox', { name: /RF amp/ })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto optimize' }))
    expect(onAutoOptimizeChange).toHaveBeenCalledWith(true)

    fireEvent.change(screen.getByRole('slider', { name: 'LNA gain' }), {
      target: { value: '24' },
    })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_HACKRF_CONFIG, lnaGainDb: 24 })

    rerender(
      <HackRFControls
        config={DEFAULT_HACKRF_CONFIG}
        ready
        state="connecting"
        onChange={onChange}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onReset={vi.fn()}
        autoOptimizeEnabled
        autoOptimizeStatus="settling"
        autoOptimizeDetail="Waiting for fresh measurements."
        autoOptimizeTargetFrequencyHz={100_100_000}
        onAutoOptimizeChange={onAutoOptimizeChange}
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel HackRF connection' })).toBeEnabled()
    expect(screen.getByRole('spinbutton', { name: 'RF center' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'LNA gain' })).toBeDisabled()
    expect(screen.getByText('100.1000 MHz')).toBeVisible()
    expect(screen.getByText('Waiting for fresh measurements.')).toBeVisible()
  })
})