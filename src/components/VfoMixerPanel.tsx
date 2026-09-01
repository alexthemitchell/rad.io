import {
  Headphones,
  Pause,
  Play,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { AudioPlaybackSnapshot } from '../audio/AudioPlaybackController'
import { isVfoInPassband } from '../vfo/vfoState'
import { MAX_VFOS, type VfoConfig, type VfoMode } from '../vfo/types'
import type { SourceSessionId } from '../sources/types'

const BANDWIDTH_OPTIONS: Readonly<Record<VfoMode, readonly number[]>> = {
  wbfm: [150_000, 200_000, 250_000],
  am: [6_000, 10_000, 15_000],
  nbfm: [8_330, 12_500, 25_000],
}

type VfoMixerPanelProps = {
  vfos: readonly VfoConfig[]
  sourceWindows: Readonly<Record<SourceSessionId, {
    label: string
    available: boolean
    running: boolean
    centerFrequencyHz: number
    sampleRateHz: number
  }>>
  audio: AudioPlaybackSnapshot
  masterGainDb: number
  masterMuted: boolean
  onAdd: () => void
  onUpdateDsp: (
    id: string,
    change: Partial<Pick<VfoConfig, 'frequencyHz' | 'mode' | 'bandwidthHz' | 'squelchDbfs'>>,
  ) => void
  onUpdateMixer: (
    id: string,
    change: Partial<Pick<VfoConfig, 'label' | 'gainDb' | 'muted' | 'solo'>>,
  ) => void
  onRemove: (id: string) => void
  onTogglePlayback: () => void
  onMasterGainChange: (gainDb: number) => void
  onMasterMutedChange: (muted: boolean) => void
}

export function VfoMixerPanel({
  vfos,
  sourceWindows,
  audio,
  masterGainDb,
  masterMuted,
  onAdd,
  onUpdateDsp,
  onUpdateMixer,
  onRemove,
  onTogglePlayback,
  onMasterGainChange,
  onMasterMutedChange,
}: VfoMixerPanelProps) {
  const playing = audio.state === 'running' || audio.state === 'starting'
  const underruns = Object.values(audio.diagnostics?.underruns ?? {})
    .reduce((sum, count) => sum + count, 0)
  const overruns = Object.values(audio.diagnostics?.overruns ?? {})
    .reduce((sum, count) => sum + count, 0)
  return (
    <section className="vfo-panel" aria-labelledby="vfo-heading">
      <header className="vfo-header">
        <div>
          <p className="section-label">03 / AUDIO</p>
          <h2 id="vfo-heading">VFO mixer</h2>
        </div>
        <div className="vfo-master-controls">
          <button
            className="vfo-command"
            type="button"
            onClick={onTogglePlayback}
            disabled={vfos.length === 0 || audio.state === 'starting'}
            aria-label={playing ? 'Pause audio playback' : 'Start audio playback'}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            className="vfo-icon-command"
            type="button"
            onClick={() => onMasterMutedChange(!masterMuted)}
            aria-pressed={masterMuted}
            aria-label={masterMuted ? 'Unmute master audio' : 'Mute master audio'}
            data-tooltip={masterMuted ? 'Unmute master' : 'Mute master'}
          >
            {masterMuted
              ? <VolumeX size={16} aria-hidden="true" />
              : <Volume2 size={16} aria-hidden="true" />}
          </button>
          <label className="vfo-master-gain" htmlFor="vfo-master-gain">
            <span>Master</span>
            <input
              id="vfo-master-gain"
              type="range"
              min="-60"
              max="6"
              step="1"
              value={masterGainDb}
              onChange={(event) => onMasterGainChange(Number(event.target.value))}
            />
            <output htmlFor="vfo-master-gain">{masterGainDb} dB</output>
          </label>
          <button
            className="vfo-command vfo-add-command"
            type="button"
            onClick={onAdd}
            disabled={vfos.length >= MAX_VFOS}
          >
            <Plus size={16} aria-hidden="true" />
            Add VFO
          </button>
        </div>
      </header>

      {vfos.length === 0 ? (
        <p className="vfo-empty" role="status">No receivers configured</p>
      ) : (
        <div className="vfo-list" role="list" aria-label="Audio VFOs">
          {vfos.map((vfo) => {
            const source = sourceWindows[vfo.sourceSessionId]
            const sourceAvailable = source?.available ?? false
            const sourceRunning = source?.running ?? false
            const inPassband = sourceAvailable && isVfoInPassband(vfo, {
              centerFrequencyHz: source.centerFrequencyHz,
              sampleRateHz: source.sampleRateHz,
            })
            const queuedFrames = audio.diagnostics?.queuedFrames[vfo.id] ?? 0
            const stereoLocked = audio.diagnostics?.stereoLocked[vfo.id]
            const stereoState = !playing || !inPassband || stereoLocked === undefined
              ? { copy: '--', label: 'Stereo decoder unavailable', className: '' }
              : stereoLocked
                ? { copy: 'ST', label: 'Stereo decoder locked', className: 'is-locked' }
                : { copy: 'MONO', label: 'Stereo decoder using mono fallback', className: 'is-mono' }
            return (
              <div className="vfo-row" role="listitem" key={vfo.id}>
                <div className="vfo-identity">
                  <span
                    className={`vfo-state-dot ${inPassband ? 'is-ready' : 'is-out-of-band'}`}
                    aria-hidden="true"
                  />
                  <label htmlFor={`${vfo.id}-label`}>Receiver</label>
                  <span className="vfo-source-badge">{source?.label ?? 'Removed source'}</span>
                  <input
                    id={`${vfo.id}-label`}
                    value={vfo.label}
                    maxLength={32}
                    onChange={(event) => onUpdateMixer(vfo.id, { label: event.target.value })}
                  />
                  <span className="vfo-state-copy">
                    {!sourceAvailable
                      ? 'offline'
                      : inPassband
                      ? sourceRunning && playing && queuedFrames > 0 ? 'playing' : 'ready'
                      : 'out of band'}
                  </span>
                </div>
                <label className="vfo-field" htmlFor={`${vfo.id}-frequency`}>
                  <span>Frequency</span>
                  <span className="vfo-input-unit">
                    <input
                      id={`${vfo.id}-frequency`}
                      type="number"
                      min="0"
                      max="6000"
                      step="0.001"
                      value={vfo.frequencyHz / 1_000_000}
                      onChange={(event) => {
                        const frequencyHz = Math.round(Number(event.target.value) * 1_000_000)
                        if (Number.isSafeInteger(frequencyHz) && frequencyHz >= 0 && frequencyHz <= 6_000_000_000) {
                          onUpdateDsp(vfo.id, { frequencyHz })
                        }
                      }}
                    />
                    <span>MHz</span>
                  </span>
                </label>
                <label className="vfo-field" htmlFor={`${vfo.id}-mode`}>
                  <span>
                    Mode
                    {vfo.mode === 'wbfm' && (
                      <span
                        className={`vfo-stereo-state ${stereoState.className}`}
                        role="status"
                        aria-label={stereoState.label}
                        title={stereoState.label}
                      >
                        {stereoState.copy}
                      </span>
                    )}
                  </span>
                  <select
                    id={`${vfo.id}-mode`}
                    aria-label="Mode"
                    value={vfo.mode}
                    onChange={(event) => onUpdateDsp(vfo.id, { mode: event.target.value as VfoMode })}
                  >
                    <option value="wbfm">WBFM</option>
                    <option value="am">AM</option>
                    <option value="nbfm">NBFM</option>
                  </select>
                </label>
                <label className="vfo-field" htmlFor={`${vfo.id}-bandwidth`}>
                  <span>Bandwidth</span>
                  <select
                    id={`${vfo.id}-bandwidth`}
                    value={vfo.bandwidthHz}
                    onChange={(event) => onUpdateDsp(vfo.id, { bandwidthHz: Number(event.target.value) })}
                  >
                    {BANDWIDTH_OPTIONS[vfo.mode].map((bandwidthHz) => (
                      <option value={bandwidthHz} key={bandwidthHz}>
                        {bandwidthHz >= 100_000
                          ? `${bandwidthHz / 1_000} kHz`
                          : `${(bandwidthHz / 1_000).toFixed(bandwidthHz % 1_000 === 0 ? 0 : 2)} kHz`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="vfo-field vfo-range-field" htmlFor={`${vfo.id}-squelch`}>
                  <span>Squelch <output htmlFor={`${vfo.id}-squelch`}>{vfo.squelchDbfs} dBFS</output></span>
                  <input
                    id={`${vfo.id}-squelch`}
                    type="range"
                    min="-120"
                    max="-20"
                    step="1"
                    value={vfo.squelchDbfs}
                    onChange={(event) => onUpdateDsp(vfo.id, { squelchDbfs: Number(event.target.value) })}
                  />
                </label>
                <label className="vfo-field vfo-range-field" htmlFor={`${vfo.id}-gain`}>
                  <span>Gain <output htmlFor={`${vfo.id}-gain`}>{vfo.gainDb} dB</output></span>
                  <input
                    id={`${vfo.id}-gain`}
                    type="range"
                    min="-60"
                    max="12"
                    step="1"
                    value={vfo.gainDb}
                    onChange={(event) => onUpdateMixer(vfo.id, { gainDb: Number(event.target.value) })}
                  />
                </label>
                <div className="vfo-row-actions">
                  <button
                    type="button"
                    aria-pressed={vfo.muted}
                    aria-label={`${vfo.muted ? 'Unmute' : 'Mute'} ${vfo.label}`}
                    data-tooltip={vfo.muted ? 'Unmute' : 'Mute'}
                    onClick={() => onUpdateMixer(vfo.id, { muted: !vfo.muted })}
                  >
                    {vfo.muted
                      ? <VolumeX size={15} aria-hidden="true" />
                      : <Volume2 size={15} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    aria-pressed={vfo.solo}
                    aria-label={`${vfo.solo ? 'Unsolo' : 'Solo'} ${vfo.label}`}
                    data-tooltip={vfo.solo ? 'Unsolo' : 'Solo'}
                    onClick={() => onUpdateMixer(vfo.id, { solo: !vfo.solo })}
                  >
                    <Headphones size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${vfo.label}`}
                    data-tooltip="Remove VFO"
                    onClick={() => onRemove(vfo.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <footer className="vfo-footer" role="status">
        <span>{audio.detail}</span>
        <span>{vfos.length} / {MAX_VFOS} receivers · {underruns} underruns · {overruns} overruns</span>
      </footer>
    </section>
  )
}