import { useState } from 'react'
import { Crosshair } from 'lucide-react'
import type {
  DetectionConfig,
  TrackedSignal,
} from '../workers/protocol'
import { formatFrequency, formatRfFrequency } from '../renderers/canvas'
import { RdsStationDetails } from './RdsStationDetails'

type DetectedSignalsPanelProps = {
  config: DetectionConfig
  signals: readonly TrackedSignal[]
  centerFrequencyHz: number
  onConfigChange: (config: DetectionConfig) => void
  optimizationTargetFrequencyHz?: number | null
  onSignalSelect?: (signal: TrackedSignal) => void
}

export function DetectedSignalsPanel({
  config,
  signals,
  centerFrequencyHz,
  onConfigChange,
  optimizationTargetFrequencyHz = null,
  onSignalSelect,
}: DetectedSignalsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = signals.find((signal) => signal.id === selectedId) ?? signals[0]

  const update = (change: Partial<DetectionConfig>) =>
    onConfigChange({ ...config, ...change })

  return (
    <section className="detection-panel" aria-labelledby="detections-heading">
      <header className="detection-header">
        <div>
          <p className="section-label">03 / DETECTIONS</p>
          <h2 id="detections-heading">Signal inventory</h2>
        </div>
        <div className="detection-settings" aria-label="Signal detection settings">
          <label className="detection-toggle" htmlFor="detection-enabled">
            <span>Detector</span>
            <input
              id="detection-enabled"
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
          </label>
          <label htmlFor="band-plan">
            <span>Profile</span>
            <select
              id="band-plan"
              value={config.bandPlanId}
              onChange={(event) =>
                update({ bandPlanId: event.target.value as DetectionConfig['bandPlanId'] })
              }
            >
              <option value="fcc-us">FCC / United States</option>
              <option value="none">None</option>
            </select>
          </label>
          <label htmlFor="minimum-snr">
            <span>Minimum SNR</span>
            <span className="detection-range">
              <input
                id="minimum-snr"
                aria-label="Minimum SNR"
                type="range"
                min="3"
                max="40"
                step="1"
                value={config.minimumSnrDb}
                disabled={!config.enabled}
                onChange={(event) => update({ minimumSnrDb: Number(event.target.value) })}
              />
              <output htmlFor="minimum-snr">{config.minimumSnrDb} dB</output>
            </span>
          </label>
        </div>
      </header>

      <div className="detection-table-wrap">
        <table className="detection-table">
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">State</th>
              <th scope="col">Frequency</th>
              <th scope="col">Offset</th>
              <th scope="col">Level</th>
              <th scope="col">SNR</th>
              <th scope="col">Bandwidth</th>
              <th scope="col">Seen</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr
                key={signal.id}
                className={[
                  signal.id === selected?.id ? 'is-selected' : '',
                  matchesOptimizationTarget(signal, optimizationTargetFrequencyHz)
                    ? 'is-optimization-target'
                    : '',
                ].filter(Boolean).join(' ') || undefined}
              >
                <th scope="row">
                  <button
                    type="button"
                    aria-label={`${signal.classification.primary.label}, ${formatSignalFrequency(signal)}, ${signal.state}, track ${signal.id.replace('signal-', '#')}`}
                    onClick={() => {
                      setSelectedId(signal.id)
                      onSignalSelect?.(signal)
                    }}
                  >
                    <span
                      className={`signal-state signal-state--${signal.state}`}
                      aria-hidden="true"
                    />
                    <span className="signal-label-copy">
                      <span>{signal.classification.primary.label}</span>
                      {signal.rds?.metadata?.ps?.value && (
                        <span className="signal-rds-name">{signal.rds.metadata.ps.value}</span>
                      )}
                    </span>
                    {matchesOptimizationTarget(signal, optimizationTargetFrequencyHz) && (
                      <Crosshair
                        className="optimization-target-icon"
                        size={13}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </th>
                <td className="signal-state-label">{signal.state}</td>
                <td>{formatSignalFrequency(signal)}</td>
                <td>{formatFrequency(signal.peakOffsetHz, true)}</td>
                <td>{signal.peakPowerDbfs.toFixed(1)} dBFS</td>
                <td>{signal.snrDb.toFixed(1)} dB</td>
                <td>{formatFrequency(signal.bandwidthHz)}</td>
                <td>{formatDuration(signal.durationUs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {signals.length === 0 && (
          <p className="detection-empty" role="status">
            {config.enabled ? 'No confirmed signals' : 'Detector disabled'}
          </p>
        )}
      </div>

      {selected && (
        <div className="detection-detail">
          <div className="detection-detail-summary">
            <span className="candidate-label">Service candidate</span>
            <strong>{selected.classification.primary.label}</strong>
            <span>{Math.round(selected.classification.primary.score * 100)}% evidence</span>
          </div>
          <dl>
            <div>
              <dt>Spectral shape</dt>
              <dd>{selected.classification.spectralShape}</dd>
            </div>
            <div>
              <dt>Track</dt>
              <dd>{selected.id.replace('signal-', '#')}</dd>
            </div>
            <div>
              <dt>Observations</dt>
              <dd>{selected.hitCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Occupied range</dt>
              <dd>{formatOccupiedRange(selected)}</dd>
            </div>
          </dl>
          <div className="evidence-copy">
            <div>
              <span>Evidence</span>
              <ul>
                {selected.classification.primary.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            {selected.classification.primary.caveats.length > 0 && (
              <div>
                <span>Caveats</span>
                <ul>
                  {selected.classification.primary.caveats.map((caveat) => (
                    <li key={caveat}>{caveat}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {selected.classification.alternatives.length > 0 && (
            <p className="detection-alternatives">
              Alternatives:{' '}
              {selected.classification.alternatives
                .map((candidate) => `${candidate.label} (${Math.round(candidate.score * 100)}%)`)
                .join(', ')}
            </p>
          )}
          {selected.rds && <RdsStationDetails reception={selected.rds} />}
        </div>
      )}

      {centerFrequencyHz === 0 && config.bandPlanId !== 'none' && (
        <p className="baseband-notice" role="status">
          RF classification unavailable at 0 Hz center.
        </p>
      )}
    </section>
  )
}

function formatDuration(durationUs: bigint): string {
  const milliseconds = Number(durationUs / 1_000n)
  if (milliseconds < 1_000) return `${milliseconds} ms`
  return `${(milliseconds / 1_000).toFixed(1)} s`
}

function formatOccupiedRange(signal: TrackedSignal): string {
  if (signal.lowerFrequencyHz !== null && signal.upperFrequencyHz !== null) {
    return `${formatRfFrequency(signal.lowerFrequencyHz)} - ${formatRfFrequency(signal.upperFrequencyHz)}`
  }
  return `${formatFrequency(signal.lowerOffsetHz, true)} - ${formatFrequency(signal.upperOffsetHz, true)}`
}

function formatSignalFrequency(signal: TrackedSignal): string {
  return signal.absoluteFrequencyHz === null
    ? 'Baseband'
    : formatRfFrequency(signal.absoluteFrequencyHz)
}

function matchesOptimizationTarget(
  signal: TrackedSignal,
  targetFrequencyHz: number | null,
): boolean {
  if (targetFrequencyHz === null) return false
  const frequencyHz =
    signal.classification.primary.channelCenterHz ?? signal.absoluteFrequencyHz
  return frequencyHz !== null && Math.abs(frequencyHz - targetFrequencyHz) <= 50_000
}