import { Crosshair, Radio, RotateCcw, Square } from 'lucide-react'
import type { AnalyzerState } from '../analyzer/AnalyzerController'
import {
  E4000_TUNER_GAINS_DB,
  RTL_SDR_SAMPLE_RATES_HZ,
  type RtlSdrConfig,
  type RtlSdrDirectSampling,
  type RtlSdrFftSize,
  type RtlSdrRuntimeCommand,
  type RtlSdrSampleRateHz,
} from '../sources/rtlSdrProtocol'
import type { RtlSdrAutoOptimizeStatus } from '../sources/RtlSdrAutoOptimizer'

type RtlSdrControlsProps = {
  config: RtlSdrConfig
  ready: boolean
  state: AnalyzerState
  runtimePending: boolean
  runtimeError: string | null
  autoOptimizeEnabled?: boolean
  autoOptimizeDisabled?: boolean
  autoOptimizeStatus?: RtlSdrAutoOptimizeStatus
  autoOptimizeDetail?: string
  autoOptimizeTargetFrequencyHz?: number | null
  onChange: (config: RtlSdrConfig) => void
  onRuntimeCommand: (command: RtlSdrRuntimeCommand) => void
  onAutoOptimizeChange?: (enabled: boolean) => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

export function RtlSdrControls({
  config,
  ready,
  state,
  runtimePending,
  runtimeError,
  autoOptimizeEnabled = false,
  autoOptimizeDisabled = false,
  autoOptimizeStatus = 'off',
  autoOptimizeDetail = 'Manual control.',
  autoOptimizeTargetFrequencyHz = null,
  onChange,
  onRuntimeCommand,
  onAutoOptimizeChange,
  onStart,
  onStop,
  onReset,
}: RtlSdrControlsProps) {
  const active = state === 'connecting' || state === 'running'
  const running = state === 'running'
  const settingDisabled = !ready || state === 'connecting' || runtimePending

  const apply = (
    change: Partial<RtlSdrConfig>,
    command: RtlSdrRuntimeCommand,
  ) => {
    if (running) onRuntimeCommand(command)
    else onChange({ ...config, ...change })
  }

  const commitCenterFrequency = (input: HTMLInputElement) => {
    const centerFrequencyHz = Math.round(Number(input.value) * 1_000_000)
    if (!Number.isSafeInteger(centerFrequencyHz) || centerFrequencyHz <= 0) {
      input.value = String(config.centerFrequencyHz / 1_000_000)
      return
    }
    apply(
      { centerFrequencyHz },
      { type: 'set-center-frequency', centerFrequencyHz },
    )
  }

  const commitFrequencyCorrection = (input: HTMLInputElement) => {
    const frequencyCorrectionPpm = Number(input.value)
    if (!Number.isInteger(frequencyCorrectionPpm)) {
      input.value = String(config.frequencyCorrectionPpm)
      return
    }
    apply(
      { frequencyCorrectionPpm },
      { type: 'set-frequency-correction', frequencyCorrectionPpm },
    )
  }

  return (
    <div className="source-control-body" aria-label="RTL-SDR E4000 controls">
      <div className="control-heading">
        <span>01 / SOURCE</span>
        <h2>RTL-SDR</h2>
        <p>RTL2832U · E4000 · receive only</p>
      </div>

      <div className="transport-row">
        <button
          className="transport-button"
          type="button"
          onClick={active ? onStop : onStart}
          disabled={!ready}
          aria-label={
            state === 'connecting'
              ? 'Cancel RTL-SDR connection'
              : running
                ? 'Stop RTL-SDR reception'
                : 'Connect RTL-SDR'
          }
        >
          {active ? <Square size={15} aria-hidden="true" /> : <Radio size={17} aria-hidden="true" />}
          {state === 'connecting' ? 'Cancel' : running ? 'Stop' : 'Connect'}
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
        <label className="toggle-label" htmlFor="rtl-sdr-auto-optimize">
          <span>Auto optimize</span>
          <input
            id="rtl-sdr-auto-optimize"
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
        <label htmlFor="rtl-sdr-center-frequency">RF center</label>
        <div className="input-unit">
          <input
            key={config.centerFrequencyHz}
            id="rtl-sdr-center-frequency"
            type="number"
            min="0.001"
            max="2200"
            step="0.001"
            defaultValue={config.centerFrequencyHz / 1_000_000}
            disabled={settingDisabled}
            onBlur={(event) => commitCenterFrequency(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <span>MHz</span>
        </div>
      </div>

      <div className="control-grid">
        <div className="control-group">
          <label htmlFor="rtl-sdr-sample-rate">Sample rate</label>
          <select
            id="rtl-sdr-sample-rate"
            value={config.sampleRateHz}
            disabled={!ready || active}
            onChange={(event) => onChange({
              ...config,
              sampleRateHz: Number(event.target.value) as RtlSdrSampleRateHz,
            })}
          >
            {RTL_SDR_SAMPLE_RATES_HZ.map((sampleRateHz) => (
              <option key={sampleRateHz} value={sampleRateHz}>
                {sampleRateHz / 1_000_000} MS/s
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="rtl-sdr-fft-size">FFT size</label>
          <select
            id="rtl-sdr-fft-size"
            value={config.fftSize}
            disabled={!ready || active}
            onChange={(event) => onChange({
              ...config,
              fftSize: Number(event.target.value) as RtlSdrFftSize,
            })}
          >
            <option value="1024">1,024</option>
            <option value="2048">2,048</option>
            <option value="4096">4,096</option>
          </select>
        </div>
      </div>

      <div className="control-group">
        <label htmlFor="rtl-sdr-tuner-gain">Tuner gain</label>
        <select
          id="rtl-sdr-tuner-gain"
          value={config.tunerGainDb ?? 'auto'}
          disabled={settingDisabled}
          onChange={(event) => {
            const tunerGainDb = event.target.value === 'auto'
              ? null
              : Number(event.target.value)
            apply({ tunerGainDb }, { type: 'set-tuner-gain', tunerGainDb })
          }}
        >
          <option value="auto">Automatic</option>
          {E4000_TUNER_GAINS_DB.map((gainDb) => (
            <option key={gainDb} value={gainDb}>{gainDb} dB</option>
          ))}
        </select>
      </div>

      <div className="control-grid">
        <div className="control-group">
          <label htmlFor="rtl-sdr-frequency-correction">Correction</label>
          <div className="input-unit">
            <input
              key={config.frequencyCorrectionPpm}
              id="rtl-sdr-frequency-correction"
              type="number"
              min="-1000"
              max="1000"
              step="1"
              defaultValue={config.frequencyCorrectionPpm}
              disabled={settingDisabled}
              onBlur={(event) => commitFrequencyCorrection(event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <span>PPM</span>
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="rtl-sdr-direct-sampling">HF input</label>
          <select
            id="rtl-sdr-direct-sampling"
            value={config.directSampling}
            disabled={settingDisabled}
            onChange={(event) => {
              const directSampling = event.target.value as RtlSdrDirectSampling
              apply(
                { directSampling },
                { type: 'set-direct-sampling', directSampling },
              )
            }}
          >
            <option value="off">Tuner</option>
            <option value="i">Direct I</option>
            <option value="q">Direct Q</option>
          </select>
        </div>
      </div>

      <div className="control-group rtl-bias-control">
        <label className="toggle-label" htmlFor="rtl-sdr-bias-tee">
          <span>Bias tee power</span>
          <input
            id="rtl-sdr-bias-tee"
            type="checkbox"
            checked={config.biasTeeEnabled}
            disabled={settingDisabled}
            onChange={(event) => {
              const biasTeeEnabled = event.target.checked
              if (
                biasTeeEnabled &&
                !window.confirm('Enable antenna bias power? Confirm the connected RF hardware is bias-safe.')
              ) return
              apply(
                { biasTeeEnabled },
                { type: 'set-bias-tee', biasTeeEnabled },
              )
            }}
          />
        </label>
        <p className="source-note">Off at startup and shutdown.</p>
      </div>

      {(runtimePending || runtimeError) && (
        <p className="source-note" role="status">
          {runtimePending ? 'Applying receiver setting…' : runtimeError}
        </p>
      )}
    </div>
  )
}