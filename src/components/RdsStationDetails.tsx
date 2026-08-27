import { formatRfFrequency } from '../renderers/canvas'
import type { RdsReception } from '../workers/protocol'

type RdsStationDetailsProps = {
  reception: RdsReception
}

export function RdsStationDetails({ reception }: RdsStationDetailsProps) {
  const metadata = reception.metadata
  const stateLabel = formatState(reception.state)

  return (
    <section className={`rds-detail rds-detail--${reception.state}`} aria-label="RBDS station data">
      <header className="rds-detail-header">
        <div>
          <span className="candidate-label">RDS / RBDS</span>
          <strong>{metadata?.ps?.value || 'Station metadata'}</strong>
        </div>
        <span className="rds-lock-state" role="status">
          {stateLabel}
        </span>
      </header>

      {!metadata ? (
        <p className="rds-empty">{reception.reason ?? 'Waiting for valid RDS groups.'}</p>
      ) : (
        <>
          {metadata.radioText?.value && (
            <p className="rds-radio-text">{metadata.radioText.value}</p>
          )}
          <dl className="rds-metadata-grid">
            <Metadata label="PI" value={formatHex(metadata.pi?.value)} />
            <Metadata label="Call sign" value={metadata.callSign?.value ?? 'Unavailable'} />
            <Metadata
              label="Program type"
              value={formatProgramType(
                metadata.ptyName?.value,
                metadata.ptyn?.value,
              )}
            />
            <Metadata
              label="Traffic"
              value={formatTraffic(
                metadata.trafficProgram?.value,
                metadata.trafficAnnouncement?.value,
              )}
            />
            <Metadata
              label="Program"
              value={
                metadata.musicSpeech === null
                  ? 'Unavailable'
                  : metadata.musicSpeech.value
                    ? 'Music'
                    : 'Speech'
              }
            />
            <Metadata label="Decoder info" value={formatDecoderInfo(metadata.decoderInfo?.value)} />
            <Metadata
              label="Alternative frequencies"
              value={formatAlternativeFrequencies(
                metadata.alternativeFrequencies?.value.frequenciesHz,
              )}
            />
            <Metadata label="ECC" value={formatHex(metadata.extendedCountryCode?.value, 2)} />
            <Metadata label="PIN" value={formatHex(metadata.programItemNumber?.value)} />
            <Metadata
              label="Station time"
              value={metadata.clockTime?.value.isoUtc ?? 'Unavailable'}
            />
          </dl>

          <div className="rds-service-summary" aria-label="Decoded RDS services">
            <span>{metadata.eonRecords.length} EON</span>
            <span>{metadata.tmcMessages.length} TMC</span>
            <span>{metadata.odaRegistrations.length} ODA</span>
            <span>{reception.diagnostics.validGroups.toLocaleString()} valid groups</span>
            <span>{reception.diagnostics.correctedBlocks.toLocaleString()} corrected blocks</span>
          </div>

          <details className="rds-raw-groups">
            <summary>Recent raw groups ({metadata.rawGroups.length})</summary>
            <ul>
              {metadata.rawGroups.slice(-8).reverse().map((group, index) => (
                <li key={`${group.receivedAtUs}-${index}`}>
                  <span>{group.groupType}{group.version}</span>
                  <code>
                    {group.blocks.map((block) => formatHex(block)).join(' ')}
                  </code>
                  {group.applicationId !== null && (
                    <span>AID {formatHex(group.applicationId)}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function formatState(state: RdsReception['state']): string {
  switch (state) {
    case 'locked':
      return 'Synchronized'
    case 'searching':
      return 'Searching'
    case 'stale':
      return 'Stale'
    case 'capacity-limited':
      return 'Decoder limit reached'
    case 'unavailable':
      return 'Unavailable'
  }
}

function formatHex(value: number | undefined, width = 4): string {
  return value === undefined
    ? 'Unavailable'
    : `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}

function formatTraffic(trafficProgram?: boolean, trafficAnnouncement?: boolean): string {
  if (trafficProgram === undefined && trafficAnnouncement === undefined) return 'Unavailable'
  if (trafficAnnouncement) return 'TP / announcement active'
  return trafficProgram ? 'Traffic program' : 'No traffic service'
}

function formatDecoderInfo(
  decoderInfo: RdsReception['metadata'] extends infer Metadata
    ? Metadata extends { decoderInfo: infer DecoderInfo }
      ? DecoderInfo extends { value: infer Value }
        ? Value | undefined
        : never
      : never
    : never,
): string {
  if (!decoderInfo) return 'Unavailable'
  const flags = [
    decoderInfo.stereo && 'Stereo',
    decoderInfo.artificialHead && 'Artificial head',
    decoderInfo.compressed && 'Compressed',
    decoderInfo.dynamicPty && 'Dynamic PTY',
  ].filter(Boolean)
  return flags.length > 0 ? flags.join(', ') : 'Mono / unprocessed'
}

function formatAlternativeFrequencies(frequencies: number[] | undefined): string {
  if (!frequencies || frequencies.length === 0) return 'Unavailable'
  return frequencies.map(formatRfFrequency).join(', ')
}

function formatProgramType(pty?: string, ptyn?: string): string {
  if (ptyn && pty && ptyn !== pty) return `${ptyn} (${pty})`
  return ptyn || pty || 'Unavailable'
}