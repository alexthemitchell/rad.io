import { Plus, Radio, Waves, X } from 'lucide-react'
import type { SourceSessionSnapshot } from '../analyzer/SourceSession'
import type { AuthorizedUsbDevice } from '../sources/UsbDeviceRegistry'
import type { SourceSessionId } from '../sources/types'

type SourceSessionsPanelProps = {
  sessions: readonly SourceSessionSnapshot[]
  selectedSessionId: SourceSessionId | null
  addDisabled: boolean
  addError: string | null
  authorizedDevices: readonly AuthorizedUsbDevice[]
  onSelect: (sourceSessionId: SourceSessionId | null) => void
  onAdd: () => void
  onAddAuthorized: (device: AuthorizedUsbDevice) => void
  onPairNew: () => void
  onRemove: (sourceSessionId: SourceSessionId) => void
}

export function SourceSessionsPanel({
  sessions,
  selectedSessionId,
  addDisabled,
  addError,
  authorizedDevices,
  onSelect,
  onAdd,
  onAddAuthorized,
  onPairNew,
  onRemove,
}: SourceSessionsPanelProps) {
  return (
    <section className="source-sessions" aria-label="Signal sources">
      <div className="source-session-list" role="tablist" aria-label="Source sessions">
        <button
          className="source-session-tab"
          type="button"
          role="tab"
          aria-selected={selectedSessionId === null}
          onClick={() => onSelect(null)}
        >
          <Waves size={15} aria-hidden="true" />
          <span>Generator</span>
        </button>
        {sessions.map((session) => (
          <div className="source-session-entry" key={session.id}>
            <button
              className="source-session-tab"
              type="button"
              role="tab"
              aria-selected={selectedSessionId === session.id}
              onClick={() => onSelect(session.id)}
            >
              <Radio size={15} aria-hidden="true" />
              <span>
                <strong>{session.label}</strong>
                <small>{sessionSubtitle(session)}</small>
              </span>
            </button>
            <button
              className="source-session-remove"
              type="button"
              aria-label={`Remove ${session.label}`}
              data-tooltip="Remove source"
              onClick={() => onRemove(session.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button
        className="source-session-add"
        type="button"
        disabled={addDisabled}
        onClick={onAdd}
      >
        <Plus size={15} aria-hidden="true" />
        Add device
      </button>
      {authorizedDevices.length > 0 && (
        <div className="source-device-menu" role="menu" aria-label="Authorized SDR devices">
          {authorizedDevices.map((device, index) => (
            <button
              type="button"
              role="menuitem"
              key={`${device.kind}-${device.serialNumber ?? index}`}
              onClick={() => onAddAuthorized(device)}
            >
              <Radio size={14} aria-hidden="true" />
              <span>
                <strong>{device.label}</strong>
                <small>{device.serialNumber ?? 'No serial number'}</small>
              </span>
            </button>
          ))}
          <button type="button" role="menuitem" onClick={onPairNew}>
            <Plus size={14} aria-hidden="true" />
            Pair new device
          </button>
        </div>
      )}
      {addError && <p className="source-note" role="status">{addError}</p>}
    </section>
  )
}

function sessionSubtitle(session: SourceSessionSnapshot): string {
  const state = session.deviceConnected ? session.analyzer.state : 'disconnected'
  const optimization = session.autoOptimize.enabled
    ? ` · ${session.autoOptimize.status.replaceAll('-', ' ')}`
    : ''
  const serialSuffix = session.serialNumber
    ? ` · ${session.serialNumber.slice(-6)}`
    : ''
  return `${state}${optimization}${serialSuffix}`
}