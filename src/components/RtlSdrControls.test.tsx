import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RTL_SDR_CONFIG } from '../sources/rtlSdrProtocol'
import { RtlSdrControls } from './RtlSdrControls'

function renderControls(state: 'idle' | 'running' = 'idle') {
  const onChange = vi.fn()
  const onRuntimeCommand = vi.fn()
  render(
    <RtlSdrControls
      config={DEFAULT_RTL_SDR_CONFIG}
      ready
      state={state}
      runtimePending={false}
      runtimeError={null}
      autoOptimizeStatus="off"
      onChange={onChange}
      onRuntimeCommand={onRuntimeCommand}
      onAutoOptimizeChange={vi.fn()}
      onStart={vi.fn()}
      onStop={vi.fn()}
      onReset={vi.fn()}
    />,
  )
  return { onChange, onRuntimeCommand }
}

describe('RtlSdrControls', () => {
  it('exposes safe attached-E4000 defaults', () => {
    renderControls()

    expect(screen.getByRole('button', { name: 'Connect RTL-SDR' })).toBeEnabled()
    expect(screen.getByRole('spinbutton', { name: 'RF center' })).toHaveValue(100)
    expect(screen.getByRole('combobox', { name: 'Sample rate' })).toHaveValue('2400000')
    expect(screen.getByRole('combobox', { name: 'Tuner gain' })).toHaveValue('auto')
    expect(screen.getByRole('combobox', { name: 'HF input' })).toHaveValue('off')
    expect(screen.getByRole('checkbox', { name: 'Bias tee power' })).not.toBeChecked()
  })

  it('routes live settings through acknowledged runtime commands', () => {
    const { onChange, onRuntimeCommand } = renderControls('running')

    fireEvent.change(screen.getByRole('combobox', { name: 'Tuner gain' }), {
      target: { value: '24' },
    })

    expect(onRuntimeCommand).toHaveBeenCalledWith({
      type: 'set-tuner-gain',
      tunerGainDb: 24,
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Sample rate' })).toBeDisabled()
  })

  it('requires confirmation before enabling antenna bias power', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onChange } = renderControls()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bias tee power' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })
})