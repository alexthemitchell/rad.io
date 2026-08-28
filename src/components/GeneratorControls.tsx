import { Pause, Play, RotateCcw } from 'lucide-react'
import type { GeneratorConfig } from '../workers/protocol'

type GeneratorControlsProps = {
  config: GeneratorConfig
  ready: boolean
  running: boolean
  onChange: (config: GeneratorConfig) => void
  onToggle: () => void
  onReset: () => void
}

export function GeneratorControls({
  config,
  ready,
  running,
  onChange,
  onToggle,
  onReset,
}: GeneratorControlsProps) {
  const update = (change: Partial<GeneratorConfig>) =>
    onChange({ ...config, ...change })
  const nyquistKhz = config.sampleRateHz / 2000
  const toneLimitHz = config.sampleRateHz / 2 - 1000

  return (
    <div className="source-control-body" aria-label="Signal generator controls">
      <div className="control-heading">
        <span>01 / SOURCE</span>
        <h2>Generator</h2>
        <p>Complex IQ tone</p>
      </div>

      <div className="transport-row">
        <button
          className="transport-button"
          type="button"
          onClick={onToggle}
          disabled={!ready}
          aria-label={running ? 'Pause generation' : 'Start generation'}
        >
          {running ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onReset}
          disabled={!ready}
          aria-label="Reset generator"
          data-tooltip="Reset generator"
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="control-group">
        <label htmlFor="center-frequency">RF center</label>
        <div className="input-unit">
          <input
            id="center-frequency"
            type="number"
            min="0"
            step="0.001"
            value={config.centerFrequencyHz / 1_000_000}
            onChange={(event) => {
              const value = Number(event.target.value) * 1_000_000
              if (Number.isFinite(value)) {
                update({ centerFrequencyHz: Math.max(0, value) })
              }
            }}
          />
          <span>MHz</span>
        </div>
      </div>

      <div className="control-group">
        <label htmlFor="tone-frequency">Tone offset</label>
        <div className="input-unit">
          <input
            id="tone-frequency"
            type="number"
            min={-nyquistKhz + 1}
            max={nyquistKhz - 1}
            step="1"
            value={config.toneFrequencyHz / 1000}
            onChange={(event) => {
              const value = Number(event.target.value) * 1000
              if (Number.isFinite(value)) {
                update({
                  toneFrequencyHz: Math.max(
                    -toneLimitHz,
                    Math.min(toneLimitHz, value),
                  ),
                })
              }
            }}
          />
          <span>kHz</span>
        </div>
      </div>

      <div className="control-group">
        <div className="label-output">
          <label htmlFor="tone-level">Tone level</label>
          <output htmlFor="tone-level">{config.toneLevelDbfs} dBFS</output>
        </div>
        <input
          id="tone-level"
          type="range"
          min="-80"
          max="0"
          step="1"
          value={config.toneLevelDbfs}
          onChange={(event) => update({ toneLevelDbfs: Number(event.target.value) })}
        />
      </div>

      <div className="control-group">
        <label className="toggle-label" htmlFor="noise-enabled">
          <span>Noise floor</span>
          <input
            id="noise-enabled"
            type="checkbox"
            checked={config.noiseEnabled}
            onChange={(event) => update({ noiseEnabled: event.target.checked })}
          />
        </label>
        <div className="label-output">
          <label htmlFor="noise-level">Noise level</label>
          <output htmlFor="noise-level">{config.noiseLevelDbfs} dBFS</output>
        </div>
        <input
          id="noise-level"
          type="range"
          min="-120"
          max="-20"
          step="1"
          value={config.noiseLevelDbfs}
          disabled={!config.noiseEnabled}
          onChange={(event) => update({ noiseLevelDbfs: Number(event.target.value) })}
        />
      </div>

      <div className="control-grid">
        <div className="control-group">
          <label htmlFor="sample-rate">Sample rate</label>
          <select
            id="sample-rate"
            value={config.sampleRateHz}
            onChange={(event) => {
              const sampleRateHz = Number(event.target.value)
              const limit = sampleRateHz / 2 - 1000
              update({
                sampleRateHz,
                toneFrequencyHz: Math.max(-limit, Math.min(limit, config.toneFrequencyHz)),
              })
            }}
          >
            <option value="250000">250 kS/s</option>
            <option value="1000000">1.00 MS/s</option>
            <option value="2400000">2.40 MS/s</option>
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="fft-size">FFT size</label>
          <select
            id="fft-size"
            value={config.fftSize}
            onChange={(event) =>
              update({ fftSize: Number(event.target.value) as GeneratorConfig['fftSize'] })
            }
          >
            <option value="1024">1,024</option>
            <option value="2048">2,048</option>
            <option value="4096">4,096</option>
          </select>
        </div>
      </div>
    </div>
  )
}