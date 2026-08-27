import type { AnalyzerSnapshot } from '../analyzer/AnalyzerController'
import { formatFrequency } from '../renderers/canvas'

type AnalyzerStatusProps = {
  snapshot: AnalyzerSnapshot
}

export function AnalyzerStatus({ snapshot }: AnalyzerStatusProps) {
  return (
    <div className="metrics" aria-label="Current analyzer measurements">
      <div>
        <span>Peak</span>
        <strong>{formatFrequency(snapshot.peakFrequencyHz, true)}</strong>
      </div>
      <div>
        <span>Level</span>
        <strong>{snapshot.peakPowerDbfs.toFixed(1)} dBFS</strong>
      </div>
      <div>
        <span>Noise</span>
        <strong>{snapshot.noiseFloorDbfs.toFixed(1)} dBFS</strong>
      </div>
      <div>
        <span>Signals</span>
        <strong>{snapshot.trackedSignals.filter((signal) => signal.state === 'active').length}</strong>
      </div>
      <div>
        <span>DSP</span>
        <strong>{snapshot.processingTimeMs.toFixed(2)} ms</strong>
      </div>
      <div>
        <span>Frame</span>
        <strong>{snapshot.sequence.toLocaleString()}</strong>
      </div>
    </div>
  )
}