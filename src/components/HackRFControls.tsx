import { Crosshair, Radio, RotateCcw, Square } from 'lucide-react'
import {
  HACKRF_SAMPLE_RATES_HZ,
  type HackRfConfig,
  type HackRfFftSize,
  type HackRfSampleRateHz,
} from '../sources/hackrfProtocol'
import type { AnalyzerState } from '../analyzer/AnalyzerController'
import type { HackRfAutoOptimizeStatus } from '../sources/HackRfAutoOptimizer'

type HackRFControlsProps = {
  config: HackRfConfig
  ready: boolean
  state: AnalyzerState
  onChange: (config: HackRfConfig) => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
  autoOptimizeEnabled?: boolean
  autoOptimizeDisabled?: boolean
  autoOptimizeStatus?: HackRfAutoOptimizeStatus
  autoOptimizeDetail?: string
  autoOptimizeTargetFrequencyHz?: number | null
  onAutoOptimizeChange?: (enabled: boolean) => void
}

export function HackRFControls({
  config,
  ready,
  state,
  onChange,
  onStart,
  onStop,
  onReset,
  autoOptimizeEnabled = false,
  autoOptimizeDisabled = false,
  autoOptimizeStatus = 'off',
  autoOptimizeDetail = 'Manual control.',
  autoOptimizeTargetFrequencyHz = null,
  onAutoOptimizeChange,
}: HackRFControlsProps) {
  const active = state === 'connecting' || state === 'running'
  const update = (change: Partial<HackRfConfig>) => onChange({ ...config, ...change })

  return (
    <div className="source-control-body" aria-label="HackRF One controls">
      <div className="control-heading">
        <span>01 / SOURCE</span>
        <h2>HackRF One</h2>
        <p>Browser USB · receive only</p>
      </div>

      <div className="transport-row">
        <button
          className="transport-button"
          type="button"
          onClick={active ? onStop : onStart}
          disabled={!ready}
          aria-label={
            state === 'connecting'
              ? 'Cancel HackRF connection'
              : state === 'running'
                ? 'Stop HackRF reception'
                : 'Connect HackRF One'
          }
        >
          {active ? <Square size={15} aria-hidden="true" /> : <Radio size={17} aria-hidden="true" />}
          {state === 'connecting' ? 'Cancel' : state === 'running' ? 'Stop' : 'Connect'}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onReset}
          disabled={!ready || active}
          aria-label="Clear analyzer"
          data-tooltip="Clear analyzer"
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="control-group auto-optimize-control">
        <label className="toggle-label" htmlFor="hackrf-auto-optimize">
          <span>Auto optimize</span>
          <input
            id="hackrf-auto-optimize"
            type="checkbox"
            checked={autoOptimizeEnabled}
            disabled={!ready || autoOptimizeDisabled}
            onChange={(event) => onAutoOptimizeChange?.(event.target.checked)}
          />
        </label>
        <div className={`auto-optimize-status auto-optimize-status--${autoOptimizeStatus}`}>
          <Crosshair size={15} strokeWidth={1.8} aria-hidden="true" />
          <div>
            <strong>{autoOptimizeStatus.replaceAll('-', ' ')}</strong>
            {autoOptimizeTargetFrequencyHz !== null && (
              <span>{(autoOptimizeTargetFrequencyHz / 1_000_000).toFixed(4)} MHz</span>
            )}
          </div>
        </div>
        <p className="source-note" role="status">{autoOptimizeDetail}</p>
      </div>

      <div className="control-group">
        <label htmlFor="hackrf-center-frequency">RF center</label>
        <div className="input-unit">
          <input
            id="hackrf-center-frequency"
            type="number"
            min="1"
            max="6000"
            step="0.001"
            value={config.centerFrequencyHz / 1_000_000}
            disabled={active}
            onChange={(event) => {
              const value = Math.round(Number(event.target.value) * 1_000_000)
              if (Number.isSafeInteger(value)) {
                update({ centerFrequencyHz: Math.max(1_000_000, Math.min(6_000_000_000, value)) })
              }
            }}
          />
          <span>MHz</span>
        </div>
      </div>

      <div className="control-grid">
        <div className="control-group">
          <label htmlFor="hackrf-sample-rate">Sample rate</label>
          <select
            id="hackrf-sample-rate"
            value={config.sampleRateHz}
            disabled={active}
            onChange={(event) =>
              update({ sampleRateHz: Number(event.target.value) as HackRfSampleRateHz })
            }
          >
            {HACKRF_SAMPLE_RATES_HZ.map((sampleRateHz) => (
              <option key={sampleRateHz} value={sampleRateHz}>
                {sampleRateHz / 1_000_000} MS/s
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="hackrf-fft-size">FFT size</label>
          <select
            id="hackrf-fft-size"
            value={config.fftSize}
            disabled={active}
            onChange={(event) => update({ fftSize: Number(event.target.value) as HackRfFftSize })}
          >
            <option value="1024">1,024</option>
            <option value="2048">2,048</option>
            <option value="4096">4,096</option>
          </select>
        </div>
      </div>

      <div className="control-group">
        <div className="label-output">
          <label htmlFor="hackrf-lna-gain">LNA gain</label>
          <output htmlFor="hackrf-lna-gain">{config.lnaGainDb} dB</output>
        </div>
        <input
          id="hackrf-lna-gain"
          type="range"
          min="0"
          max="40"
          step="8"
          value={config.lnaGainDb}
          disabled={active}
          onChange={(event) => update({ lnaGainDb: Number(event.target.value) })}
        />
      </div>

      <div className="control-group">
        <div className="label-output">
          <label htmlFor="hackrf-vga-gain">VGA gain</label>
          <output htmlFor="hackrf-vga-gain">{config.vgaGainDb} dB</output>
        </div>
        <input
          id="hackrf-vga-gain"
          type="range"
          min="0"
          max="62"
          step="2"
          value={config.vgaGainDb}
          disabled={active}
          onChange={(event) => update({ vgaGainDb: Number(event.target.value) })}
        />
      </div>

      <div className="control-group">
        <label className="toggle-label" htmlFor="hackrf-amp-enabled">
          <span>RF amp · +14 dB</span>
          <input
            id="hackrf-amp-enabled"
            type="checkbox"
            checked={config.ampEnabled}
            disabled={active}
            onChange={(event) => update({ ampEnabled: event.target.checked })}
          />
        </label>
        <p className="source-note">Antenna bias power remains off.</p>
      </div>
    </div>
  )
}
