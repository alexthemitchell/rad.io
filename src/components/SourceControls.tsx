import { Radio, Waves } from 'lucide-react'

export type SourceMode = 'generator' | 'hackrf' | 'rtl-sdr'

type SourceControlsProps = {
  mode: SourceMode
  disabled: boolean
  onChange: (mode: SourceMode) => void
}

export function SourceControls({ mode, disabled, onChange }: SourceControlsProps) {
  return (
    <div className="source-picker" role="group" aria-label="Signal source">
      <button
        type="button"
        aria-pressed={mode === 'generator'}
        disabled={disabled}
        onClick={() => onChange('generator')}
      >
        <Waves size={15} aria-hidden="true" />
        Generator
      </button>
      <button
        type="button"
        aria-pressed={mode === 'hackrf'}
        disabled={disabled}
        onClick={() => onChange('hackrf')}
      >
        <Radio size={15} aria-hidden="true" />
        HackRF
      </button>
      <button
        type="button"
        aria-pressed={mode === 'rtl-sdr'}
        disabled={disabled}
        onClick={() => onChange('rtl-sdr')}
      >
        <Radio size={15} aria-hidden="true" />
        RTL-SDR
      </button>
    </div>
  )
}
